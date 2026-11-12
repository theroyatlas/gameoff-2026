import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const out = resolve(import.meta.dirname, '../../../review-closeup-ab');
const sha = v => createHash('sha256').update(v).digest('hex');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { method: 'NATURAL_RULES_SAME_BOARD_PRESENTATION_ONLY', seed: 20261112, shots: [], errors: [] };
try {
  for (const [name, width, height] of [['desktop', 1280, 720], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce', isMobile: width < 600, hasTouch: width < 600 });
    await context.route(/^https?:/, r => { report.errors.push('external request'); return r.abort(); });
    const page = await context.newPage();
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(pathToFileURL(resolve(import.meta.dirname, 'dist-closeup-ab/index.html')).href + '?lab=1');
    await page.waitForSelector('#board-scene[data-ready=true]');
    await page.evaluate(seed => window.boardLab.fastForward(90, seed), report.seed);
    const state = await page.evaluate(() => window.boardEvidence.snapshot().game), hash = sha(JSON.stringify(state));
    await writeFile(resolve(out, `${name}-board-state.json`), JSON.stringify(state));
    for (const camera of ['fieldA', 'fieldB', ...(name === 'desktop' ? ['table'] : [])]) {
      const metrics = await page.evaluate(camera => window.boardLab.presentation({ camera }), camera);
      const current = await page.evaluate(() => window.boardEvidence.snapshot().game);
      if (sha(JSON.stringify(current)) !== hash) throw new Error('切換呈現改變規則');
      const file = `${name}-${camera}.png`;
      await page.screenshot({ path: resolve(out, file) });
      report.shots.push({ file, width, height, balls: state.balls.length, stateHash: hash, ...metrics, sha256: sha(await readFile(resolve(out, file))) });
    }
    // 同一個自然盤面比較未加 cam 參數與凍結的 main 產物；不重建舊檔。
    if (name === 'desktop') {
      const current = await readFile(resolve(out, 'desktop-table.png'));
      await page.goto(pathToFileURL(resolve(import.meta.dirname, 'dist-event-cards/index.html')).href + '?lab=1');
      await page.waitForSelector('#board-scene[data-ready=true]');
      await page.evaluate(seed => window.boardLab.fastForward(90, seed), report.seed);
      await page.evaluate(() => window.boardLab.presentation({ camera: 'table' }));
      const baseline = await page.screenshot({ path: resolve(out, 'baseline-table.png') });
      report.defaultImageIdentical = baseline.equals(current);
      report.baselineStateIdentical = sha(JSON.stringify(await page.evaluate(() => window.boardEvidence.snapshot().game))) === hash;
    }
    await context.close();
  }
} finally { await browser.close(); await writeFile(resolve(out, 'capture.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
if (report.errors.length || !report.defaultImageIdentical) process.exitCode = 1;
