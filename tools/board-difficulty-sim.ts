import { CONFIG as C } from '../src/config';
import { Game } from '../src/game';
import { aim, ObservedGame, quantiles, simulate, type Bot } from './difficulty-sim';

export const MODES = ['realtime', 'board'] as const;
export type Mode = typeof MODES[number];
const shotTicks = Math.round(2 / C.dt);

// TUNE 只調整既有 greedy 候選的優先順序；其餘策略直接重用來源函式。
export function boardAim(game: Game, bot: Bot, random: () => number) {
  const tune = game.board?.tuneMaterial;
  if (bot !== 'greedy' || tune == null) return aim(game, bot, random);
  const candidates = game.balls.filter(b => b.material === tune && b.y < C.launcher.y - 20
    && (b.resonant || game.balls.some(other => other.id !== b.id
      && Math.hypot(other.x - b.x, other.y - b.y) <= 4 * C.ball.radius)));
  candidates.sort((a, b) => Math.hypot(a.x - C.launcher.x, a.y - C.launcher.y)
    - Math.hypot(b.x - C.launcher.x, b.y - C.launcher.y) || a.id - b.id);
  const target = candidates[0];
  return target ? Math.max(-Math.PI + .2, Math.min(-.2,
    Math.atan2(target.y - C.launcher.y, target.x - C.launcher.x))) : aim(game, bot, random);
}

export function simulateBoard(seed: number, bot: Bot, guard = () => {}) {
  const game = new ObservedGame(seed, 'board');
  let state = (seed ^ 0x9e3779b9) >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  let nextShot = 0, eventCursor = 0, deepestChain = 0;
  let firstChainSeconds: number | null = null, firstChainTurn: number | null = null;
  let physicsTicks = 0;
  const turns: { turn: number; bossClock: number; startTick: number; shootingTick: number | null;
    endTick: number | null; shots: number; allowance: number; position: number | null; tuneMaterial: number | null;
    bossHp: number; monsters: number }[] = [];
  const chains: { tick: number; turn: number; depth: number }[] = [];
  const bossCurve = [{ tick: 0, seconds: 0, hp: game.boss.hp, monsters: 0, turn: 0 }];
  game.start();
  while (game.status === 'playing' && game.tick < Math.round(600 / C.dt)) {
    if (game.tick % 120 === 0) guard();
    const board = game.board!;
    if (board.phase === 'roll') {
      if (!game.rollBoard()) throw new Error('有效回合擲骰失敗');
      turns.push({ turn: board.turn, bossClock: board.bossClock, startTick: game.tick,
        shootingTick: null, endTick: null, shots: 0, allowance: board.shotsLeft,
        position: null, tuneMaterial: null, bossHp: game.boss.hp, monsters: game.monsters.length });
      nextShot = game.tick;
    }
    const turn = turns.at(-1)!;
    if (board.phase === 'shooting') {
      if (turn.shootingTick === null) {
        turn.shootingTick = game.tick; turn.position = board.position; turn.tuneMaterial = board.tuneMaterial;
      }
      if (game.tick >= nextShot) {
        if (!game.fire(boardAim(game, bot, random))) throw new Error('棋盤預定發球失敗');
        turn.shots++; nextShot = game.tick + shotTicks;
      }
    }
    const clock = board.bossClock, waveCursor = game.waveLog.length;
    // effect 結束當 tick 已執行物理，與 Game.step 的邊界一致。
    if (board.phase === 'shooting' || board.phase === 'settling'
      || board.phase === 'effect' && game.tick + 1 >= board.phaseUntil) physicsTicks++;
    game.step();
    for (let i = waveCursor; i < game.waveLog.length; i++) game.waveLog[i].aliveAfterStep = game.monsters.length;
    while (eventCursor < game.events.length) {
      const event = game.events[eventCursor++];
      chains.push({ tick: event.tick, turn: board.turn, depth: event.depth });
      deepestChain = Math.max(deepestChain, event.depth);
      if (event.depth >= 2 && firstChainSeconds === null) {
        firstChainSeconds = event.tick * C.dt; firstChainTurn = board.turn;
      }
    }
    if (board.bossClock !== clock || game.status !== 'playing') {
      turn.endTick = game.tick; turn.bossClock = board.bossClock;
      turn.bossHp = game.boss.hp; turn.monsters = game.monsters.length;
    }
    if (game.tick % 120 === 0) bossCurve.push({ tick: game.tick, seconds: game.tick * C.dt,
      hp: game.boss.hp, monsters: game.monsters.length, turn: board.turn });
  }
  if (bossCurve.at(-1)!.tick !== game.tick) bossCurve.push({ tick: game.tick, seconds: game.tick * C.dt,
    hp: game.boss.hp, monsters: game.monsters.length, turn: game.board!.turn });
  return { seed, bot, mode: 'board' as const, status: game.status === 'playing' ? 'timeout' : game.status,
    seconds: game.tick * C.dt, turn: game.board!.turn, completedTurns: game.board!.bossClock,
    physicsSeconds: physicsTicks * C.dt, shots: game.shots, deepestChain, bossHp: game.boss.hp,
    firstChainSeconds, firstChainTurn, turns, rolls: game.board!.rolls, inputs: game.inputs,
    chains, waves: game.waveLog, bossCurve, finalSnapshot: game.snapshot() };
}

export function simulateMode(seed: number, bot: Bot, mode: Mode, guard = () => {}) {
  if (mode === 'board') return simulateBoard(seed, bot, guard);
  return { ...simulate(seed, bot, guard), mode: 'realtime' as const,
    turn: null, completedTurns: null, firstChainTurn: null };
}
export type ModeRun = ReturnType<typeof simulateMode>;

export function summarizeModes(runs: ModeRun[]) {
  const values = (key: 'seconds' | 'turn' | 'completedTurns' | 'firstChainSeconds' | 'firstChainTurn' | 'bossHp' | 'deepestChain' | 'shots', rows = runs) =>
    quantiles(rows.flatMap(r => r[key] == null ? [] : [r[key] as number]));
  const losses = runs.filter(r => r.status === 'lost');
  return { games: runs.length, wins: runs.filter(r => r.status === 'won').length,
    losses: losses.length, timeouts: runs.filter(r => r.status === 'timeout').length,
    winRate: runs.length ? runs.filter(r => r.status === 'won').length / runs.length : null,
    seconds: values('seconds'), turn: values('turn'), completedTurns: values('completedTurns'),
    firstChainSeconds: values('firstChainSeconds'), firstChainTurn: values('firstChainTurn'),
    lossSeconds: values('seconds', losses), lossTurn: values('turn', losses),
    bossHp: values('bossHp'), lossBossHp: values('bossHp', losses),
    deepestChain: values('deepestChain'), shots: values('shots'),
    deepestChainMax: runs.length ? Math.max(...runs.map(r => r.deepestChain)) : null,
    lossPoints: losses.map(r => ({ seed: r.seed, seconds: r.seconds, turn: r.turn, bossHp: r.bossHp })) };
}
