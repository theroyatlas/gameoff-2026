// 固定節奏經 DOM 操作；只控制 RAF 時戳，沒有取得或改寫 Game 實例。
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = import.meta.dirname, out = resolve(root, '../../../review-event-cards');
const reference = { seed: Number(process.argv[2] ?? 20261111) };
const repeat = process.argv.includes('--repeat');
const previous = repeat ? await readFile(resolve(out, `browser-fixed-${reference.seed}.json`), 'utf8') : null;
const html = resolve(root, 'dist-event-cards/index.html');
const sha = data => createHash('sha256').update(data).digest('hex');
const errors = { console: [], page: [], external: [] };
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await context.route(/^https?:/, r => { errors.external.push(r.request().url()); return r.abort(); });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.console.push(m.text()); });
  page.on('pageerror', e => errors.page.push(e.message));
  await page.addInitScript(() => {
    let now = 0, next = 0;
    const callbacks = new Map();
    performance.now = () => now;
    window.requestAnimationFrame = cb => { callbacks.set(++next, cb); return next; };
    window.cancelAnimationFrame = id => callbacks.delete(id);
    window.__advanceFrame = ms => {
      now += ms;
      const due = [...callbacks.values()]; callbacks.clear();
      for (const cb of due) cb(now);
    };
  });
  await page.goto(pathToFileURL(html).href); await page.waitForSelector('#board-scene[data-ready=true]');
  await page.locator('#board-seed').fill(String(reference.seed)); await page.locator('#board-start').dispatchEvent('click');
  const current = () => page.evaluate(() => {
    const g = window.boardEvidence.snapshot().game;
    return { tick: g.tick, status: g.status, shots: g.shots, board: g.board, bossHp: g.boss.hp, balls: g.balls, boss: g.boss };
  });
  let nextShot = 0;
  for (let i = 0; i < 5000; i++) {
    let s = await current(); if (s.status !== 'playing') break;
    if (s.board.phase === 'roll') {
      await page.locator('#board-roll').dispatchEvent('click'); nextShot = s.tick;
      s = await current();
      if (s.board.turn % 5 === 0) console.log(`DOM fixed-input: turn ${s.board.turn}`);
    }
    if (s.board.phase === 'shooting' && s.tick >= nextShot) {
      const candidates = s.balls.filter(b => b.y < 602 && (b.resonant || s.balls.some(o => o.id !== b.id && Math.hypot(o.x - b.x, o.y - b.y) <= 56)));
      const tuned = candidates.filter(b => b.material === s.board.tuneMaterial);
      const targets = tuned.length ? tuned : candidates;
      targets.sort((a, b) => Math.hypot(a.x - 400, a.y - 622) - Math.hypot(b.x - 400, b.y - 622) || a.id - b.id);
      const target = targets[0] ?? s.boss;
      const angle = Math.round(Math.max(-165, Math.min(-15, Math.atan2(target.y - 622, target.x - 400) * 180 / Math.PI)));
      await page.locator('#board-angle').fill(String(angle)); await page.locator('#board-fire').dispatchEvent('click');
      const next = await current(); if (next.shots !== s.shots + 1) throw new Error('DOM 發射失敗');
      nextShot = s.tick + 240; s = next;
    }
    const until = ['rolling', 'moving', 'effect', 'settling'].includes(s.board.phase) ? s.board.phaseUntil : nextShot;
    const step = Math.min(30, Math.max(1, until - s.tick));
    await page.evaluate(ticks => window.__advanceFrame(ticks * 1000 / 120 + .00001), step);
  }
  const final = await page.evaluate(() => window.boardEvidence.snapshot().game);
  if (previous && JSON.stringify(JSON.parse(previous)) !== JSON.stringify(final)) throw new Error('同 seed 固定 DOM 節奏未重現完整盤面');
  await writeFile(resolve(out, `browser-fixed-${reference.seed}.json`), JSON.stringify(final, null, 2));
  if (final.status !== 'won') throw new Error(`尚未勝利：${JSON.stringify({ status: final.status, turn: final.board.turn, hp: final.boss.hp })}`);
  // 終局後補一個只呈現的影格，讓 HUD 同步；規則 tick 不再前進。
  await page.evaluate(() => window.__advanceFrame(16));
  const file = 'outcome-board-fixed-input-won.png'; await page.screenshot({ path: resolve(out, file) });
  const replay = { label: 'board-fixed-input-won', method: 'LIVE_BROWSER_DOM_FIXED_INPUT_WITH_CONTROLLED_RAF', strategy: 'greedy-rounded-degrees', repeatMatched: repeat, seed: final.seed, patient: true,
    status: final.status, tick: final.tick, shots: final.shots, balls: final.balls.length, boss: final.boss, monsters: final.monsters, board: final.board,
    inputs: final.inputs, screenshot: { file, sha256: sha(await readFile(resolve(out, file))) }, errors };
  await writeFile(resolve(out, 'browser-fixed-input.json'), JSON.stringify(replay, null, 2));
  const result = JSON.parse(await readFile(resolve(out, 'browser-verification.json'), 'utf8'));
  if (result.buildSha256 !== sha(await readFile(html))) throw new Error('驗證建置不符');
  result.board = result.board.filter(r => r.label !== replay.label); result.board.push(replay);
  for (const key of Object.keys(errors)) result.errors[key].push(...errors[key]);
  result.methods = ['LIVE_BROWSER_DOM_INPUT_WITH_ACCELERATED_CLOCK', replay.method];
  result.pass = result.board.some(r => r.status === 'won') && result.board.some(r => r.status === 'lost')
    && ['won', 'lost'].includes(result.realtime.status) && ['won', 'lost'].includes(result.reduced.status)
    && result.reduced.reduced && result.reduced.board.cards.length > 0 && Object.values(result.errors).every(a => !a.length);
  await writeFile(resolve(out, 'browser-verification.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ pass: result.pass, seed: final.seed, status: final.status, tick: final.tick, shots: final.shots, errors }));
} finally { await browser.close(); }
