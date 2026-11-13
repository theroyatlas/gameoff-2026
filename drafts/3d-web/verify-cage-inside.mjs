// 籠內三版：離線 Edge 中只用 DOM 操作把棋盤模式打到自然勝敗。Playwright clock 只加速等待，不植入盤面或改規則。
// ?inside=a、b、c 各一局（一般動態），再加一局減少動態（手機）。記錄怪物出現、受傷、擊破時籠內角色的倒下動作。
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = import.meta.dirname, out = resolve(root, '../../../review-cage-inside/verify');
const html = resolve(root, 'dist-cage-inside/index.html'), base = pathToFileURL(html).href;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const errors = { console: [], page: [], external: [] };
const state = page => page.evaluate(() => {
  const s = window.boardEvidence.snapshot(), g = s.game;
  return { status: g.status, tick: g.tick, shots: g.shots, boss: g.boss, monsters: g.monsters, board: g.board, balls: g.balls.length,
    reduced: s.visual.reduced, art: s.visual.art, inside: s.visual.inside, cages: s.visual.cages, dying: s.visual.dyingCages };
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
  let nextShot = 0, s, maxCages = 0, maxDying = 0, firstMonsterShot = null, damaged = 0, killed = 0, dyingShot = null;
  const hp = new Map();
  for (let i = 0; i < 4000; i++) {
    s = await state(page); maxCages = Math.max(maxCages, s.cages); maxDying = Math.max(maxDying, s.dying);
    for (const m of s.monsters) { const b = hp.get(m.id); if (b !== undefined && m.hp < b) damaged++; hp.set(m.id, m.hp); }
    for (const id of [...hp.keys()]) if (!s.monsters.some(m => m.id === id)) { hp.delete(id); killed++; }
    if (s.monsters.length && firstMonsterShot === null) {
      await page.evaluate(() => window.scrollTo(0, 0)); const path = resolve(out, `${label}-monsters.png`); await page.screenshot({ path });
      firstMonsterShot = { file: `verify/${label}-monsters.png`, sha256: sha(await readFile(path)), turn: s.board.turn, monsters: s.monsters.length };
    }
    if (s.dying && !dyingShot) {
      await page.evaluate(() => window.scrollTo(0, 0)); const path = resolve(out, `${label}-defeat.png`); await page.screenshot({ path });
      dyingShot = { file: `verify/${label}-defeat.png`, sha256: sha(await readFile(path)), dying: s.dying };
    }
    if (s.status !== 'playing') break;
    if (s.board.phase === 'roll') { await page.locator('#board-roll').dispatchEvent('click'); nextShot = s.tick; }
    else if (s.board.phase === 'shooting' && s.tick >= nextShot && !await page.locator('#board-fire').isDisabled()) {
      const target = s.monsters.length && s.shots % 2 ? s.monsters.reduce((a, b) => a.hp < b.hp ? a : b) : s.boss;
      const deg = Math.round(Math.max(-165, Math.min(-15, Math.atan2(Math.min(-20, target.y - 622), target.x - 400) * 180 / Math.PI)));
      await page.locator('#board-angle').fill(String(deg)); await page.locator('#board-fire').dispatchEvent('click'); nextShot = s.tick + 60;
    }
    await page.clock.fastForward(s.dying ? 120 : 250);
  }
  s = await state(page); await page.evaluate(() => window.scrollTo(0, 0));
  const path = resolve(out, `${label}-outcome.png`); await page.screenshot({ path });
  const result = { label, query, seed, mobile, reduced: s.reduced, inside: s.inside, art: s.art, status: s.status, turns: s.board.turn, shots: s.shots,
    bossHp: s.boss.hp, maxCages, monsterDamageSeen: damaged, monstersDefeated: killed, maxDyingCages: maxDying, firstMonsterShot, dyingShot,
    outcome: { file: `verify/${label}-outcome.png`, sha256: sha(await readFile(path)) },
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) };
  await context.close(); console.log(JSON.stringify({ label, status: s.status, turns: s.board.turn, maxCages, damaged, killed, maxDying })); return result;
}
const report = { buildSha256: sha(await readFile(html)), method: 'LIVE_BROWSER_DOM_INPUT_WITH_ACCELERATED_CLOCK', games: [], errors };
try {
  report.games.push(await play('inside-a', '?inside=a', 20261121));
  report.games.push(await play('inside-b', '?inside=b', 20261122));
  report.games.push(await play('inside-c', '?inside=c', 20261123));
  report.games.push(await play('reduced-inside-b-mobile', '?inside=b', 20261124, { mobile: true, reduced: true }));
} finally {
  await browser.close();
  report.pass = report.games.length === 4 && report.games.every(g => ['won', 'lost'].includes(g.status) && g.maxCages > 0 && g.inside)
    && Object.values(errors).every(a => a.length === 0) && report.games.find(g => g.mobile)?.reduced === true;
  await writeFile(resolve(out, 'browser-verification.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ pass: report.pass, errors }));
if (!report.pass) process.exitCode = 1;
