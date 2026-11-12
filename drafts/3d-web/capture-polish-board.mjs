// 棋盤質感截圖：同一 seed、同一推進節奏（?lab=1），各版本的球位完全相同。
// 用法：node capture-polish-board.mjs [quick]；輸出到 repo 外的 review-polish-board。
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const out = resolve(root, '../../../review-polish-board');
await mkdir(out, { recursive: true });
const base = pathToFileURL(resolve(root, 'dist-polish-board/index.html')).href;
const quick = process.argv[2] === 'quick';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const errors = [], shots = {};
async function shoot(name, query, viewport, shotsToFire = 22, extra) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  await context.route(/^https?:/, route => { errors.push(`external ${route.request().url()}`); return route.abort(); });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  await page.goto(`${base}?lab=1&${query}`); await page.waitForSelector('#board-scene[data-ready=true]');
  const state = await page.evaluate(n => window.boardLab.fastForward(n), shotsToFire);
  if (extra) await extra(page);
  await page.waitForTimeout(700);
  const path = resolve(out, name);
  if (viewport.width < 600) await page.screenshot({ path, fullPage: false });
  else await page.locator(query.includes('cam=') || name.startsWith('light-') || name.startsWith('same-angle') ? '#board-stage' : 'body').screenshot({ path });
  shots[name] = { path, sha256: createHash('sha256').update(await readFile(path)).digest('hex'), query, state };
  await context.close();
}
const desktop = { width: 1280, height: 720 }, mobile = { width: 390, height: 844 };
await shoot('desktop-1280x720.png', 'ball=b&icon=a&light=a', desktop);
await shoot('same-angle-stage.png', 'ball=b&icon=a&light=a', desktop);
if (!quick) {
  await shoot('mobile-390x844.png', 'ball=b&icon=a&light=a', mobile);
  for (const v of ['a', 'b', 'c']) await shoot(`ball-${v}.png`, `ball=${v}&icon=a&light=a&cam=ball`, desktop);
  for (const v of ['a', 'b', 'c']) await shoot(`icon-${v}.png`, `ball=b&icon=${v}&light=a&cam=icon`, desktop);
  for (const v of ['a', 'b', 'c']) await shoot(`light-${v}.png`, `ball=b&icon=a&light=${v}`, desktop);
}
await browser.close();
await writeFile(resolve(out, quick ? 'capture-quick.json' : 'capture.json'), JSON.stringify({ errors, shots }, null, 2));
console.log(JSON.stringify({ errors, files: Object.keys(shots) }, null, 2));
