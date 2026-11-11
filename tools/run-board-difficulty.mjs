import { createServer } from 'vite';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

process.chdir(resolve(import.meta.dirname, '..'));
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const count = Number(option('--count', '30'));
const budgetSeconds = Number(option('--budget-seconds', '2700'));
const output = resolve(option('--output', 'artifacts/board-difficulty'));
if (!Number.isInteger(count) || count < 1 || count > 30) throw new Error('count 必須為 1–30');
if (!Number.isFinite(budgetSeconds) || budgetSeconds < 1 || budgetSeconds > 3000) throw new Error('預算必須為 1–3000 秒');
const rulesCommit = execFileSync('git', ['rev-parse', 'e7f6eae'], { encoding: 'utf8', windowsHide: true }).trim();
const botCommit = execFileSync('git', ['rev-parse', 'ee0a502'], { encoding: 'utf8', windowsHide: true }).trim();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// 拒絕把工作樹中未經授權的規則或來源 bot 當成本次量測依據。
const sourceHashes = {};
for (const [commit, paths] of [[rulesCommit, ['src/game.ts', 'src/config.ts', 'src/board.ts']],
  [botCommit, ['tools/difficulty-sim.ts']]]) {
  for (const path of paths) {
    const expected = execFileSync('git', ['show', `${commit}:${path}`], { windowsHide: true });
    const actual = await readFile(path);
    if (actual.toString().replaceAll('\r\n', '\n') !== expected.toString().replaceAll('\r\n', '\n'))
      throw new Error(`來源不符：${path}`);
    sourceHashes[path] = sha(actual);
  }
}
await mkdir(output, { recursive: true });
const started = Date.now(), cpuStart = process.cpuUsage();
let peakRssBytes = 0, stoppedReason = null;
const stopAt = option('--stop-at', '2026-11-11T17:00:00+08:00');
const deadline = Date.parse(stopAt);
if (!Number.isFinite(deadline)) throw new Error('stop-at 必須為有效 ISO 日期時間');
const guard = () => {
  const cpu = process.cpuUsage(cpuStart);
  peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
  if (Date.now() >= deadline) throw new Error('STOP:指定時間停止線');
  if ((Date.now() - started) / 1000 >= budgetSeconds || (cpu.user + cpu.system) / 1e6 >= budgetSeconds)
    throw new Error('STOP:計算時間預算');
  if (peakRssBytes >= 3 * 1024 ** 3) throw new Error('STOP:RSS 3 GiB 保守停止線');
};
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
try {
  const { MODES, simulateMode, summarizeModes } = await server.ssrLoadModule('/tools/board-difficulty-sim.ts');
  const { CONFIG } = await server.ssrLoadModule('/src/config.ts');
  const bots = ['random', 'greedy', 'lazy'];
  const runs = [], partialRound = [];
  const persist = async () => {
    const cpu = process.cpuUsage(cpuStart);
    const report = { schema: 1, rulesCommit, botCommit, sourceHashes, config: CONFIG,
      protocol: { seedStart: 20261111, requestedSeedsPerBot: count, includedSeedsPerBot: runs.length / 6,
        fixedDt: CONFIG.dt, shotIntervalSeconds: 2, maxGameSeconds: 600,
        board: '自動擲骰；進入 shooting 立即首射，其後每 2 秒；發完 shotsLeft（含繞圈獎勵）；正常 step 等結算',
        greedy: '重用來源策略；棋盤 TUNE 回合優先既有候選中受強化的材質，無候選則原策略',
        chain: '首個 depth >= 2；未發生為 null；層數可跨時間延續',
        turns: '棋盤 turn 為已開始回合，completedTurns 為 Boss 鐘；即時模式為 null',
        seconds: 'Game.tick * dt，含棋盤擲骰走格效果 ticks，不含使用者思考或真實渲染時間',
        quantiles: '(n-1)*p 線性內插；缺事件不補零',
        budgetSeconds, deadline: stopAt, rssStopGiB: 3 },
      resources: { startedAt: new Date(started).toISOString(), wallSeconds: (Date.now() - started) / 1000,
        cpuSeconds: (cpu.user + cpu.system) / 1e6, peakRssBytes }, stoppedReason,
      groups: MODES.flatMap(mode => [...bots, 'all'].map(bot => ({ mode, bot,
        summary: summarizeModes(runs.filter(r => r.mode === mode && (bot === 'all' || r.bot === bot))) }))),
      runs, partialRound };
    await writeFile(resolve(output, 'summary.tmp'), JSON.stringify(report, null, 2) + '\n');
    await rename(resolve(output, 'summary.tmp'), resolve(output, 'summary.json'));
  };
  for (let i = 0; i < count; i++) {
    const round = [];
    try {
      for (const bot of bots) for (const mode of MODES) {
        guard();
        const result = simulateMode(20261111 + i, bot, mode, guard);
        round.push(result);
        console.log(JSON.stringify({ seed: result.seed, bot, mode, status: result.status,
          seconds: result.seconds, turn: result.turn, elapsed: (Date.now() - started) / 1000 }));
      }
    } catch (error) {
      if (!String(error.message).startsWith('STOP:')) throw error;
      stoppedReason = error.message; partialRound.push(...round);
    }
    if (!stoppedReason) runs.push(...round);
    await persist();
    if (stoppedReason) break;
  }
  await persist();
  const columns = ['mode', 'bot', 'seed', 'status', 'seconds', 'turn', 'completedTurns', 'shots',
    'firstChainSeconds', 'firstChainTurn', 'bossHp', 'deepestChain'];
  await writeFile(resolve(output, 'runs.csv'), [columns.join(','), ...runs.map(r => columns.map(c => r[c] ?? '').join(','))].join('\n') + '\n');
  console.log(JSON.stringify({ complete: !stoppedReason, games: runs.length, partialGames: partialRound.length, output }));
} finally { await server.close(); }
