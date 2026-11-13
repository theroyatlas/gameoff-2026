// 籠內三版並排截圖：同一 seed、同一推進節奏（?lab=1 的 fastForward），全部用預設組合與整桌鏡頭，只換 ?inside=。
// 反應對照用 cagePose() 把某一隻怪物的籠內姿勢停在固定一刻，並把鏡頭對準它；只改呈現，不改規則、RNG 或遊戲時鐘。
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = import.meta.dirname, out = resolve(root, '../../../review-cage-inside'), raw = resolve(out, 'raw');
const html = resolve(root, 'dist-cage-inside/index.html');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(raw, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const report = { buildSha256: sha(await readFile(html)), seed: 20261111, shots: 22, files: [], reactions: [], errors: { console: [], page: [], external: [] }, states: [] };
const DEVICES = [['desktop', 1280, 720], ['mobile', 390, 844]];
async function open(width, height, query) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
  await context.route(/^https?:/, r => { report.errors.external.push(r.request().url()); return r.abort(); });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') report.errors.console.push(m.text()); });
  page.on('pageerror', e => report.errors.page.push(e.message));
  await page.goto(`${pathToFileURL(html).href}?lab=1${query ? `&${query}` : ''}`); await page.waitForSelector('#board-scene[data-ready=true]');
  return { context, page };
}
const ff = page => page.evaluate(([s, seed]) => window.boardLab.fastForward(s, seed), [report.shots, report.seed]);
try {
  // 1) 整桌鏡頭並排：預設（不加參數）＋ a、b、c。
  for (const [device, width, height] of DEVICES) {
    const states = [];
    for (const v of ['none', 'a', 'b', 'c']) {
      const { context, page } = await open(width, height, v === 'none' ? '' : `inside=${v}`);
      const run = await ff(page);
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
      const snap = await page.evaluate(() => window.boardEvidence.snapshot());
      const state = sha(JSON.stringify(snap.game)); states.push(state);
      const cagesOnScreen = await page.evaluate(() => window.boardEvidence.snapshot().game.monsters.map(m => ({ id: m.id, hp: m.hp, maxHp: m.maxHp, ...window.boardEvidence.project(m.x, m.y, .2) })));
      const file = resolve(raw, `inside-${v}-${device}.png`); await page.screenshot({ path: file });
      report.files.push({ file: `raw/inside-${v}-${device}.png`, sha256: sha(await readFile(file)), fastForward: run, stateSha: state, inside: snap.visual.inside, art: snap.visual.art, choice: snap.visual.choice, cagesOnScreen });
      await context.close();
    }
    if (new Set(states).size !== 1) throw new Error(`${device} 四版盤面不同`);
    report.states.push({ device, stateSha: states[0] });
  }
  // 2) 反應對照：同一隻怪物、對準它的近景；一般動態四個時刻，減少動態三個時刻。
  const POSES = [
    ['idle', { hp: 1 }], ['hit', { hp: .6, hitAgo: .07 }], ['low', { hp: .2 }], ['defeat', { hp: 0, defeatAgo: .55 }],
  ];
  for (const motion of ['full', 'reduce']) {
    for (const v of ['a', 'b', 'c']) {
      const { context, page } = await open(1280, 720, `inside=${v}${motion === 'reduce' ? '&motion=reduce' : ''}`);
      await ff(page); await page.evaluate(() => window.scrollTo(0, 0));
      for (const [name, pose] of POSES) {
        if (motion === 'reduce' && name === 'idle') continue;
        const info = await page.evaluate(([p]) => window.boardLab.cagePose(0, p, true), [pose]);
        await page.waitForTimeout(120); await page.evaluate(([p]) => window.boardLab.cagePose(0, p, false), [pose]);
        const box = await page.evaluate(() => { const r = document.getElementById('board-scene').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
        const clip = { x: Math.round(box.x + box.width / 2 - 170), y: Math.round(box.y + box.height / 2 - 150), width: 340, height: 300 };
        const file = resolve(raw, `react-${v}-${motion}-${name}.png`); await page.screenshot({ path: file, clip });
        report.reactions.push({ file: `raw/react-${v}-${motion}-${name}.png`, sha256: sha(await readFile(file)), pose, monster: info });
      }
      await context.close();
    }
  }
} finally { await browser.close(); await writeFile(resolve(raw, 'capture.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ errors: report.errors, states: report.states, build: report.buildSha256 }));
if (Object.values(report.errors).some(a => a.length)) process.exitCode = 1;
