// 美術第二輪：離線 Edge 中只用 DOM 操作把棋盤模式打到自然勝敗。Playwright clock 只加速等待，不植入盤面或改規則。
// 一般動態兩局（ui/cage/card 各用 a、b）、減少動態一局（手機、c），再加一局不帶參數的預設畫面。
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = import.meta.dirname, out = resolve(root, '../../../review-art-round2/verify');
const html = resolve(root, 'dist-art-round2/index.html'), base = pathToFileURL(html).href;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const errors = { console: [], page: [], external: [] };
const state = page => page.evaluate(() => {
  const s = window.boardEvidence.snapshot(), g = s.game;
  return { status: g.status, tick: g.tick, shots: g.shots, boss: g.boss, monsters: g.monsters, board: g.board, balls: g.balls.length,
    reduced: s.visual.reduced, art: s.visual.art, cardReveals: s.visual.cardReveals, cages: s.visual.cages, sounds: s.sounds.kinds };
});
async function play(label, query, seed, { mobile = false, reduced = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
    deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await context.route(/^https?:/, r => { errors.external.push(r.request().url()); return r.abort(); });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.console.push(`${label}: ${m.text()}`); });
  page.on('pageerror', e => errors.page.push(`${label}: ${e.message}`));
  await page.clock.install(); await page.goto(base + query); await page.waitForSelector('#board-scene[data-ready=true]');
  await page.locator('#board-seed').fill(String(seed)); await page.locator('#board-start').click();
  let nextShot = 0, s, revealShot = null, maxCages = 0; const sounds = new Set();
  for (let i = 0; i < 4000; i++) {
    s = await state(page); maxCages = Math.max(maxCages, s.cages); for (const n of s.sounds) sounds.add(n);
    if (s.status !== 'playing') break;
    if (s.cardReveals && !revealShot) {
      await page.clock.fastForward(800); await page.evaluate(() => window.scrollTo(0, 0));
      const path = resolve(out, `${label}-reveal.png`); await page.screenshot({ path }); revealShot = { file: `verify/${label}-reveal.png`, sha256: sha(await readFile(path)) };
      continue;
    }
    if (s.board.phase === 'roll') { await page.locator('#board-roll').dispatchEvent('click'); nextShot = s.tick; }
    else if (s.board.phase === 'shooting' && s.tick >= nextShot && !await page.locator('#board-fire').isDisabled()) {
      const target = s.monsters.length && s.shots % 2 ? s.monsters.reduce((a, b) => a.hp < b.hp ? a : b) : s.boss;
      const deg = Math.round(Math.max(-165, Math.min(-15, Math.atan2(Math.min(-20, target.y - 622), target.x - 400) * 180 / Math.PI)));
      await page.locator('#board-angle').fill(String(deg)); await page.locator('#board-fire').dispatchEvent('click'); nextShot = s.tick + 60;
    }
    await page.clock.fastForward(250);
  }
  s = await state(page); await page.evaluate(() => window.scrollTo(0, 0));
  const path = resolve(out, `${label}-outcome.png`); await page.screenshot({ path });
  const result = { label, query, seed, mobile, reduced, status: s.status, turns: s.board.turn, shots: s.shots, balls: s.balls, bossHp: s.boss.hp,
    cardsDrawn: s.board.cards.length, cardReveals: s.cardReveals, maxCages, art: s.art, sounds: [...sounds].sort(), revealShot,
    outcome: { file: `verify/${label}-outcome.png`, sha256: sha(await readFile(path)) },
    slotVisible: await page.locator('#board-card-face').isVisible().catch(() => false),
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) };
  await context.close(); console.log(JSON.stringify({ label, status: s.status, turns: s.board.turn, cards: s.board.cards.length, reveals: s.cardReveals })); return result;
}
const report = { buildSha256: sha(await readFile(html)), method: 'LIVE_BROWSER_DOM_INPUT_WITH_ACCELERATED_CLOCK', games: [], errors };
try {
  report.games.push(await play('motion-a', '?ui=a&cage=a&card=a', 20261111));
  report.games.push(await play('motion-b', '?ui=b&cage=b&card=b', 20261112));
  report.games.push(await play('reduced-c-mobile', '?ui=c&cage=c&card=c', 20261113, { mobile: true, reduced: true }));
  report.games.push(await play('default', '', 20261114));
} finally {
  await browser.close();
  report.pass = report.games.length === 4 && report.games.every(g => ['won', 'lost'].includes(g.status)) && Object.values(errors).every(a => a.length === 0)
    && report.games.filter(g => g.art.card).every(g => g.cardsDrawn === 0 || g.cardReveals === g.cardsDrawn)
    && report.games.find(g => g.reduced)?.reduced === true;
  await writeFile(resolve(out, 'browser-verification.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ pass: report.pass, errors }));
if (!report.pass) process.exitCode = 1;
