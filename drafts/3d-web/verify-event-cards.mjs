// 瀏覽器 DOM 操作到自然結局；Playwright clock 只加速等待，不植入盤面或改規則。
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = import.meta.dirname, out = resolve(root, '../../../review-event-cards');
const html = resolve(root, 'dist-event-cards/index.html'), base = pathToFileURL(html).href;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const errors = { console: [], page: [], external: [] };
async function open(query = '', mobile = false, reduced = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
    deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await context.route(/^https?:/, route => { errors.external.push(route.request().url()); return route.abort(); });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.console.push(m.text()); });
  page.on('pageerror', e => errors.page.push(e.message));
  await page.clock.install(); await page.goto(base + query);
  return { context, page };
}
async function screenshot(page, name) {
  const path = resolve(out, name); await page.screenshot({ path });
  return { file: name, sha256: sha(await readFile(path)) };
}
const boardState = page => page.evaluate(() => {
  const s = window.boardEvidence.snapshot(), g = s.game;
  return { status: g.status, tick: g.tick, shots: g.shots, boss: g.boss, monsters: g.monsters, board: g.board,
    balls: g.balls.length, reduced: s.visual.reduced };
});
async function boardGame(seed, patient, mobile = false, reduced = false) {
  const { context, page } = await open('', mobile, reduced);
  const label = reduced ? 'board-reduced-mobile' : `board-${seed}-${patient ? 'patient' : 'quick'}`;
  await page.waitForSelector('#board-scene[data-ready=true]');
  await page.locator('#board-seed').fill(String(seed)); await page.locator('#board-start').click();
  let nextShot = 0, cardShot = null, state;
  for (let i = 0; i < 3800; i++) {
    state = await boardState(page);
    if (state.status !== 'playing') break;
    if (state.board.cards.length && !cardShot) {
      await page.evaluate(() => window.scrollTo(0, 0));
      cardShot = await screenshot(page, `${label}-event.png`);
      if (mobile) { await page.locator('#board-card').scrollIntoViewIfNeeded(); await screenshot(page, `${label}-event-card.png`); }
    }
    if (state.board.phase === 'roll') {
      await page.locator('#board-roll').dispatchEvent('click'); nextShot = state.tick;
    } else if (state.board.phase === 'shooting' && state.tick >= nextShot && !await page.locator('#board-fire').isDisabled()) {
      const target = !patient && state.monsters.length ? state.monsters.reduce((a, b) => a.hp < b.hp ? a : b) : state.boss;
      const deg = Math.round(Math.max(-165, Math.min(-15, Math.atan2(Math.min(-20, target.y - 622), target.x - 400) * 180 / Math.PI)));
      await page.locator('#board-angle').fill(String(deg));
      await page.locator('#board-fire').dispatchEvent('click'); nextShot = state.tick + (patient ? 240 : 30);
    }
    await page.clock.fastForward(250);
    if (i % 300 === 0) console.log(JSON.stringify({ label, turn: state.board.turn, tick: state.tick, hp: state.boss.hp }));
  }
  state = await boardState(page); await page.evaluate(() => window.scrollTo(0, 0));
  const result = { label, seed, patient, ...state, screenshot: await screenshot(page, `outcome-${label}.png`), cardShot,
    cardText: await page.locator('#board-card').textContent(), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) };
  await context.close(); console.log(JSON.stringify({ label, status: state.status, turns: state.board.turn, balls: state.balls })); return result;
}
async function realtimeGame() {
  const { context, page } = await open('?mode=realtime');
  await page.waitForSelector('#scene[data-ready=true]'); await page.locator('#start').click();
  let state;
  for (let i = 0; i < 3000; i++) {
    state = await page.evaluate(() => { const g = window.studyEvidence.snapshot().game; return { status: g.status, tick: g.tick, shots: g.shots, bossHp: g.boss.hp, monsters: g.monsters.length }; });
    if (state.status !== 'playing') break;
    if (i % 8 === 0) { await page.locator('#scene').focus(); await page.keyboard.press(i % 3 ? 'ArrowRight' : 'ArrowLeft'); await page.keyboard.press('Space'); }
    await page.clock.fastForward(250);
  }
  const result = { ...state, screenshot: await screenshot(page, 'outcome-realtime.png') };
  await context.close(); console.log(JSON.stringify({ realtime: state })); return result;
}
const resume = process.argv.includes('--complete-board');
const result = resume ? JSON.parse(await readFile(resolve(out, 'browser-verification.json'), 'utf8'))
  : { buildSha256: sha(await readFile(html)), method: 'LIVE_BROWSER_DOM_INPUT_WITH_ACCELERATED_CLOCK', board: [], realtime: null, reduced: null, errors };
if (result.buildSha256 !== sha(await readFile(html))) throw new Error('不可混合不同建置的驗證');
if (resume) for (const key of Object.keys(errors)) errors[key].push(...result.errors[key]);
result.errors = errors;
try {
  const plan = resume ? Array.from({ length: 30 }, (_, i) => [20261111 + i, false]).filter(([seed, patient]) => !result.board.some(r => r.seed === seed && r.patient === patient))
    : [[20261111, true], [20261112, false], [20261113, true], [20261114, true], [20261115, false], [20261116, true]];
  for (const [seed, patient] of plan) {
    if (result.board.some(r => r.status === 'won') && result.board.some(r => r.status === 'lost')) break;
    result.board.push(await boardGame(seed, patient));
    await writeFile(resolve(out, 'browser-verification.json'), JSON.stringify(result, null, 2));
    if (result.board.some(r => r.status === 'won') && result.board.some(r => r.status === 'lost')) break;
  }
  if (!resume) {
    result.realtime = await realtimeGame();
    result.reduced = await boardGame(20261111, false, true, true);
  }
  result.pass = result.board.some(r => r.status === 'won') && result.board.some(r => r.status === 'lost')
    && ['won', 'lost'].includes(result.realtime.status) && ['won', 'lost'].includes(result.reduced.status)
    && result.reduced.reduced && result.reduced.board.cards.length > 0 && Object.values(errors).every(a => a.length === 0);
} finally {
  await browser.close(); await writeFile(resolve(out, 'browser-verification.json'), JSON.stringify(result, null, 2));
}
console.log(JSON.stringify({ pass: result.pass, errors }));
if (!result.pass) process.exitCode = 1;
