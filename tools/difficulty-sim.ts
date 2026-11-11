import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { CONFIG as C } from '../src/config';
import { Game } from '../src/game';

export const BOTS = ['random', 'greedy', 'lazy'] as const;
export type Bot = typeof BOTS[number];
const secondTicks = Math.round(1 / C.dt);
const shotTicks = Math.round(2 / C.dt);
const limitTicks = Math.round(600 / C.dt);
type Spawn = { id: number; hp: number };
type Wave = { tick: number; seconds: number; wave: number; kind: 'scheduled' | 'upgrade'; planned: number; spawned: number; hp: number; aliveBefore: number; aliveAfterSpawn: number; aliveAfterStep: number; ids: number[] };

// 只觀察既有公開方法；每次都先執行原方法，沒有修改遊戲狀態或規則。
export class ObservedGame extends Game {
  spawnLog: Spawn[] = [];
  waveLog: Wave[] = [];
  override spawnMonster(hp: number = C.monsters.hp) {
    const before = this.monsters.length;
    super.spawnMonster(hp);
    if (this.monsters.length > before) {
      const monster = this.monsters.at(-1)!;
      this.spawnLog.push({ id: monster.id, hp: monster.maxHp });
    }
  }
  override updateDifficulty() {
    const wave = this.wave, upgraded = this.upgraded, before = this.monsters.length;
    const cursor = this.spawnLog.length;
    super.updateDifficulty();
    const spawns = this.spawnLog.slice(cursor);
    const add = (kind: Wave['kind'], planned: number, actual: Spawn[], aliveBefore: number) => {
      this.waveLog.push({ tick: this.tick, seconds: this.tick * C.dt, wave: this.wave, kind, planned,
        spawned: actual.length, hp: this.wavePlan(this.wave).hp, aliveBefore,
        aliveAfterSpawn: aliveBefore + actual.length, aliveAfterStep: 0, ids: actual.map(s => s.id) });
    };
    if (this.wave !== wave) {
      const count = this.wavePlan(this.wave).count;
      // 失敗門檻僅 11 隻，候選位置足夠；若配置改變，拒絕把額外怪物誤分波。
      if (spawns.length < count && !upgraded && this.upgraded) throw new Error('同 tick 出怪來源無法辨識');
      add('scheduled', count, spawns.slice(0, count), before);
      if (!upgraded && this.upgraded) add('upgrade', 3, spawns.slice(count), before + Math.min(count, spawns.length));
    } else if (!upgraded && this.upgraded) add('upgrade', 3, spawns, before);
  }
}

export function quantiles(values: number[]) {
  if (!values.length) return { n: 0, p10: null, median: null, p90: null };
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const index = (sorted.length - 1) * p, low = Math.floor(index), fraction = index - low;
    return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * fraction;
  };
  return { n: values.length, p10: q(.1), median: q(.5), p90: q(.9) };
}

export function aim(game: Game, bot: Bot, random: () => number) {
  if (bot === 'lazy') return -Math.PI / 2;
  // 和鍵盤可選方向一致；散射仍交由 Game.fire 的獨立 RNG 決定。
  if (bot === 'random') return -Math.PI + .2 + random() * (Math.PI - .4);
  const candidates = game.balls.filter(b => b.y < C.launcher.y - 20).filter(b =>
    b.resonant || game.balls.some(other => other.id !== b.id && Math.hypot(other.x - b.x, other.y - b.y) <= 4 * C.ball.radius));
  candidates.sort((a, b) => Math.hypot(a.x - C.launcher.x, a.y - C.launcher.y)
    - Math.hypot(b.x - C.launcher.x, b.y - C.launcher.y) || a.id - b.id);
  const target = candidates[0] ?? game.boss;
  return Math.max(-Math.PI + .2, Math.min(-.2, Math.atan2(target.y - C.launcher.y, target.x - C.launcher.x)));
}

