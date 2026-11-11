import { createServer } from 'vite';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

process.chdir(resolve(import.meta.dirname, '..'));
const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const output = resolve(option('--output', '../review-board2'));
const budgetSeconds = Number(option('--budget-seconds', '1800'));
const stopAt = option('--stop-at', '2026-11-11T17:00:00+08:00');
if (!(budgetSeconds > 0 && budgetSeconds <= 2700) || !Number.isFinite(Date.parse(stopAt)))
  throw new Error('時間預算或停止時間無效');
const baselineCommit = 'a90eb9c73bcc5ea66d56a3e88d8d37a89f2d49be';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, { windowsHide: true });
const normalize = bytes => bytes.toString().replaceAll('\r\n', '\n');
const sourcePaths = git(['ls-tree', '-r', '--name-only', baselineCommit, 'src']).toString().trim().split('\n');
sourcePaths.push('tools/board-difficulty-sim.ts', 'tools/difficulty-sim.ts');
const sourceHashes = {};
for (const path of sourcePaths) {
  const current = await readFile(path), expected = git(['show', `${baselineCommit}:${path}`]);
  // 允許在已選值的分支重跑；除此單鍵外須與基準完全相同。
  const clean = text => path === 'src/config.ts' ? text.replace(/waveEveryTurns: [234],/, 'waveEveryTurns: 2,') : text;
  if (clean(normalize(current)) !== normalize(expected)) throw new Error(`來源不符：${path}`);
  sourceHashes[path] = sha(current);
}
const baselineBytes = await readFile('artifacts/board-difficulty/summary.json');
const baselineSha256 = sha(baselineBytes);
if (baselineSha256 !== 'd80f5825728153affb0553afb8bc1ec7b9f54f03a8feee192d506a9eed629657')
  throw new Error('基準原始資料 SHA-256 不符');
const baseline = JSON.parse(baselineBytes);
const bots = ['random', 'greedy', 'lazy'];
const baselineRuns = baseline.runs.filter(r => r.mode === 'board');
if (baselineRuns.length !== 90 || baseline.config.board.waveEveryTurns !== 2) throw new Error('基準樣本不符');
await mkdir(output, { recursive: true });
const started = Date.now(), cpuStart = process.cpuUsage();
let peakRssBytes = 0, stoppedReason = null;
const guard = () => {
  const cpu = process.cpuUsage(cpuStart);
  peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
  if (Date.now() >= Date.parse(stopAt)) throw new Error('STOP:指定時間');
  if ((Date.now() - started) / 1000 >= budgetSeconds || (cpu.user + cpu.system) / 1e6 >= budgetSeconds)
    throw new Error('STOP:計算預算');
  if (peakRssBytes >= 3 * 1024 ** 3) throw new Error('STOP:RSS 3 GiB');
};
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
try {
  const { simulateBoard, summarizeModes } = await server.ssrLoadModule('/tools/board-difficulty-sim.ts');
  const { CONFIG } = await server.ssrLoadModule('/src/config.ts');
  const initialConfig = JSON.stringify(CONFIG), originalValue = CONFIG.board.waveEveryTurns;
  const runs = baselineRuns.map(r => ({ ...r, waveEveryTurns: 2, provenance: 'baseline-a90eb9c' }));
  const partialRound = [];
  const persist = async () => {
    const cpu = process.cpuUsage(cpuStart);
    const groups = [2, 3, 4].flatMap(waveEveryTurns => [...bots, 'all'].map(bot => ({ waveEveryTurns, bot,
      summary: summarizeModes(runs.filter(r => r.waveEveryTurns === waveEveryTurns && (bot === 'all' || r.bot === bot))) })));
    const candidates = groups.filter(g => g.bot === 'all' && g.waveEveryTurns !== 2);
    const complete = candidates.every(g => g.summary.games === 90) && !stoppedReason;
    const blocked = complete && candidates.every(g => g.summary.winRate < .25 || g.summary.winRate > .45);
    const selected = complete && !blocked ? [...candidates].sort((a, b) =>
      Math.abs(a.summary.winRate - .356) - Math.abs(b.summary.winRate - .356) || a.waveEveryTurns - b.waveEveryTurns)[0].waveEveryTurns : null;
    const report = { schema: 1, baselineCommit, baselineSha256, sourceHashes, config: JSON.parse(initialConfig),
      protocol: { values: [3, 4], bots, seedStart: 20261111, seedsPerBot: 30, fixedDt: CONFIG.dt,
        targetWinRate: .356, acceptableRange: [.25, .45], budgetSeconds, stopAt, rssStopGiB: 3,
        firstChain: '首個 depth >= 2 的模擬秒數；無事件留空',
        seconds: 'Game.tick * dt；包括棋盤動畫 ticks，不含真人思考時間' },
      resources: { startedAt: new Date(started).toISOString(), wallSeconds: (Date.now() - started) / 1000,
        cpuSeconds: (cpu.user + cpu.system) / 1e6, peakRssBytes },
      complete, blocked, selected, stoppedReason, groups, runs, partialRound };
    await writeFile(resolve(output, 'waves-summary.tmp'), JSON.stringify(report, null, 2) + '\n');
    await rename(resolve(output, 'waves-summary.tmp'), resolve(output, 'waves-summary.json'));
    const columns = ['mode', 'waveEveryTurns', 'bot', 'seed', 'result', 'turns', 'seconds', 'bossHp',
      'firstChain', 'deepestChain', 'firstChainTurn', 'completedTurns', 'shots', 'provenance'];
    const rows = runs.map(r => ({ ...r, result: r.status, turns: r.turn, firstChain: r.firstChainSeconds }));
    await writeFile(resolve(output, 'runs-waves.csv'), [columns.join(','), ...rows.map(r => columns.map(c => r[c] ?? '').join(','))].join('\n') + '\n');
    return { complete, blocked, selected, groups: candidates.map(g => ({ value: g.waveEveryTurns, wins: g.summary.wins, games: g.summary.games })) };
  };
  try {
    for (let i = 0; i < 30; i++) {
      const round = [];
      try {
        for (const waveEveryTurns of [3, 4]) {
          CONFIG.board.waveEveryTurns = waveEveryTurns;
          for (const bot of bots) {
            guard();
            const result = simulateBoard(20261111 + i, bot, guard);
            round.push({ ...result, waveEveryTurns, provenance: 'measured' });
            console.log(JSON.stringify({ waveEveryTurns, bot, seed: result.seed, result: result.status,
              turns: result.turn, bossHp: result.bossHp, elapsed: (Date.now() - started) / 1000 }));
          }
        }
      } catch (error) {
        if (!String(error.message).startsWith('STOP:')) throw error;
        stoppedReason = error.message; partialRound.push(...round);
      }
      if (!stoppedReason) runs.push(...round);
      await persist();
      if (stoppedReason) break;
    }
  } finally {
    CONFIG.board.waveEveryTurns = originalValue;
    if (JSON.stringify(CONFIG) !== initialConfig) throw new Error('覆寫外設定有變動');
  }
  console.log(JSON.stringify(await persist()));
  if (stoppedReason) process.exitCode = 2;
} finally { await server.close(); }
