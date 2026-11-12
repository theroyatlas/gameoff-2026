// 整局驗證：預設棋盤模式跑到勝局與敗局各一局，?mode=realtime 跑一局；全程只用 DOM 輸入。
// 另跑一段減少動態（手機尺寸）確認沒有錯誤。console error 與 page error 都要是 0。
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const out = resolve(root, '../../../review-polish-board');
await mkdir(out, { recursive: true });
const html = resolve(root, 'dist-polish-board/index.html');
const base = pathToFileURL(html).href;
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const tryClick = async locator => { try { await locator.click({ timeout: 4000 }); return true; } catch { return false; } };
const errors = { console: [], page: [], external: [] };
async function open(viewport, query = '', options = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, ...options });
  await context.route(/^https?:/, route => { errors.external.push(route.request().url()); return route.abort(); });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.console.push(m.text()); });
  page.on('pageerror', e => errors.page.push(e.message));
  await page.goto(`${base}${query}`);
  return { context, page };
}
const snap = page => page.evaluate(() => window.boardEvidence.snapshot());

/** 一局棋盤：瞄準血最少的怪物（沒有怪物就瞄 Boss），能射就射。 */
async function boardGame(seed, label, patient = false, maxTurns = 80) {
  const { context, page } = await open({ width: 1280, height: 720 });
  await page.waitForSelector('#board-scene[data-ready=true]');
  await page.locator('#board-seed').fill(String(seed)); await page.locator('#board-start').click();
  const started = Date.now(); let turns = 0, lastShot = 0;
  while (true) {
    const s = await snap(page);
    if (s.game.status !== 'playing' || turns > maxTurns || Date.now() - started > 9 * 60000) break;
    const board = s.game.board;
    if (board.phase === 'roll') { turns++; if (turns % 2) await tryClick(page.locator('#board-roll')); else { await page.locator('#board-scene').focus(); await page.keyboard.press('Space'); } }
    else if (board.phase === 'shooting' && !(await page.locator('#board-fire').isDisabled()) && (!patient || Date.now() - lastShot > 2000)) {
      // 一般打法：瞄血最少的怪物、能射就射。耐心打法：每發隔 2 秒、直接瞄 Boss。
      const t = !patient && s.game.monsters.length ? s.game.monsters.reduce((a, b) => a.hp < b.hp ? a : b) : s.game.boss; lastShot = Date.now();
      const deg = Math.round(Math.max(-165, Math.min(-15, Math.atan2(Math.min(-20, t.y - 622), t.x - 400) * 180 / Math.PI)));
      try { await page.locator('#board-angle').fill(String(deg), { timeout: 2000 }); } catch { continue; } await tryClick(page.locator('#board-fire'));
    }
    await page.waitForTimeout(40);
  }
  const final = await snap(page);
  const shotPath = resolve(out, `outcome-${label}.png`); await page.screenshot({ path: shotPath });
  const result = { seed, label, patient, status: final.game.status, turns: final.game.board.turn, shots: final.game.shots, bossHp: final.game.boss.hp, monsters: final.game.monsters.length,
    seconds: Math.round((Date.now() - started) / 1000), audio: final.audio, soundsPlayed: final.sounds.played, soundKinds: [...new Set(final.sounds.log)], juice: final.juice, yarn: final.visual.yarn,
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), screenshot: { path: shotPath, sha256: createHash('sha256').update(await readFile(shotPath)).digest('hex') } };
  await context.close(); console.log(JSON.stringify(result)); return result;
}

