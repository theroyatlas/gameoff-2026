import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CONFIG as C } from '../src/config';
import { Game, type ChainEvent } from '../src/game';

// 操作亂數獨立於遊戲亂數；兩種策略都每兩秒發射，第一發在 tick 0。
export const SEEDS = Array.from({ length: 40 }, (_, i) => 20261110 + i);
export const STRATEGIES = ['random-up', 'boss-near'] as const;
type Strategy = typeof STRATEGIES[number];
export function chainStats(events: ChainEvent[], bossHp: number) {
  const chains = new Map<number, { chainId: number; bossDamage: number; kills: Set<number>; depth: number;
    firstTick: number; lastTick: number; maxGapTicks: number }>();
  for (const e of events) {
    const chain = chains.get(e.chainId) ?? { chainId: e.chainId, bossDamage: 0, kills: new Set<number>(), depth: 0,
      firstTick: e.tick, lastTick: e.tick, maxGapTicks: 0 };
    chain.maxGapTicks = Math.max(chain.maxGapTicks, e.tick-chain.lastTick); chain.lastTick = e.tick;
    chain.depth = Math.max(chain.depth, e.depth);
    for (const d of e.targetDamage) {
      if (d.targetId === 0) chain.bossDamage += d.amount;
      else if (d.killed) chain.kills.add(d.targetId);
    }
    chains.set(e.chainId, chain);
  }
  const values = [...chains.values()];
  const maxBossDamage = Math.max(0, ...values.map(c => c.bossDamage));
  const maxKills = Math.max(0, ...values.map(c => c.kills.size));
  const maxDepth = Math.max(0, ...values.map(c => c.depth));
  const wow = { boss: maxBossDamage >= bossHp * .25, kills: maxKills >= 3, depth: maxDepth >= 8 };
  const wowExamples = values.filter(c => c.bossDamage >= bossHp*.25 || c.kills.size >= 3 || c.depth >= 8)
    .sort((a,b) => (a.lastTick-a.firstTick)-(b.lastTick-b.firstTick)).slice(0,3)
    .map(c => ({ chainId: c.chainId, bossDamage: c.bossDamage, kills: c.kills.size, depth: c.depth,
      startSeconds: c.firstTick*C.dt, spanSeconds: (c.lastTick-c.firstTick)*C.dt, maxGapSeconds: c.maxGapTicks*C.dt }));
  return { maxBossDamage, maxKills, maxDepth, wow, anyWow: Object.values(wow).some(Boolean), wowExamples };
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
    ...chainStats(game.events, C.boss.hp) };
}
export function summarize(games: ReturnType<typeof simulate>[]) {
  const count = games.length, wins = games.filter(g => g.status === 'won').length;
  return { games: count, wins, losses: games.filter(g => g.status === 'lost').length,
    timeouts: games.filter(g => g.status === 'timeout').length, winRate: wins / count,
    averageShots: games.reduce((sum, g) => sum + g.shots, 0) / count,
    averageSeconds: games.reduce((sum, g) => sum + g.seconds, 0) / count,
    wow: { any: games.filter(g => g.anyWow).length, boss: games.filter(g => g.wow.boss).length,
      kills: games.filter(g => g.wow.kills).length, depth: games.filter(g => g.wow.depth).length } };
}
export async function run(args: string[]) {
  const option = (name: string, fallback: string) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
  const label = option('--label', 'current');
  if (!/^[a-zA-Z0-9-]+$/.test(label)) throw new Error('label 只允許英數字與連字號');
  const count = Number(option('--count', '40'));
  if (!Number.isInteger(count) || count < 1 || count > 40) throw new Error('count 必須介於 1 與 40；驗收一律用 40');
  const baseline = structuredClone(C);
  const cases: { name: string; overrides: Record<string, Record<string, number>> }[] = args.includes('--cases')
    ? JSON.parse(await readFile(resolve(option('--cases', '')), 'utf8')) : [{ name: label, overrides: {} }];
  await mkdir(resolve('artifacts'), { recursive: true });
  for (const candidate of cases) {
    if (!/^[a-zA-Z0-9.-]+$/.test(candidate.name)) throw new Error('候選名稱含無效字元');
    Object.assign(C, structuredClone(baseline));
    for (const [section, values] of Object.entries(candidate.overrides)) {
      const target = (C as unknown as Record<string, Record<string, number>>)[section];
      if (!target || Array.isArray(target)) throw new Error(`未知設定區段 ${section}`);
      for (const [key, value] of Object.entries(values)) {
        if (typeof target[key] !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`無效設定 ${section}.${key}`);
        target[key] = value;
      }
    }
    const results = STRATEGIES.map(strategy => {
      const games = SEEDS.slice(0, count).map(seed => simulate(seed, strategy));
      return { strategy, summary: summarize(games), games };
    });
    const report = { label: candidate.name, config: structuredClone(C), seeds: SEEDS.slice(0, count),
      protocol: { intervalSeconds: 2, timeoutSeconds: 600, firstShotTick: 0, randomUpHalfAngleDegrees: 60,
        bossNear: '每發在 Boss 中心左右一個半徑內取水平瞄準點；保留遊戲扇形隨機偏移',
        chainMetric: '依現有 chainId 聚合爆發 targetDamage；不計一般接觸傷害、不限制連鎖延遲，並非真人爽感證據' }, results };
    const filename = resolve('artifacts', `balance-${label}${cases.length > 1 ? '-' + candidate.name : ''}.json`);
    await writeFile(filename, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ file: filename, results: results.map(r => ({ strategy: r.strategy, ...r.summary })) }));
  }
  Object.assign(C, baseline);
}
