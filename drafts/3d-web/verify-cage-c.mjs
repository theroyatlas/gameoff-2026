// 預設紙摺怪（不帶 ?inside=）：離線 Edge 驗收。
// 1) 四張整桌截圖：1280×720 與 390×844，各拍英文與中文；盤面用 ?lab=1 的 fastForward 推到有怪物在場上的同一刻，
//    中文用畫面上的「中文」按鈕切換。只改呈現，不改規則、RNG 或遊戲時鐘。
// 2) 一局完整遊戲：只操作畫面上的種子欄、開始、擲骰、瞄準滑桿與發射按鈕，打到規則自然判定勝負。
//    Playwright clock 只加速等待，不植入盤面或改規則。console error、page error、外部請求都記下來。
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = import.meta.dirname, out = resolve(root, '../../../review-cage-c');
const html = resolve(root, 'dist-cage-c/index.html'), base = pathToFileURL(html).href;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(resolve(out, 'shots'), { recursive: true }); await mkdir(resolve(out, 'play'), { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const errors = { console: [], page: [], external: [] };
const report = { buildSha256: sha(await readFile(html)), browser: `msedge ${browser.version()}`, shots: [], game: null, errors };
async function open(label, width, height, query, clock = false) {
  const mobile = width < 600;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await context.route(/^https?:/, r => { errors.external.push(`${label}: ${r.request().url()}`); return r.abort(); });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.console.push(`${label}: ${m.text()}`); });
  page.on('pageerror', e => errors.page.push(`${label}: ${e.message}`));
  if (clock) await page.clock.install();
  await page.goto(base + query); await page.waitForSelector('#board-scene[data-ready=true]');
  return { context, page };
}
const state = page => page.evaluate(() => {
  const s = window.boardEvidence.snapshot(), g = s.game;
  return { status: g.status, tick: g.tick, shots: g.shots, boss: g.boss, monsters: g.monsters, board: g.board,
    inside: s.visual.inside, art: s.visual.art, choice: s.visual.choice, cages: s.visual.cages, dying: s.visual.dyingCages, lang: document.documentElement.lang };
});
try {
  // 1) 四張截圖。
  for (const [device, width, height] of [['desktop', 1280, 720], ['mobile', 390, 844]]) {
    for (const lang of ['en', 'zh']) {
      const label = `${device}-${lang}`, { context, page } = await open(label, width, height, '?lab=1');
      await page.evaluate(() => window.boardLab.fastForward(22, 20261111));
      if (lang === 'zh') await page.locator('#language-toggle').click();
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(600);
      const s = await state(page), file = resolve(out, 'shots', `${label}.png`); await page.screenshot({ path: file });
      const overflow = await page.evaluate(() => ({ x: document.documentElement.scrollWidth > innerWidth, y: document.documentElement.scrollHeight > innerHeight }));
      report.shots.push({ file: `shots/${label}.png`, sha256: sha(await readFile(file)), lang: s.lang, inside: s.inside, art: s.art, choice: s.choice, monsters: s.monsters.length, cages: s.cages, overflow });
      await context.close();
    }
  }
  // 2) 一局完整遊戲（預設，不帶任何參數）。
  const { context, page } = await open('play', 1280, 720, '', true);
  await page.locator('#board-seed').fill('20261113'); await page.locator('#board-start').click({ force: true });
  let s, nextShot = 0, maxCages = 0, maxDying = 0, damaged = 0, killed = 0, rolls = 0, fires = 0, firstMonster = null, dyingShot = null;
  const hp = new Map();
  for (let i = 0; i < 5000; i++) {
    s = await state(page); maxCages = Math.max(maxCages, s.cages); maxDying = Math.max(maxDying, s.dying);
    for (const m of s.monsters) { const b = hp.get(m.id); if (b !== undefined && m.hp < b) damaged++; hp.set(m.id, m.hp); }
    for (const id of [...hp.keys()]) if (!s.monsters.some(m => m.id === id)) { hp.delete(id); killed++; }
    if (s.monsters.length && !firstMonster) { const f = resolve(out, 'play', 'first-monster.png'); await page.screenshot({ path: f }); firstMonster = { file: 'play/first-monster.png', sha256: sha(await readFile(f)), turn: s.board.turn }; }
    if (s.dying && !dyingShot) { const f = resolve(out, 'play', 'defeat.png'); await page.screenshot({ path: f }); dyingShot = { file: 'play/defeat.png', sha256: sha(await readFile(f)), dying: s.dying }; }
    if (s.status !== 'playing') break;
    if (s.board.phase === 'roll' && !await page.locator('#board-roll').isDisabled()) { await page.locator('#board-roll').click({ force: true }); rolls++; nextShot = s.tick; }
    else if (s.board.phase === 'shooting' && s.tick >= nextShot && !await page.locator('#board-fire').isDisabled()) {
      const target = s.monsters.length && s.shots % 2 ? s.monsters.reduce((a, b) => a.hp < b.hp ? a : b) : s.boss;
      const deg = Math.round(Math.max(-165, Math.min(-15, Math.atan2(Math.min(-20, target.y - 622), target.x - 400) * 180 / Math.PI)));
      await page.locator('#board-angle').fill(String(deg)); await page.locator('#board-fire').click({ force: true }); fires++; nextShot = s.tick + 60;
    }
    await page.clock.fastForward(s.dying ? 120 : 250);
  }
  s = await state(page); const f = resolve(out, 'play', 'outcome.png'); await page.screenshot({ path: f });
  report.game = { method: 'LIVE_BROWSER_ON_SCREEN_CONTROLS_WITH_ACCELERATED_CLOCK', query: '', seed: 20261113, inside: s.inside, status: s.status, turns: s.board.turn, shots: s.shots,
    bossHp: s.boss.hp, rolls, fires, maxCages, monsterDamageSeen: damaged, monstersDefeated: killed, maxDyingCages: maxDying, firstMonster, dyingShot,
    outcome: { file: 'play/outcome.png', sha256: sha(await readFile(f)), banner: await page.locator('#board-banner').textContent() } };
  await context.close();
} finally {
  await browser.close();
  report.counts = { consoleErrors: errors.console.length, pageErrors: errors.page.length, externalRequests: errors.external.length };
  report.pass = report.shots.length === 4 && report.shots.every(x => x.monsters > 0 && x.inside === 'c' && !x.overflow.x)
    && ['won', 'lost'].includes(report.game?.status) && report.game.maxCages > 0 && Object.values(report.counts).every(n => n === 0);
  await writeFile(resolve(out, 'browser-verification.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ pass: report.pass, counts: report.counts, game: report.game && { status: report.game.status, turns: report.game.turns, shots: report.game.shots, rolls: report.game.rolls, fires: report.game.fires, maxCages: report.game.maxCages, killed: report.game.monstersDefeated, maxDying: report.game.maxDyingCages }, build: report.buildSha256 }));
if (!report.pass) process.exitCode = 1;