async function realtimeGame() {
  const { context, page } = await open({ width: 1280, height: 720 }, '?mode=realtime');
  await page.waitForSelector('#scene[data-ready=true]');
  for (let k = 0; k < 5; k++) { const clicked = await tryClick(page.locator('#start')); await page.waitForTimeout(400); console.log(JSON.stringify({ startAttempt: k, clicked, status: await page.evaluate(() => window.studyEvidence.snapshot().game.status) })); if ((await page.evaluate(() => window.studyEvidence.snapshot().game.status)) === 'playing') break; }
  await page.locator('#scene').focus();
  // 結束瞬間焦點會跳到「重來」，空白鍵可能把局重置；所以在頁面內每 20 ms 記下第一次出現的結局。
  await page.evaluate(() => { const w = window; w.__outcome = null; setInterval(() => { const g = w.studyEvidence.snapshot().game; if (!w.__outcome && (g.status === 'won' || g.status === 'lost')) w.__outcome = { status: g.status, shots: g.shots, bossHp: g.boss.hp, monsters: g.monsters.length, tick: g.tick }; }, 20); });
  const started = Date.now(); let i = 0;
  while (Date.now() - started < 9 * 60000) {
    const s = await page.evaluate(() => window.studyEvidence.snapshot().game);
    if (s.status !== 'playing' || await page.evaluate(() => !!window.__outcome)) break;
    await page.keyboard.press(i % 3 === 0 ? 'ArrowLeft' : i % 3 === 1 ? 'ArrowRight' : 'ArrowRight'); await page.keyboard.press('Space'); i++;
    await page.waitForTimeout(260);
  }
  const s = await page.evaluate(() => window.__outcome ?? (g => ({ status: g.status, shots: g.shots, bossHp: g.boss.hp, monsters: g.monsters.length, tick: g.tick }))(window.studyEvidence.snapshot().game));
  const shotPath = resolve(out, 'outcome-realtime.png'); await page.screenshot({ path: shotPath });
  const result = { mode: 'realtime', status: s.status, shots: s.shots, bossHp: s.bossHp, monsters: s.monsters, simSeconds: Math.round(s.tick / 120), seconds: Math.round((Date.now() - started) / 1000), screenshot: { path: shotPath, sha256: createHash('sha256').update(await readFile(shotPath)).digest('hex') } };
  await context.close(); console.log(JSON.stringify(result)); return result;
}

async function reducedRun() {
  const { context, page } = await open({ width: 390, height: 844 }, '', { isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await page.waitForSelector('#board-scene[data-ready=true]'); await page.locator('#board-start').click();
  for (let turn = 0; turn < 3; turn++) {
    await page.waitForFunction(() => window.boardEvidence.snapshot().game.board.phase === 'roll', null, { timeout: 20000 });
    await page.locator('#board-roll').tap();
    await page.waitForFunction(() => window.boardEvidence.snapshot().game.board.phase === 'shooting', null, { timeout: 20000 });
    for (let k = 0; k < 6; k++) { const s = await snap(page); if (s.game.board.phase !== 'shooting') break; if (!(await page.locator('#board-fire').isDisabled())) await page.locator('#board-fire').tap(); await page.waitForTimeout(300); }
  }
  const s = await snap(page);
  const result = { mode: 'board-reduced-mobile', reduced: s.visual.reduced, turns: s.game.board.turn, shots: s.game.shots, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) };
  await context.close(); console.log(JSON.stringify(result)); return result;
}

const results = { html, sha256: createHash('sha256').update(await readFile(html)).digest('hex'), board: [], realtime: null, reduced: null };
const plan = [[20261111, true], [20261112, false], [20261112, true], [20261113, false], [20261113, true], [20261114, false]];

// 兩局一組平行跑，直到勝敗各有一局。
const realtimeOnly = process.argv[2] === 'realtime';
for (let i = 0; !realtimeOnly && i < plan.length; i += 2) {
  const batch = await Promise.all(plan.slice(i, i + 2).map(([seed, patient]) => boardGame(seed, `board-${seed}${patient ? '-patient' : ''}`, patient)));
  results.board.push(...batch);
  if (results.board.some(r => r.status === 'won') && results.board.some(r => r.status === 'lost')) break;
}
results.realtime = await realtimeGame(); results.reduced = await reducedRun();
await browser.close();
results.errors = errors;
results.pass = (realtimeOnly || results.board.some(r => r.status === 'won') && results.board.some(r => r.status === 'lost')) && ['won', 'lost'].includes(results.realtime?.status)
  && errors.console.length === 0 && errors.page.length === 0 && errors.external.length === 0;
await writeFile(resolve(out, realtimeOnly ? 'verification-realtime.json' : 'verification.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify({ pass: results.pass, errors }, null, 2));
