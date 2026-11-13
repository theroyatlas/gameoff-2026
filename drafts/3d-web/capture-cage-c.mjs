// 紙摺怪手機可讀性對照：同一 seed、同一推進節奏（?lab=1 的 fastForward）、同一假時鐘，390×844 整桌鏡頭拍一張，
// 再把同一張截圖裡的每隻怪物籠局部放大 3 倍（最近鄰取樣，不重繪）。只改呈現，不改規則、RNG 或遊戲時鐘。
// 用法：node capture-cage-c.mjs <label> [query]，例如 node capture-cage-c.mjs before inside=c
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const [label = 'after', query = ''] = process.argv.slice(2);
const root = import.meta.dirname, out = resolve(root, '../../../review-cage-c/compare');
const html = resolve(root, 'dist-cage-c/index.html');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const errors = { console: [], page: [], external: [] };
const SEED = 20261111, SHOTS = 22, ZOOM = 3, CROP = { w: 84, h: 72 };
const report = { label, query, buildSha256: sha(await readFile(html)), seed: SEED, shots: SHOTS, viewport: '390x844', files: [], errors };
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await context.route(/^https?:/, r => { errors.external.push(r.request().url()); return r.abort(); });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.console.push(m.text()); });
  page.on('pageerror', e => errors.page.push(e.message));
  // 假時鐘固定起點，前後兩版的籠子轉角與耳朵擺動都停在同一刻。
  await page.clock.install({ time: new Date('2026-11-13T00:00:00Z') });
  await page.goto(`${pathToFileURL(html).href}?lab=1${query ? `&${query}` : ''}`);
  await page.waitForSelector('#board-scene[data-ready=true]');
  report.fastForward = await page.evaluate(([s, seed]) => window.boardLab.fastForward(s, seed), [SHOTS, SEED]);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.clock.runFor(1500);
  const snap = await page.evaluate(() => window.boardEvidence.snapshot());
  report.stateSha = sha(JSON.stringify(snap.game)); report.inside = snap.visual.inside; report.art = snap.visual.art; report.choice = snap.visual.choice;
  const cages = await page.evaluate(() => window.boardEvidence.snapshot().game.monsters.map(m => ({ id: m.id, ...window.boardEvidence.project(m.x, m.y, .2) })));
  report.cagesOnScreen = cages;
  const full = resolve(out, `${label}-mobile-full.png`); await page.screenshot({ path: full });
  const fullBytes = await readFile(full); report.files.push({ file: `compare/${label}-mobile-full.png`, sha256: sha(fullBytes) });
  // 局部放大：在空白頁用 canvas 最近鄰放大同一張截圖的籠子區域。
  const zoomPage = await context.newPage();
  const dataUrl = await zoomPage.evaluate(async ([src, cages, crop, zoom]) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'), gap = 6; c.width = cages.length * crop.w * zoom + (cages.length - 1) * gap; c.height = crop.h * zoom;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#120b06'; x.fillRect(0, 0, c.width, c.height);
    cages.forEach((m, i) => x.drawImage(img, Math.round(m.x - crop.w / 2), Math.round(m.y - crop.h * .6), crop.w, crop.h, i * (crop.w * zoom + gap), 0, crop.w * zoom, crop.h * zoom));
    return c.toDataURL('image/png');
  }, [`data:image/png;base64,${fullBytes.toString('base64')}`, cages, CROP, ZOOM]);
  const zoom = resolve(out, `${label}-mobile-zoom3x.png`); await writeFile(zoom, Buffer.from(dataUrl.split(',')[1], 'base64'));
  report.files.push({ file: `compare/${label}-mobile-zoom3x.png`, sha256: sha(await readFile(zoom)), crop: CROP, zoom: ZOOM });
  await context.close();
} finally { await browser.close(); await writeFile(resolve(out, `${label}.json`), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ label, stateSha: report.stateSha, inside: report.inside, files: report.files, errors }));
if (Object.values(errors).some(a => a.length)) process.exitCode = 1;
