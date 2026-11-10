import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CONFIG as C } from '../src/config';
import { Game, type ChainEvent } from '../src/game';

// 操作亂數獨立於遊戲亂數；兩種策略都每兩秒發射，第一發在 tick 0。
export const SEEDS = Array.from({ length: 40 }, (_, i) => 20261110 + i);
export const STRATEGIES = ['random-up', 'boss-near'] as const;
type Strategy = typeof STRATEGIES[number];
export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b), i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
}
export function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0;
  return { count: values.length, min: sorted[0] ?? 0, p25: percentile(.25), median: median(values),
    p75: percentile(.75), p90: percentile(.9), max: sorted.at(-1) ?? 0 };
}
export function waveStats(events: ChainEvent[], bossHp: number, totalTicks: number) {
  const secondTicks = Math.round(1 / C.dt);
  const groups: ChainEvent[][] = [];
  const occupiedSeconds = new Set<number>();
  for (const event of [...events].sort((a, b) => a.tick - b.tick || a.id - b.id)) {
    if (event.tick < 0 || event.tick > totalTicks) throw new Error('爆發時間超出局長');
    // 秒窗為 (0,1]、(1,2]…；tick 0 歸第一窗，最後不足一秒按實際長度計。
    occupiedSeconds.add(Math.max(0, Math.ceil(event.tick / secondTicks) - 1));
    const group = groups.at(-1);
    if (group && event.tick - group.at(-1)!.tick <= secondTicks) group.push(event);
    else groups.push([event]);
  }
  const medianWaveBursts = median(groups.map(g => g.length));
  const waves = groups.map((group, i) => {
    const kills = new Set<number>(); let bossDamage = 0;
    for (const event of group) for (const d of event.targetDamage) {
      if (d.targetId === 0) bossDamage += d.amount;
      else if (d.killed) kills.add(d.targetId);
    }
    const startTick = group[0].tick, endTick = group.at(-1)!.tick;
    const durationTicks = endTick - startTick;
    const short = durationTicks <= Math.round(3 / C.dt);
    const wow = { boss: short && bossDamage >= bossHp * .25, kills: short && kills.size >= 3,
      bursts: short && group.length >= 8 && group.length >= medianWaveBursts * 4 };
    return { wave: i + 1, bursts: group.length, startTick, endTick, startSeconds: startTick * C.dt,
      endSeconds: endTick * C.dt, durationSeconds: durationTicks * C.dt, bossDamage, kills: kills.size,
      wow, anyWow: Object.values(wow).some(Boolean),
      // 終局截斷與自然沉寂分開保留，避免把未知的後續事件當成已觀察。
      endedByOutcome: totalTicks - endTick <= secondTicks };
  });
  let activeTicks = 0;
  for (const bin of occupiedSeconds) activeTicks += Math.max(0, Math.min(secondTicks, totalTicks - bin * secondTicks));
  const quietSeconds = (totalTicks - activeTicks) * C.dt;
  const bySize = [...waves].sort((a, b) => a.bursts - b.bursts || a.startTick - b.startTick);
  const middle = Math.floor(bySize.length / 2);
  const medianWaves = !bySize.length ? [] : bySize.length % 2 ? [bySize[middle]] : bySize.slice(middle - 1, middle + 1);
  const wow = { boss: waves.some(w => w.wow.boss), kills: waves.some(w => w.wow.kills), bursts: waves.some(w => w.wow.bursts) };
  return { quietSeconds, quietRatio: totalTicks ? quietSeconds / (totalTicks * C.dt) : 1,
    totalBursts: events.length, medianWaveBursts, medianWaves, maxWave: [...waves].sort((a, b) => b.bursts - a.bursts)[0] ?? null,
    waveSizeDistribution: distribution(waves.map(w => w.bursts)), waves, wow,
    anyWow: Object.values(wow).some(Boolean), wowExamples: waves.filter(w => w.anyWow).slice(0, 3) };
}
export function simulate(seed: number, strategy: Strategy) {
  const game = new Game(seed);
  let state = (seed ^ 0x9e3779b9) >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  game.start();
  const interval = Math.round(2 / C.dt), limit = Math.round(600 / C.dt);
  while (game.status === 'playing' && game.tick < limit) {
    if (game.tick % interval === 0) {
      const offset = random() * 2 - 1;
      const angle = strategy === 'random-up' ? -Math.PI / 2 + offset * Math.PI / 3
        : Math.atan2(C.boss.y - C.launcher.y, C.boss.x + offset * C.boss.radius - C.launcher.x);
      if (!game.fire(angle)) throw new Error('固定策略發射失敗');
    }
    game.step();
  }
  return { seed, status: game.status === 'playing' ? 'timeout' : game.status, shots: game.shots,
    seconds: game.tick * C.dt, bossHp: game.boss.hp, monsters: game.monsters.length,
    ...waveStats(game.events, C.boss.hp, game.tick) };
}
export function summarize(games: ReturnType<typeof simulate>[]) {
  const count = games.length, wins = games.filter(g => g.status === 'won').length;
  return { games: count, wins, losses: games.filter(g => g.status === 'lost').length,
    timeouts: games.filter(g => g.status === 'timeout').length, winRate: wins / count,
    averageShots: games.reduce((sum, g) => sum + g.shots, 0) / count,
    averageSeconds: games.reduce((sum, g) => sum + g.seconds, 0) / count,
    wow: { any: games.filter(g => g.anyWow).length, natural: games.filter(g => g.waves.some(w => w.anyWow && !w.endedByOutcome)).length, boss: games.filter(g => g.wow.boss).length,
      kills: games.filter(g => g.wow.kills).length, bursts: games.filter(g => g.wow.bursts).length },
    quietRatio: distribution(games.map(g => g.quietRatio)),
    waveBursts: distribution(games.flatMap(g => g.waves.map(w => w.bursts))),
    waveDurationSeconds: distribution(games.flatMap(g => g.waves.map(w => w.durationSeconds))),
    maxWaveBurstsPerGame: distribution(games.map(g => g.maxWave?.bursts ?? 0)),
    medianWaveBurstsPerGame: distribution(games.map(g => g.medianWaveBursts)) };
}
export async function run(args: string[]) {
  const option = (name: string, fallback: string) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
  const label = option('--label', 'current');
  if (!/^[a-zA-Z0-9-]+$/.test(label)) throw new Error('label 只允許英數字與連字號');
  const count = Number(option('--count', '40'));
  if (!Number.isInteger(count) || count < 1 || count > 40) throw new Error('count 必須介於 1 與 40；驗收一律用 40');
  const baseline = structuredClone(C);
  const savedConfig = args.includes('--config')
    ? JSON.parse(await readFile(resolve(option('--config', '')), 'utf8')).config : null;
  const cases: { name: string; overrides: Record<string, Record<string, number>> }[] = args.includes('--cases')
    ? JSON.parse(await readFile(resolve(option('--cases', '')), 'utf8')) : [{ name: label, overrides: savedConfig ? Object.fromEntries(Object.entries(savedConfig)
      .filter(([, v]) => typeof v === 'object' && v !== null && !Array.isArray(v))) as Record<string, Record<string, number>> : {} }];
  const outputDir = resolve(args.includes('--cases') ? 'artifacts/sweep' : 'artifacts');
  await mkdir(outputDir, { recursive: true });
  for (const candidate of cases) {
    if (!/^[a-zA-Z0-9.-]+$/.test(candidate.name)) throw new Error('候選名稱含無效字元');
    Object.assign(C, structuredClone(baseline));
    for (const [section, values] of Object.entries(candidate.overrides)) {
      const target = (C as unknown as Record<string, Record<string, number>>)[section];
      if (!target || Array.isArray(target)) throw new Error(`未知設定區段 ${section}`);
      for (const [key, value] of Object.entries(values)) {
        if (typeof target[key] !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`無效設定 ${section}.${key}`);
        target[key] = value;
      }
    }
    const results = STRATEGIES.map(strategy => {
      const games = SEEDS.slice(0, count).map(seed => simulate(seed, strategy));
      return { strategy, summary: summarize(games), games };
    });
    const [random, aimed] = results.map(r => r.summary);
    const checks = {
      quietBoth: results.every(r => r.summary.quietRatio.median >= .6),
      wowBoth: results.every(r => r.summary.wow.any / count >= .5),
      randomLossRate: random.losses / count >= .1 && random.losses / count <= .4,
      durationBoth: results.every(r => r.summary.averageSeconds >= 120 && r.summary.averageSeconds <= 300),
      aimedWinAdvantage: aimed.wins - random.wins >= count * .1,
    };
    const acceptance = { checks, allPassed: Object.values(checks).every(Boolean),
      aimedWinAdvantagePoints: (aimed.wins - random.wins) / count * 100,
      formalSample: count === 40 };
    const report = { acceptance, label: candidate.name, config: structuredClone(C), seeds: SEEDS.slice(0, count),
      protocol: { intervalSeconds: 2, timeoutSeconds: 600, firstShotTick: 0, randomUpHalfAngleDegrees: 60,
        bossNear: '每發在 Boss 中心左右一個半徑內取水平瞄準點；保留遊戲扇形隨機偏移',
        waveMetric: '依 tick 排序；相鄰爆發間隔 <= 120 ticks 歸同波，跨 chainId；實扣爆發傷害與不同怪物擊殺，排除接觸傷害',
        quietMetric: '無爆發秒窗 (0,1]、(1,2]… 的總長 / 局長；最後不足一秒按實際長度，tick 0 歸第一窗',
        wowMetric: '整波首末跨度 <= 360 ticks，且 Boss >=25% 最大 HP 或擊殺 >=3 或爆發 >=8 且 >=該局波大小中位數四倍；終局截斷另標記',
        warning: '數字門檻不是真人爽感證據；40 種子是固定驗收集，沒有獨立 holdout' }, results };
    const filename = resolve(outputDir, `balance-${label}${cases.length > 1 ? '-' + candidate.name : ''}.json`);
    // 每局一行，保留全部波段，又不把搜尋與重複縮排灌進版控。
    const header = JSON.stringify({ label: report.label, config: report.config, seeds: report.seeds, protocol: report.protocol, acceptance: report.acceptance }, null, 2);
    const body = results.map(r => `{\n"strategy":${JSON.stringify(r.strategy)},\n"summary":${JSON.stringify(r.summary, null, 2)},\n"games":[\n${r.games.map(g => JSON.stringify(g)).join(',\n')}\n]\n}`).join(',\n');
    await writeFile(filename, header.slice(0, -1) + ',"results":[\n' + body + '\n]}\n');
    console.log(JSON.stringify({ file: filename, results: results.map(r => ({ strategy: r.strategy, ...r.summary })) }));
  }
  Object.assign(C, baseline);
}
