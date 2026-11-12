import { CONFIG as C } from '../src/config';
import type { Game } from '../src/game';

export const BOTS = ['random', 'greedy', 'lazy'] as const;
export type Bot = typeof BOTS[number];

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
