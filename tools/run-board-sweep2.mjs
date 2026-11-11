import { createServer } from 'vite';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

process.chdir(resolve(import.meta.dirname, '..'));
const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const output = resolve(option('--output', '../review-board2'));
const stopAt = option('--stop-at', '2026-11-11T17:00:00+08:00');
const budgetSeconds = Number(option('--budget-seconds', '2100'));
const extraHp = args.includes('--extra-hp') ? Number(option('--extra-hp')) : null;
if (!(budgetSeconds > 0 && budgetSeconds <= 2100) || !Number.isFinite(Date.parse(stopAt)))
  throw new Error('時間預算或停止時間無效');
if (extraHp !== null && (!Number.isInteger(extraHp) || extraHp <= 0)) throw new Error('HP 值無效');
const baselineCommit = '9f9ed69dcd4880c20e816f0cdbb1110357695248';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, { windowsHide: true });
const normalize = bytes => bytes.toString().replaceAll('\r\n', '\n');
const sourcePaths = git(['ls-tree', '-r', '--name-only', baselineCommit, 'src']).toString().trim().split('\n');
sourcePaths.push('tools/board-difficulty-sim.ts', 'tools/difficulty-sim.ts');
const sourceHashes = {};
for (const path of sourcePaths) {
  const current = await readFile(path), expected = git(['show', `${baselineCommit}:${path}`]);
  // 允許選值後重跑，覆寫前仍核對所有非候選設定與 bot 完全相同。
  const clean = text => path === 'src/config.ts' ? text
    .replace(/waveEveryTurns: [23],/, 'waveEveryTurns: 2,')
    .replace(/waveBaseCount: [234],/, 'waveBaseCount: 2,')
    .replace(/waveHpGrowth: \d+,/, 'waveHpGrowth: 120,') : text;
  if (clean(normalize(current)) !== normalize(expected)) throw new Error(`來源不符：${path}`);
  sourceHashes[path] = sha(current);
}
await mkdir(output, { recursive: true });
const summaryPath = resolve(output, 'sweep2-summary.json');
let report;
if (extraHp !== null) {
  report = JSON.parse(await readFile(summaryPath));
  if (report.baselineCommit !== baselineCommit || report.groups.length < 4 || report.groups.length >= 6
    || !report.complete || report.stoppedReason
    || report.groups.slice(0, 4).some(g => g.summary.winRate >= .25 && g.summary.winRate <= .45)) throw new Error('不符合追加條件');
  const hp = report.groups.filter(g => g.key === 'waveHpGrowth');
  if (hp[0].summary.winRate <= hp[1].summary.winRate || hp.some(g => g.value === extraHp))
    throw new Error('沒有下降趨勢或候選重複');
  for (const [path, hash] of Object.entries(report.sourceHashes))
    if (sourceHashes[path] !== hash) throw new Error(`追加前來源改變：${path}`);
} else {
  // 不覆蓋已存在的量測，以免誤刪證據或重複消耗預算。
  try { await readFile(summaryPath); throw new Error('輸出已存在；重跑請指定新的 --output 目錄'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  report = { schema: 1, baselineCommit, sourceHashes, config: null,
    protocol: { bots: ['random', 'greedy', 'lazy'], seedStart: 20261111, seedsPerBot: 30,
      waveEveryTurns: 3, targetWinRate: .356, acceptableRange: [.25, .45], maxGroups: 6,
      budgetSeconds, stopAt, rssStopGiB: 3, firstChain: '首次 depth >= 2 的模擬秒數；無事件留空',
      seconds: 'Game.tick * dt，包含棋盤動畫、不含真人思考時間' },
    resources: [], groups: [], runs: [], complete: false, blocked: false, selected: null, stoppedReason: null };
}
const started = Date.now(), cpuStart = process.cpuUsage();
const priorWall = report.resources.reduce((n, r) => n + r.wallSeconds, 0);
const priorCpu = report.resources.reduce((n, r) => n + r.cpuSeconds, 0);
let peakRssBytes = 0;
const guard = () => {
  const cpu = process.cpuUsage(cpuStart);
  peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
  if (Date.now() >= Date.parse(stopAt)) throw new Error('STOP:指定時間');
  if (priorWall + (Date.now() - started) / 1000 >= budgetSeconds || priorCpu + (cpu.user + cpu.system) / 1e6 >= budgetSeconds)
    throw new Error('STOP:累計計算預算');
  if (peakRssBytes >= 3 * 1024 ** 3) throw new Error('STOP:RSS 3 GiB');
};
const atomicJson = async (path, value) => {
  await writeFile(path + '.tmp', JSON.stringify(value) + '\n');
  await rename(path + '.tmp', path);
};
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
try {
  const { simulateBoard, summarizeModes } = await server.ssrLoadModule('/tools/board-difficulty-sim.ts');
  const { CONFIG } = await server.ssrLoadModule('/src/config.ts');
  const original = JSON.stringify(CONFIG), originalBoard = structuredClone(CONFIG.board);
  const baseBoard = { ...originalBoard, waveEveryTurns: 2, waveBaseCount: 2, waveHpGrowth: 120 };
  report.config ??= { ...structuredClone(CONFIG), board: baseBoard };
  const candidates = extraHp === null
    ? [{ key: 'waveBaseCount', value: 3 }, { key: 'waveBaseCount', value: 4 },
      { key: 'waveHpGrowth', value: 160 }, { key: 'waveHpGrowth', value: 200 }]
    : [{ key: 'waveHpGrowth', value: extraHp }];
  const persist = async () => {
    const eligible = report.groups.filter(g => g.complete && g.summary.winRate >= .25 && g.summary.winRate <= .45);
    report.complete = !report.stoppedReason && report.groups.length >= 4 && report.groups.every(g => g.complete);
    report.selected = report.complete && eligible.length ? [...eligible].sort((a, b) =>
      Math.abs(a.summary.winRate - .356) - Math.abs(b.summary.winRate - .356))[0].id : null;
    report.blocked = report.complete && !report.selected;
    await atomicJson(summaryPath, report);
    const columns = ['mode', 'waveEveryTurns', 'key', 'value', 'bot', 'seed', 'result', 'turns', 'seconds', 'bossHp', 'firstChain', 'deepestChain'];
    await writeFile(resolve(output, 'runs-sweep2.csv'), [columns.join(','),
      ...report.runs.map(r => columns.map(c => r[c] ?? '').join(','))].join('\n') + '\n');
  };
  try {
    for (const { key, value } of candidates) {
      guard();
      Object.assign(CONFIG.board, baseBoard, { waveEveryTurns: 3, [key]: value });
      const expected = structuredClone(report.config);
      Object.assign(expected.board, { waveEveryTurns: 3, [key]: value });
      if (JSON.stringify(CONFIG) !== JSON.stringify(expected)) throw new Error('單鍵覆寫檢查失敗');
      const id = `${key}-${value}`, detailPath = resolve(output, `sweep2-${id}.json`);
      const runs = [];
      let partialRound = [];
      for (let i = 0; i < 30; i++) {
        const round = [];
        try {
          for (const bot of report.protocol.bots) {
            guard();
            const run = simulateBoard(20261111 + i, bot, guard);
            if (!['won', 'lost'].includes(run.status)) throw new Error(`非自然勝敗：${id}/${bot}/${run.seed}`);
            round.push(run);
            console.log(JSON.stringify({ key, value, bot, seed: run.seed, result: run.status, turns: run.turn, bossHp: run.bossHp }));
          }
        } catch (error) {
          if (!String(error.message).startsWith('STOP:')) throw error;
          report.stoppedReason = error.message; partialRound = round;
        }
        if (!report.stoppedReason) runs.push(...round);
        await atomicJson(detailPath, { id, key, value, config: expected, runs, partialRound });
        if (report.stoppedReason) break;
      }
      const group = { id, key, value, complete: runs.length === 90, detailPath,
        detailSha256: sha(await readFile(detailPath)), summary: summarizeModes(runs),
        bots: report.protocol.bots.map(bot => ({ bot, summary: summarizeModes(runs.filter(r => r.bot === bot)) })) };
      report.groups.push(group);
      report.runs.push(...runs.map(r => ({ mode: r.mode, waveEveryTurns: 3, key, value, bot: r.bot, seed: r.seed,
        result: r.status, turns: r.turn, seconds: r.seconds, bossHp: r.bossHp, firstChain: r.firstChainSeconds, deepestChain: r.deepestChain })));
      await persist();
      console.log(JSON.stringify({ completedGroup: id, wins: group.summary.wins, games: group.summary.games }));
      if (report.stoppedReason) break;
    }
  } catch (error) {
    report.stoppedReason = String(error.message); throw error;
  } finally {
    Object.assign(CONFIG.board, originalBoard);
    if (JSON.stringify(CONFIG) !== original) throw new Error('覆寫未完整還原');
    const cpu = process.cpuUsage(cpuStart);
    report.resources.push({ startedAt: new Date(started).toISOString(), wallSeconds: (Date.now() - started) / 1000,
      cpuSeconds: (cpu.user + cpu.system) / 1e6, peakRssBytes });
    await persist();
  }
  console.log(JSON.stringify({ complete: report.complete, blocked: report.blocked, selected: report.selected, groups: report.groups.map(g => ({ id: g.id, wins: g.summary.wins, games: g.summary.games })) }));
  if (report.stoppedReason) process.exitCode = 2;
} finally { await server.close(); }