type Bin = { from: number; to: number; ticks: number; monsterSum: number; monsterMax: number; bossDamage: number; bursts: number; deepBursts: number };
export function simulate(seed: number, bot: Bot, guard = () => {}) {
  const game = new ObservedGame(seed);
  let state = (seed ^ 0x9e3779b9) >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  let firstCollision: number | null = null, firstChain: number | null = null;
  let eventCursor = 0, deepestChain = 0;
  const bossCurve = [{ tick: 0, seconds: 0, hp: game.boss.hp, monsters: 0 }];
  const bins: Bin[] = [];
  game.start();
  while (game.status === 'playing' && game.tick < limitTicks) {
    if (game.tick % secondTicks === 0) guard();
    if (game.tick % shotTicks === 0 && !game.fire(aim(game, bot, random))) throw new Error('預定發球失敗');
    const hpBefore = game.boss.hp, waveCursor = game.waveLog.length;
    game.step();
    for (let i = waveCursor; i < game.waveLog.length; i++) game.waveLog[i].aliveAfterStep = game.monsters.length;
    if (firstCollision === null) firstCollision = game.effects.find(e => e.kind === 'impact')?.tick ?? null;
    const binIndex = Math.floor((game.tick - 1) / (30 * secondTicks));
    const bin = bins[binIndex] ??= { from: binIndex * 30, to: (binIndex + 1) * 30, ticks: 0, monsterSum: 0, monsterMax: 0, bossDamage: 0, bursts: 0, deepBursts: 0 };
    bin.ticks++; bin.monsterSum += game.monsters.length; bin.monsterMax = Math.max(bin.monsterMax, game.monsters.length);
    bin.bossDamage += hpBefore - game.boss.hp;
    while (eventCursor < game.events.length) {
      const event = game.events[eventCursor++];
      bin.bursts++;
      if (event.depth >= 2) { firstChain ??= event.tick; bin.deepBursts++; }
      deepestChain = Math.max(deepestChain, event.depth);
    }
    if (game.tick % secondTicks === 0) bossCurve.push({ tick: game.tick, seconds: game.tick * C.dt, hp: game.boss.hp, monsters: game.monsters.length });
  }
  if (bossCurve.at(-1)!.tick !== game.tick) bossCurve.push({ tick: game.tick, seconds: game.tick * C.dt, hp: game.boss.hp, monsters: game.monsters.length });
  const seconds = (tick: number | null | undefined) => tick == null ? null : tick * C.dt;
  return { seed, bot, status: game.status === 'playing' ? 'timeout' : game.status,
    seconds: game.tick * C.dt, shots: game.shots, deepestChain, bossHp: game.boss.hp,
    firstCollisionSeconds: seconds(firstCollision), firstChainSeconds: seconds(firstChain),
    firstShiftSeconds: seconds(game.shifts.find(s => s.kind === 'active')?.tick),
    firstShiftWarningSeconds: seconds(game.shifts.find(s => s.kind === 'warning')?.tick),
    shifts: game.shifts, upgradeSeconds: game.waveLog.find(w => w.kind === 'upgrade')?.seconds ?? null,
    waves: game.waveLog, bossCurve, bins };
}
export type Run = ReturnType<typeof simulate>;
export function summarize(runs: Run[]) {
  const found = (key: 'firstCollisionSeconds' | 'firstChainSeconds' | 'firstShiftSeconds' | 'upgradeSeconds') => quantiles(runs.flatMap(r => r[key] === null ? [] : [r[key]]));
  const wins = runs.filter(r => r.status === 'won').length;
  const earlyChains = runs.filter(r => r.firstChainSeconds !== null && r.firstChainSeconds <= 10).length;
  const monsterBins = Array.from({ length: Math.max(0, ...runs.map(r => r.bins.length)) }, (_, i) => {
    const present = runs.flatMap(r => r.bins[i] ? [r.bins[i]] : []);
    const ticks = present.reduce((n, b) => n + b.ticks, 0);
    return { from: i * 30, to: (i + 1) * 30, activeGames: present.length, exposureSeconds: ticks * C.dt,
      meanMonsters: present.reduce((n, b) => n + b.monsterSum, 0) / ticks,
      bossDamagePerSecond: present.reduce((n, b) => n + b.bossDamage, 0) / (ticks * C.dt),
      burstsPerSecond: present.reduce((n, b) => n + b.bursts, 0) / (ticks * C.dt),
      losses: runs.filter(r => r.status === 'lost' && r.seconds > i * 30 && r.seconds <= (i + 1) * 30).length,
      wins: runs.filter(r => r.status === 'won' && r.seconds > i * 30 && r.seconds <= (i + 1) * 30).length };
  });
  return { games: runs.length, wins, losses: runs.filter(r => r.status === 'lost').length,
    timeouts: runs.filter(r => r.status === 'timeout').length, winRate: wins / runs.length,
    earlyChains, earlyChainRate: earlyChains / runs.length,
    earlyLosses: runs.filter(r => r.status === 'lost' && r.seconds <= 60).length,
    firstCollisionSeconds: found('firstCollisionSeconds'), firstChainSeconds: found('firstChainSeconds'),
    firstShiftSeconds: found('firstShiftSeconds'), upgradeSeconds: found('upgradeSeconds'),
    seconds: quantiles(runs.map(r => r.seconds)), shots: quantiles(runs.map(r => r.shots)),
    deepestChain: quantiles(runs.map(r => r.deepestChain)), monsterBins };
}

