import { Game } from '../src/game';
import { CONFIG as C } from '../src/config';
import { boardAim, type Bot } from './bot-aim';

// 同一份規則、bot 與逐 tick 驅動器供 Node／Edge 使用；不經 RAF 或 DOM 角度換算。
export function fingerprint(value: unknown) {
  const text = JSON.stringify(value);
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
type Recording = { seed: number; inputs: { tick: number; angle: number }[]; rolls: { tick: number }[] };
export function run(options: { seed: number; bot?: Bot; recording?: Recording; hashes?: boolean; stopAt?: number }) {
  const game = new Game(options.seed, 'board');
  let state = (options.seed ^ 0x9e3779b9) >>> 0, nextShot = 0, shot = 0, roll = 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const hashes: { tick: number; hash: string }[] = [];
  // 這些記錄在 tick 結束後只追加；滾動摘要避免每 tick 重複序列化整局歷史。
  const history = new Map<string, { count: number; hash: string }>();
  function stateHash() {
    const value: Record<string, unknown> = { ...game, contacts: [...game.contacts].sort(), board: { ...game.board! } };
    for (const key of ['events', 'inputs', 'shifts', 'replays', 'board.rolls', 'board.cards']) {
      const [group, child] = key.split('.');
      const array = (child ? (game as any)[group][child] : (game as any)[group]) as unknown[];
      const digest = history.get(key) ?? { count: 0, hash: '' };
      while (digest.count < array.length) digest.hash = fingerprint([digest.hash, array[digest.count++]]);
      history.set(key, digest);
      if (child) (value[group] as Record<string, unknown>)[child] = { ...digest };
      else value[group] = { ...digest };
    }
    return fingerprint(value);
  }
  game.start();
  let stalled: unknown = null;
  while (game.status === 'playing' && game.tick < (options.stopAt ?? 72000)) {
    const tick = game.tick;
    if (options.recording) {
      if (options.recording.rolls[roll]?.tick === tick) {
        if (!game.rollBoard()) { stalled = { tick, action: 'roll' }; break; } roll++;
      }
      if (options.recording.inputs[shot]?.tick === tick) {
        if (!game.fire(options.recording.inputs[shot].angle)) { stalled = { tick, action: 'fire' }; break; } shot++;
      }
    } else {
      if (game.board!.phase === 'roll') { game.rollBoard(); nextShot = tick; }
      if (game.board!.phase === 'shooting' && tick >= nextShot) {
        game.fire(boardAim(game, options.bot ?? 'greedy', random)); nextShot = tick + Math.round(2 / C.dt);
      }
    }
    game.step();
    if (options.hashes) hashes.push({ tick: game.tick, hash: stateHash() });
    if (game.tick === tick) { stalled = { tick, action: 'step', phase: game.board!.phase }; break; }
  }
  return { seed: options.seed, bot: options.bot, status: game.status, tick: game.tick, shots: game.shots,
    bossHp: game.boss.hp, stalled, hashes, snapshot: game.snapshot() };
}

export function mathSamples() {
  return { cos: Math.cos(-1.5), sin: Math.sin(-1.5), exp: Math.exp(-C.ball.friction * C.dt),
    hypot: Math.hypot(33.123, 54.321), atan2: Math.atan2(-282, 71) };
}

export function wakeSamples(randomState: number, count: number) {
  const rng = new Game(randomState, 'board');
  return Array.from({ length: count }, (_, index) => {
    const random = rng.random(), angle = random * Math.PI * 2;
    return { index, random, angle, sin: Math.sin(angle), cos: Math.cos(angle),
      vy: Math.sin(angle) * C.shift.wakeSpeed, vx: Math.cos(angle) * C.shift.wakeSpeed };
  });
}
