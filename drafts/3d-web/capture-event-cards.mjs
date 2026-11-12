// 同一局自然盤面：只切呈現策略與鏡頭。舊策略重放改前全紙籤／全毛線邏輯。
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = import.meta.dirname, out = resolve(root, '../../../review-event-cards');
const html = resolve(root, 'dist-event-cards/index.html');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const report = { buildSha256: sha(await readFile(html)), method: 'NATURAL_RULES_LAB_FASTFORWARD_PRESENTATION_COMPARISON', seed: null, shots: [], errors: [], inspection: [] };
try {
  for (const [name, width, height] of [['desktop', 1280, 720], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce' });
    await context.route(/^https?:/, r => { report.errors.push('external request'); return r.abort(); });
    const page = await context.newPage();
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(pathToFileURL(html).href + '?lab=1'); await page.waitForSelector('#board-scene[data-ready=true]');
    const candidates = report.seed === null ? Array.from({ length: 30 }, (_, i) => 20261111 + i) : [report.seed];
    for (const seed of candidates) {
      const state = await page.evaluate(seed => window.boardLab.fastForward(90, seed), seed);
      if (state.balls >= 70) { report.seed = seed; break; }
    }
    const snapshot = await page.evaluate(() => window.boardEvidence.snapshot().game);
    if (snapshot.balls.length < 70) throw new Error('未達 70 球');
    const snapshotSha = sha(JSON.stringify(snapshot));
    await writeFile(resolve(out, `${name}-board-state.json`), JSON.stringify(snapshot, null, 2));
    for (const [view, options] of [['crowded-before', { legacyDensity: true, camera: 'table' }], ['crowded-after', { legacyDensity: false, camera: 'table' }], ['table', { legacyDensity: false, camera: 'table' }], ['closeup', { legacyDensity: false, camera: 'field' }]]) {
      const metrics = await page.evaluate(o => window.boardLab.presentation(o), options);
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(250);
      const state = await page.evaluate(() => window.boardEvidence.snapshot().game);
      if (sha(JSON.stringify(state)) !== snapshotSha) throw new Error('切換呈現改變盤面');
      const file = `${name}-${view}.png`, path = resolve(out, file); await page.screenshot({ path });
      report.shots.push({ file, viewport: { width, height }, balls: state.balls.length, snapshotSha, sha256: sha(await readFile(path)), ...metrics });
    }
    await page.evaluate(() => window.boardLab.presentation({ camera: 'table' }));
    const ball = snapshot.balls.at(-1);
    const point = await page.evaluate(b => window.boardEvidence.project(b.x, b.y, .14), ball);
    const beforeShots = snapshot.shots;
    if (width < 600) {
      await page.locator('#board-inspect-toggle').tap();
      await page.locator('#board-scene').scrollIntoViewIfNeeded();
      const p = await page.evaluate(b => window.boardEvidence.project(b.x, b.y, .14), ball);
      await page.touchscreen.tap(p.x, p.y);
    } else await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(100);
    const inspected = await page.locator('#board-inspect').textContent();
    const afterShots = await page.evaluate(() => window.boardEvidence.snapshot().game.shots);
    if (!inspected.includes('球 #') || afterShots !== beforeShots) throw new Error('查看球號失敗或誤發射');
    report.inspection.push({ device: name, text: inspected, shotsUnchanged: true });
    await context.close();
  }
} finally { await browser.close(); await writeFile(resolve(out, 'capture.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
if (report.errors.length) process.exitCode = 1;
