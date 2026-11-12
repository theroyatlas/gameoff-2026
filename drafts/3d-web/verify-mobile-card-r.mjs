import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const out = resolve(import.meta.dirname, '../../../review-mobile-card-r');
await mkdir(out, { recursive: true });
const sha = v => createHash('sha256').update(v).digest('hex');
const capturesOnly = process.argv.includes('--captures-only');
const previous = capturesOnly ? JSON.parse(await readFile(resolve(out, 'browser-verification.json'), 'utf8')) : null;
const report = { method: 'Edge DOM input, controlled RAF; no rule state writes', seed: 20261113, runs: previous?.runs ?? [], captures: [], skips: previous?.skips ?? [] };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
async function open(build, query, mobile = true, reduced = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const errors = { console: [], page: [], external: [] };
  await context.route(/^https?:/, r => { errors.external.push(r.request().url()); return r.abort(); });
  const page = await context.newPage();
  page.on('console', m => errors.console.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => errors.page.push(e.message));
  await page.addInitScript(() => {
    let now = 0, next = 0; const callbacks = new Map();
    performance.now = () => now;
    window.requestAnimationFrame = cb => { callbacks.set(++next, cb); return next; };
    window.cancelAnimationFrame = id => callbacks.delete(id);
    window.__advanceFrame = ms => { now += ms; const due = [...callbacks.values()]; callbacks.clear(); for (const cb of due) cb(now); };
    window.__play = { nextShot: 0 };
  });
  const html = resolve(import.meta.dirname, build, 'index.html');
  await page.goto(pathToFileURL(html).href + query);
  await page.waitForSelector('#board-scene[data-ready=true]');
  await page.locator('#board-seed').fill(String(report.seed));
  await page.locator('#board-start').click();
  await page.evaluate(() => window.__advanceFrame(16));
  return { context, page, errors, buildSha256: sha(await readFile(html)) };
}
async function advanceGame(page, stopAtCard = false) {
  return page.evaluate(stopAtCard => {
    for (let i = 0; i < 90; i++) {
      let g = window.boardEvidence.snapshot().game;
      if (g.status !== 'playing') break;
      if (stopAtCard && document.querySelector('.event-reveal') && !document.querySelector('.event-reveal').hidden) break;
      // 點擊跳過是新功能；整局回歸讓展示自行播完再操作。
      const reveal = document.querySelector('.event-reveal');
      if (reveal && !reveal.hidden) { window.__advanceFrame(100); continue; }
      if (g.board.phase === 'roll') { document.querySelector('#board-roll').click(); window.__play.nextShot = g.tick; }
      g = window.boardEvidence.snapshot().game;
      if (g.board.phase === 'shooting' && g.tick >= window.__play.nextShot) {
        const slider = document.querySelector('#board-angle'); slider.value = '-90'; slider.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('#board-fire').click(); window.__play.nextShot = g.tick + 240;
      }
      g = window.boardEvidence.snapshot().game;
      const until = ['rolling', 'moving', 'effect', 'settling'].includes(g.board.phase) ? g.board.phaseUntil : window.__play.nextShot;
      window.__advanceFrame(Math.min(30, Math.max(1, until - g.tick)) * 1000 / 120 + .00001);
    }
    const s = window.boardEvidence.snapshot();
    return { status: s.game.status, tick: s.game.tick, shots: s.game.shots, cards: s.visual.cardReveals, active: !document.querySelector('.event-reveal')?.hidden };
  }, stopAtCard);
}
async function firstCard(page) {
  for (let i = 0; i < 60; i++) { const s = await advanceGame(page, true); if (s.active) return; assert.equal(s.status, 'playing'); }
  throw new Error('No naturally drawn event card');
}
async function age(page, ms) { await page.evaluate(ms => { while (ms > 0) { const d = Math.min(ms, 100); window.__advanceFrame(d); ms -= d; } }, ms); }
async function geometry(page) {
  return page.evaluate(() => {
    const mobile = document.querySelector('.mobile-card-slot'), slot = document.querySelector('#board-card-face'), root = document.querySelector('.event-reveal');
    const rect = e => e?.getBoundingClientRect().toJSON();
    return { viewport: [innerWidth, innerHeight], revealActive: !root.hidden, phase: root.dataset.phase, mobileSlot: rect(mobile), mobileVisible: !!mobile && !mobile.hidden && getComputedStyle(mobile).display !== 'none', slot: rect(slot), bonus: rect(document.querySelector('#board-bonus')), cardText: rect(document.querySelector('#board-card')), overflow: document.documentElement.scrollWidth > innerWidth, stamp: root.querySelector('.er-stamp').textContent };
  });
}
function clean(errors) { assert.deepEqual(errors, { console: [], page: [], external: [] }); }
try {
  if (!capturesOnly) for (const [build, query, mobile, reduced] of [
    ['dist-mobile-card-r', '?cam=fieldA&card=a', false, false],
    ['dist-mobile-card-r', '?cam=fieldB&ui=b&cage=b&card=a', false, false],
    ...['a'].map(c => ['dist-mobile-card-r', `?card=${c}`, true, false]),
    ['dist-mobile-card-r', '?card=a', true, true],
  ]) {
    const { page, context, errors, buildSha256 } = await open(build, query, mobile, reduced);
    let state;
    for (let i = 0; i < 100; i++) { state = await advanceGame(page); if (state.status !== 'playing') break; }
    assert.ok(['won', 'lost'].includes(state.status)); clean(errors);
    const snap = await page.evaluate(() => window.boardEvidence.snapshot());
    report.runs.push({ build, query, mobile, reduced, buildSha256, ...state, hash: sha(JSON.stringify(snap.game)), art: snap.visual.art, ballPx: snap.visual.ballPx, errors });
    console.log('full game', query, reduced, state.status, state.tick);
    await context.close();
  }
  // 同一自然抽卡、同一展示時刻；額外保留桌機改前圖，供逐像素比較。
  for (const [build, mobile, prefix] of [
    ['../../../review-mobile-card-r/main-build', true, 'mobile-before'], ['dist-mobile-card-r', true, 'mobile-after'],
    ['../../../review-mobile-card-r/main-build', false, 'desktop-before'], ['dist-mobile-card-r', false, 'desktop-after'],
  ]) {
    const { page, context, errors } = await open(build, '?card=a', mobile);
    await firstCard(page); await age(page, 1100); await page.evaluate(() => scrollTo(0, 0));
    const midpoint = await geometry(page); assert.ok(midpoint.revealActive); assert.equal(midpoint.stamp, '抽到');
    const file = `${prefix}-mid.png`; await page.screenshot({ path: resolve(out, file) });
    report.captures.push({ file, time: 1.1, ...midpoint, gameHash: sha(JSON.stringify(await page.evaluate(() => window.boardEvidence.snapshot().game))) });
    await age(page, 1200);
    await page.evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0; } });
    const end = await geometry(page); assert.equal(end.revealActive, false);
    const endFile = `${prefix}-end.png`;
    await page.screenshot({ path: resolve(out, endFile) });
    report.captures.push({ file: endFile, time: 2.3, ...end, gameHash: sha(JSON.stringify(await page.evaluate(() => window.boardEvidence.snapshot().game))) });
    if (mobile && prefix === 'mobile-after') {
      assert.equal(end.mobileVisible, false); assert.equal(end.slot.width, 60);
      assert.ok(end.slot.top >= end.bonus.bottom && end.slot.right <= end.cardText.left);
      assert.ok(end.slot.bottom <= 844);
    }
    clean(errors); await context.close();
  }
  if (!capturesOnly) for (const reduced of [false, true]) for (const input of ['tap', 'Space', 'Enter']) {
    const { page, context, errors } = await open('dist-mobile-card-r', '?card=a', true, reduced);
    await firstCard(page); await age(page, 200); await page.evaluate(() => scrollTo(0, 0));
    const before = await page.evaluate(() => window.boardEvidence.snapshot().game);
    if (input === 'tap') { const r = await page.locator('#board-scene').boundingBox(); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); }
    else { await page.locator('#board-scene').focus(); await page.keyboard.press(input); }
    const after = await page.evaluate(() => window.boardEvidence.snapshot().game); assert.deepEqual(after, before);
    const state = await geometry(page); assert.equal(state.revealActive, false); assert.equal(state.mobileVisible, false); assert.equal(state.slot.width, 60);
    await age(page, 2300); assert.equal((await geometry(page)).revealActive, false); clean(errors);
    report.skips.push({ reduced, input, rulesUnchanged: true, completed: true, errors }); await context.close();
  }
  assert.equal(sha(await readFile(resolve(out, 'desktop-before-mid.png'))), sha(await readFile(resolve(out, 'desktop-after-mid.png'))), 'Desktop midpoint PNG');
  assert.equal(sha(await readFile(resolve(out, 'desktop-before-end.png'))), sha(await readFile(resolve(out, 'desktop-after-end.png'))), 'Desktop end PNG');
  assert.notEqual(sha(await readFile(resolve(out, 'mobile-before-end.png'))), sha(await readFile(resolve(out, 'mobile-after-end.png'))));
  report.desktopMidpointPixelIdentical = true; report.desktopEndPixelIdentical = true; report.mobileEndHashesDifferent = true;
  for (const c of report.captures) c.sha256 = sha(await readFile(resolve(out, c.file)));
  report.pass = true;
} finally {
  await browser.close(); await writeFile(resolve(out, 'browser-verification.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ pass: report.pass, runs: report.runs.length, skips: report.skips.length, desktopMidpointPixelIdentical: report.desktopMidpointPixelIdentical }));
