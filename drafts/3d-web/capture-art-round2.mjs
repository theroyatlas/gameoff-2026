// 美術第二輪三組並排截圖：同一 seed、同一推進節奏（?lab=1 的 fastForward），只換網址參數。
// preview() 只把累加數字或抽卡展示停在固定一刻，不改規則、RNG 或遊戲時鐘。
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = import.meta.dirname, out = resolve(root, '../../../review-art-round2'), raw = resolve(out, 'raw');
const html = resolve(root, 'dist-art-round2/index.html');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(raw, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const report = { buildSha256: sha(await readFile(html)), seed: 20261111, shots: 22, files: [], errors: { console: [], page: [], external: [] }, states: [] };
const DEVICES = [['desktop', 1280, 720], ['mobile', 390, 844]];
const GROUPS = {
  ui: { query: v => `ui=${v}`, preview: { tally: { chain: 4, value: 286 } } },
  cage: { query: v => `cage=${v}&cam=field`, preview: {} },
  card: { query: v => `card=${v}`, preview: { card: { index: 3, t: .8, target: 12 } } },
};
async function open(width, height, query) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
  await context.route(/^https?:/, r => { report.errors.external.push(r.request().url()); return r.abort(); });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') report.errors.console.push(m.text()); });
  page.on('pageerror', e => report.errors.page.push(e.message));
  await page.goto(`${pathToFileURL(html).href}?lab=1&${query}`); await page.waitForSelector('#board-scene[data-ready=true]');
  return { context, page };
}
try {
  for (const [device, width, height] of DEVICES) {
    for (const [group, spec] of Object.entries(GROUPS)) {
      const states = [];
      for (const v of ['a', 'b', 'c']) {
        const { context, page } = await open(width, height, spec.query(v));
        const ff = await page.evaluate(([s, seed]) => window.boardLab.fastForward(s, seed), [report.shots, report.seed]);
        await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
        const pv = await page.evaluate(o => window.boardLab.preview(o), spec.preview);
        await page.waitForTimeout(250); await page.evaluate(o => window.boardLab.preview(o), spec.preview);
        const state = sha(JSON.stringify(await page.evaluate(() => window.boardEvidence.snapshot().game)));
        const cardRect = await page.evaluate(() => { const r = document.querySelector('.event-reveal:not([hidden]) .er-card')?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; });
        const cagesOnScreen = await page.evaluate(() => window.boardEvidence.snapshot().game.monsters.map(m => window.boardEvidence.project(m.x, m.y, .2)));
        states.push(state);
        const file = resolve(raw, `${group}-${v}-${device}.png`); await page.screenshot({ path: file });
        report.files.push({ file: `raw/${group}-${v}-${device}.png`, sha256: sha(await readFile(file)), fastForward: ff, preview: pv, stateSha: state, cagesOnScreen, cardRect });
        if (group === 'card' && v === 'a') {
          for (const fv of ['a', 'b', 'c']) {
            const urls = await page.evaluate(x => window.boardLab.faces(x), fv);
            for (const [i, u] of urls.entries()) await writeFile(resolve(raw, `face-${fv}-${i}.png`), Buffer.from(u.split(',')[1], 'base64'));
          }
        }
        await context.close();
      }
      if (new Set(states).size !== 1) throw new Error(`${group}/${device} 三版盤面不同`);
      report.states.push({ group, device, stateSha: states[0] });
    }
  }
} finally { await browser.close(); await writeFile(resolve(raw, 'capture.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ errors: report.errors, states: report.states }));
if (Object.values(report.errors).some(a => a.length)) process.exitCode = 1;
