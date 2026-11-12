import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const out = resolve(import.meta.dirname, '../../../review-closeup-ab');
const html = resolve(import.meta.dirname, 'dist-closeup-ab/index.html');
const sha = v => createHash('sha256').update(v).digest('hex');
const report = { method: 'EDGE_DOM_FULL_GAMES_CONTROLLED_RAF', seed: 20261113,
  buildSha256: sha(await readFile(html)), runs: [], inputChecks: [], errors: { console: [], page: [], external: [] } };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let baseline = null;
try {
  for (const query of ['', '?cam=fieldA', '?cam=fieldB', '?cam=fieldB&motion=reduce']) {
    const mobile = query.includes('reduce');
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
    await context.route(/^https?:/, r => { report.errors.external.push(r.request().url()); return r.abort(); });
    const page = await context.newPage();
    page.on('console', m => report.errors.console.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', e => report.errors.page.push(e.message));
    await page.addInitScript(() => {
      let now = 0, next = 0;
      const callbacks = new Map();
      performance.now = () => now;
      window.requestAnimationFrame = cb => { callbacks.set(++next, cb); return next; };
      window.cancelAnimationFrame = id => callbacks.delete(id);
      window.__advanceFrame = ms => {
        now += ms; const due = [...callbacks.values()]; callbacks.clear();
        for (const cb of due) cb(now);
      };
      window.__play = { nextShot: 0, checkpoints: [] };
    });
    await page.goto(pathToFileURL(html).href + query);
    await page.waitForSelector('#board-scene[data-ready=true]');
    await page.locator('#board-seed').fill(String(report.seed));
    await page.locator('#board-start').click();
    let final;
    for (let batch = 0; batch < 80; batch++) {
      final = await page.evaluate(() => {
        const state = window.__play;
        for (let i = 0; i < 60; i++) {
          let g = window.boardEvidence.snapshot().game;
          if (g.status !== 'playing') break;
          if (g.board.phase === 'roll') { document.querySelector('#board-roll').click(); state.nextShot = g.tick; }
          g = window.boardEvidence.snapshot().game;
          if (g.board.phase === 'shooting' && g.tick >= state.nextShot) {
            const slider = document.querySelector('#board-angle'); slider.value = '-90'; slider.dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#board-fire').click(); state.nextShot = g.tick + 240;
          }
          g = window.boardEvidence.snapshot().game;
          const until = ['rolling', 'moving', 'effect', 'settling'].includes(g.board.phase) ? g.board.phaseUntil : state.nextShot;
          const ticks = Math.min(30, Math.max(1, until - g.tick));
          window.__advanceFrame(ticks * 1000 / 120 + .00001);
        }
        return window.boardEvidence.snapshot();
      });
      if (batch % 10 === 0) console.log(`${query || 'table'} tick ${final.game.tick} / ${final.game.status}`);
      if (final.game.status !== 'playing') break;
    }
    if (!['won', 'lost'].includes(final.game.status)) throw new Error('未到自然終局');
    await page.evaluate(() => window.__advanceFrame(16));
    const stateHash = sha(JSON.stringify(final.game));
    baseline ??= stateHash;
    if (stateHash !== baseline) throw new Error(`鏡頭改變完整規則盤面：${query}`);
    const name = query.includes('reduce') ? 'reduced-mobile' : query.split('=')[1] || 'table';
    await writeFile(resolve(out, `played-${name}.json`), JSON.stringify(final.game));
    await page.screenshot({ path: resolve(out, `played-${name}.png`) });
    report.runs.push({ query, mobile, status: final.game.status, tick: final.game.tick, shots: final.game.shots, stateHash,
      matchedDefault: stateHash === baseline, reduced: final.visual.reduced, sounds: final.sounds.played });
    // 真實滑鼠／觸控手勢與鍵盤另測，與固定輸入比對局分開。
    if (query) {
      await page.locator('#board-restart').click(); await page.locator('#board-start').click();
      await page.evaluate(() => window.__advanceFrame(16));
      await page.locator('#board-roll').click();
      await page.evaluate(() => {
        for (let i = 0; i < 30 && window.boardEvidence.snapshot().game.board.phase !== 'shooting'; i++) window.__advanceFrame(100);
      });
      await page.locator('#board-scene').scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => window.boardEvidence.snapshot().game.shots);
      const point = await page.evaluate(() => window.boardEvidence.project(455, 430));
      if (mobile) await page.touchscreen.tap(point.x, point.y);
      else { await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.x + 6, point.y - 4); await page.mouse.up(); }
      await page.evaluate(() => window.__advanceFrame(250));
      await page.locator('#board-scene').focus(); await page.keyboard.press('ArrowRight');
      await page.evaluate(() => window.__advanceFrame(16));
      const hint = await page.locator('#board-closeup-aim').textContent();
      await page.keyboard.press('Space');
      await page.evaluate(() => window.__advanceFrame(16));
      const after = await page.evaluate(() => window.boardEvidence.snapshot().game);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      const expected = Math.atan2(-192, 55), actual = after.inputs[0]?.angle;
      if (after.shots !== before + 2 || overflow || !hint.includes('發射方向') || Math.abs(actual - expected) > .15) throw new Error('近景輸入／提示驗證失敗');
      await page.screenshot({ path: resolve(out, `aim-${name}.png`) });
      report.inputChecks.push({ query, pointer: mobile ? 'touch' : 'mouse-drag', keyboard: true, shots: after.shots, actual, expected, hint, overflow });
    }
    await context.close();
  }
  report.pass = report.runs.length === 4 && report.runs.every(r => r.matchedDefault) && Object.values(report.errors).every(a => !a.length);
} finally { await browser.close(); await writeFile(resolve(out, 'browser-verification.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
if (!report.pass) process.exitCode = 1;
