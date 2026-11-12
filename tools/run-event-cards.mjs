// 固定既有三種 bot 與發射節奏；逐局保存可重算的 CSV。
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '../review-event-cards');
const label = process.argv[2] ?? 'events';
const growth = Number(process.argv[3] ?? 260);
await mkdir(out, { recursive: true });
const server = await createServer({ root, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
try {
  const { CONFIG } = await server.ssrLoadModule('/src/config.ts');
  const { simulateBoard } = await server.ssrLoadModule('/tools/board-difficulty-sim.ts');
  CONFIG.board.waveHpGrowth = growth;
  const rows = [], started = Date.now();
  const quote = v => `"${String(v).replaceAll('"', '""')}"`;
  for (let i = 0; i < 30; i++) {
    for (const bot of ['random', 'greedy', 'lazy']) {
      const r = simulateBoard(20261111 + i, bot);
      rows.push({ seed: r.seed, bot, won: r.status === 'won', status: r.status, turns: r.turn,
        shots: r.shots, ticks: r.finalSnapshot.tick, bossHp: r.bossHp,
        cards: r.finalSnapshot.board.cards ?? [], inputs: r.inputs, rolls: r.rolls });
    }
    if (i % 5 === 4) console.log(`${label}: ${rows.length}/90`);
    await writeFile(resolve(out, `${label}.csv`), 'seed,bot,won,status,turns,shots,ticks,bossHp,cards\n' + rows.map(r =>
      [r.seed, r.bot, Number(r.won), r.status, r.turns, r.shots, r.ticks, r.bossHp, JSON.stringify(r.cards)].map(quote).join(',')).join('\n') + '\n');
  }
  const result = { label, config: CONFIG.board, games: rows.length, wins: rows.filter(r => r.won).length,
    winRate: rows.filter(r => r.won).length / rows.length, seconds: (Date.now() - started) / 1000,
    bots: ['random', 'greedy', 'lazy'].map(bot => ({ bot, games: 30, wins: rows.filter(r => r.bot === bot && r.won).length })), rows };
  await writeFile(resolve(out, `${label}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ label, games: result.games, wins: result.wins, winRate: result.winRate, seconds: result.seconds }));
} finally { await server.close(); }