export async function run(args: string[]) {
  const option = (name: string, fallback: string) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
  const count = Number(option('--count', '50'));
  if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error('count 必須是 1–500');
  const started = Date.now(), cpuStart = process.cpuUsage();
  const maxSeconds = Number(option('--budget-seconds', '1500'));
  if (!Number.isFinite(maxSeconds) || maxSeconds < 1 || maxSeconds > 1800) throw new Error('計算時間上限 1800 秒');
  let peakRss = 0, stoppedReason: string | null = null;
  const guard = () => {
    const used = process.cpuUsage(cpuStart), cpu = (used.user + used.system) / 1e6;
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
    if (cpu >= maxSeconds || (Date.now() - started) / 1000 >= maxSeconds) throw new Error('計算時間預算到達');
    if (peakRss >= 3 * 1024 ** 3) throw new Error('RAM 保守停止線 3 GiB 到達');
  };
  const rulesCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const sourceHashes = Object.fromEntries(await Promise.all(['src/game.ts', 'src/config.ts'].map(async p =>
    [p, createHash('sha256').update(await readFile(p)).digest('hex')])));
  const dir = resolve('artifacts/difficulty');
  await mkdir(dir, { recursive: true });
  const runs: Run[] = [];
  const persist = async () => {
    const cpu = process.cpuUsage(cpuStart);
    const report = { schema: 1, rulesCommit, sourceHashes, config: C, requestedSeedsPerBot: count,
      protocol: { seedStart: 20261111, fixedDt: C.dt, shotIntervalSeconds: 2, firstShotTick: 0,
        maxGameSeconds: 600, shiftDefinition: 'active', chainDefinition: 'ChainEvent.depth >= 2',
        quantiles: '線性內插 (n-1)*p；未發生時間不補 0，另列 n',
        random: '均勻選擇 [-PI+0.2, -0.2]，操作 RNG 獨立',
        greedy: '瞄準發射器上方最近共振球或含 4 球半徑內鄰球的球；無候選時瞄準 Boss；同距取較小 id',
        lazy: '永遠 -PI/2，仍保留 Game.fire 的隨機散射',
        curve: '每秒及終局取樣；終局後不補值；30 秒窗以實際 tick 加權',
        budgetSeconds: maxSeconds, rssStopGiB: 3 },
      resources: { wallSeconds: (Date.now() - started) / 1000, cpuSeconds: (cpu.user + cpu.system) / 1e6, peakRssBytes: peakRss },
      stoppedReason, results: BOTS.map(bot => ({ bot, summary: summarize(runs.filter(r => r.bot === bot)), runs: runs.filter(r => r.bot === bot) })) };
    await writeFile(resolve(dir, 'summary.tmp'), JSON.stringify(report, null, 2) + '\n');
    await rename(resolve(dir, 'summary.tmp'), resolve(dir, 'summary.json'));
  };
  for (let i = 0; i < count; i++) {
    for (const bot of BOTS) {
      try {
        guard();
        const result = simulate(20261111 + i, bot, guard);
        runs.push(result);
        console.log(JSON.stringify({ bot, seed: result.seed, status: result.status, seconds: result.seconds,
          firstChain: result.firstChainSeconds, elapsedSeconds: Math.round((Date.now() - started) / 1000) }));
      } catch (error) {
        stoppedReason = error instanceof Error ? error.message : String(error);
        if (!/預算到達|停止線/.test(stoppedReason)) throw error;
        break;
      }
    }
    await persist();
    if (stoppedReason) break;
  }
  await persist();
  const bossRows = ['bot,seed,tick,seconds,boss_hp,monsters'];
  const waveRows = ['bot,seed,tick,seconds,wave,kind,planned,spawned,hp,alive_before,alive_after_spawn,alive_after_step'];
  for (const r of runs) {
    for (const p of r.bossCurve) bossRows.push([r.bot, r.seed, p.tick, p.seconds, p.hp, p.monsters].join(','));
    for (const w of r.waves) waveRows.push([r.bot, r.seed, w.tick, w.seconds, w.wave, w.kind, w.planned, w.spawned, w.hp, w.aliveBefore, w.aliveAfterSpawn, w.aliveAfterStep].join(','));
  }
  await writeFile(resolve(dir, 'boss-hp.csv'), bossRows.join('\n') + '\n');
  await writeFile(resolve(dir, 'waves.csv'), waveRows.join('\n') + '\n');
  console.log(JSON.stringify({ complete: !stoppedReason, stoppedReason, games: runs.length, output: dir }));
}
