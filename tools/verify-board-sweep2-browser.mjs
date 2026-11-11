import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../drafts/3d-web');
const out = resolve(root, '../../../review-board2');
await mkdir(out, { recursive: true });
const url = `${pathToFileURL(resolve(root, 'dist-board2/index.html')).href}?mode=board`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const consoleErrors = [], pageErrors = [], externalRequests = [], screenshots = {}, turns = [];
const startTime = Date.now();
async function instrument(context) {
  await context.route(/^https?:/, route => { externalRequests.push(route.request().url()); return route.abort(); });
  context.on('page', page => {
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', error => pageErrors.push(error.message));
  });
}
async function capture(page, name) {
  const path = resolve(out, name); await page.screenshot({ path, fullPage: false });
  screenshots[name] = { path, sha256: createHash('sha256').update(await readFile(path)).digest('hex'),
    state: await page.evaluate(() => { const s = window.boardEvidence.snapshot(); return { tick: s.game.tick, board: s.game.board, shots: s.game.shots }; }) };
}
const state = page => page.evaluate(() => window.boardEvidence.snapshot().game);
async function until(page, phase) {
  await page.waitForFunction(phase => { const s = window.boardEvidence.snapshot().game; return s.status !== 'playing' || s.board.phase === phase; }, phase, { timeout: 15000, polling: 16 });
}
let result = {};
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await instrument(context); const page = await context.newPage();
  await page.goto(url); await page.waitForSelector('#board-scene[data-ready=true]');
  await page.locator('#board-seed').fill('20261111'); await page.locator('#board-start').click();
  let surgeCaptured = false, desktopCaptured = false;
  while ((await state(page)).status === 'playing') {
    assert.ok(Date.now() - startTime < 600000, '整局超過 10 分鐘，應明確回報逾時');
    await until(page, 'roll'); if ((await state(page)).status !== 'playing') break;
    const before = await state(page);
    if (turns.length % 2 === 0) await page.locator('#board-roll').click();
    else { await page.locator('#board-scene').focus(); await page.keyboard.press('Space'); }
    await until(page, 'effect');
    const landed = await state(page);
    turns.push({ turn: landed.board.turn, die: landed.board.die, position: landed.board.position, shots: landed.board.shotsLeft, bossClock: landed.board.bossClock });
    if (!surgeCaptured && before.balls.length && [1, 4, 6, 9, 12].includes(landed.board.position)) {
      await capture(page, 'board2-surge.png'); surgeCaptured = true;
    }
    await until(page, 'shooting');
    while ((await state(page)).status === 'playing' && (await state(page)).board.phase === 'shooting') {
      await page.waitForFunction(() => !document.querySelector('#board-fire').disabled || window.boardEvidence.snapshot().game.status !== 'playing', null, { polling: 16 });
      const s = await state(page); if (s.status !== 'playing') break;
      const angle = Math.round(-90 + Math.sin(s.shots * 2) * 51);
      await page.locator('#board-angle').fill(String(angle));
      await page.locator('#board-fire').click();
      if (!desktopCaptured && (await state(page)).shots >= 2) { await capture(page, 'board2-desktop.png'); desktopCaptured = true; }
    }
    console.log(`回合 ${landed.board.turn}，骰子 ${landed.board.die}，落格 ${landed.board.position}`);
  }
  const desktopFinal = await page.evaluate(() => window.boardEvidence.snapshot());
  assert.ok(['won', 'lost'].includes(desktopFinal.game.status), '必須自然抵達勝或敗');
  assert.ok(surgeCaptured, '需要實際 SURGE 截圖');
  const desktopLayout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth, result: document.querySelector('#board-result').textContent }));
  assert.equal(desktopLayout.overflow, false);
  // 終局禁止續射；重來回到同 seed、空棋盤、Boss 鐘 0。
  await page.keyboard.press('Space'); assert.deepEqual(await state(page), desktopFinal.game);
  await page.locator('#board-restart').click();
  const reset = await state(page);
  assert.equal(reset.status, 'ready'); assert.equal(reset.board.bossClock, 0); assert.equal(reset.board.turn, 0); assert.equal(reset.balls.length, 0); assert.equal(reset.seed, 20261111);
  // 沒有 mode 參數時啟動即時呈現與預設規則。
  await page.goto(url.split('?')[0]); await page.waitForSelector('#scene[data-ready=true]');
  assert.equal(await page.evaluate(() => !!window.boardEvidence), false);
  await page.locator('#start').click(); await page.locator('#scene').focus(); await page.keyboard.press('Space');
  await page.waitForFunction(() => window.studyEvidence.snapshot().game.shots === 1);
  const realtime = await page.evaluate(() => ({ shots: window.studyEvidence.snapshot().game.shots, boardAbsent: !('board' in window.studyEvidence.snapshot().game), overflow: document.documentElement.scrollWidth > innerWidth }));
  await context.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await instrument(mobileContext); const mobile = await mobileContext.newPage();
  await mobile.goto(url); await mobile.waitForSelector('#board-scene[data-ready=true]');
  await mobile.locator('#board-seed').fill('1'); await mobile.locator('#board-start').click(); await mobile.locator('#board-roll').tap();
  await until(mobile, 'shooting');
  const point = await mobile.evaluate(() => window.boardEvidence.project(220, 180));
  const cdp = await mobileContext.newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobile.waitForFunction(() => window.boardEvidence.snapshot().game.shots === 1);
  await capture(mobile, 'board2-mobile.png');
  // 取消觸控不應再發射或留下拖拉狀態。
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.equal((await state(mobile)).shots, 1);
  const mobileLayout = await mobile.evaluate(() => ({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth,
    buttons: [...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height > 0).map(b => ({ text: b.textContent, width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height })),
    shots: window.boardEvidence.snapshot().game.shots, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches }));
  assert.equal(mobileLayout.overflow, false); assert.ok(mobileLayout.buttons.every(b => b.width >= 44 && b.height >= 44));
  await mobileContext.close();
  result = { status: 'PASS', browser: browser.version(), channel: 'msedge', evidence: '本機瀏覽器實際規則／自然 DOM 輸入；手機為 CDP 合成觸控，非實機', url,
    durationSeconds: (Date.now() - startTime) / 1000, consoleErrors, pageErrors, externalRequests, turns, screenshots, desktopLayout, mobileLayout, realtime, reset: { status: reset.status, board: reset.board }, desktopFinal };
  assert.deepEqual(consoleErrors, []); assert.deepEqual(pageErrors, []); assert.deepEqual(externalRequests, []);
  console.log(JSON.stringify({ status: result.status, outcome: desktopFinal.game.status, turns: turns.length, shots: desktopFinal.game.shots, bossClock: desktopFinal.game.board.bossClock, consoleErrors, pageErrors, externalRequests, screenshots: Object.keys(screenshots) }, null, 2));
} catch (error) {
  result = { ...result, status: 'FAIL', error: String(error), consoleErrors, pageErrors, externalRequests, turns, screenshots }; throw error;
} finally {
  await writeFile(resolve(out, 'sweep2-browser-verification.json'), JSON.stringify(result, null, 2)); await browser.close();
}
