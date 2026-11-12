import { expect, it } from 'vitest';
import { CONFIG as C } from '../src/config';
import { Game } from '../src/game';
import { aim } from '../tools/difficulty-sim';
import { boardAim, simulateBoard, summarizeModes } from '../tools/board-difficulty-sim';

it('TUNE 優先受強化的既有候選；無 TUNE 或無候選則保持原策略', () => {
  const game = new Game(1, 'board');
  const near = game.makeBall(350, 500, 0), far = game.makeBall(500, 200, 1);
  near.resonant = far.resonant = true; game.balls.push(near, far);
  expect(boardAim(game, 'greedy', () => .5)).toBe(aim(game, 'greedy', () => .5));
  game.board!.tuneMaterial = 1;
  expect(boardAim(game, 'greedy', () => .5)).toBeCloseTo(Math.atan2(far.y - C.launcher.y, far.x - C.launcher.x));
  game.board!.tuneMaterial = 2;
  expect(boardAim(game, 'greedy', () => .5)).toBe(aim(game, 'greedy', () => .5));
  expect(boardAim(game, 'random', () => .25)).toBe(aim(game, 'random', () => .25));
  expect(boardAim(game, 'lazy', () => .5)).toBe(-Math.PI / 2);
});

it('棋盤記錄可由未包裝 Game 完整重播，含加發、波次、回合與終局', () => {
  const run = simulateBoard(20261111, 'random');
  expect(['won', 'lost']).toContain(run.status);
  const game = new Game(run.seed, 'board'); game.start();
  let shot = 0, roll = 0;
  while (game.status === 'playing' && game.tick < run.finalSnapshot.tick) {
    if (run.rolls[roll]?.tick === game.tick) { expect(game.rollBoard()).toBe(true); roll++; }
    if (run.inputs[shot]?.tick === game.tick) { expect(game.fire(run.inputs[shot].angle)).toBe(true); shot++; }
    game.step();
  }
  expect(game.snapshot()).toEqual(run.finalSnapshot);
  expect(run.turns.some(t => t.allowance > C.board.shotsPerTurn)).toBe(true);
  for (const turn of run.turns.filter(t => t.turn <= run.completedTurns)) expect(turn.shots).toBe(turn.allowance);
  expect(run.firstChainSeconds).toBe(run.chains.find(e => e.depth >= 2)!.tick * C.dt);
  expect(run.firstChainTurn).toBe(run.chains.find(e => e.depth >= 2)!.turn);
  expect(run.deepestChain).toBe(Math.max(...run.chains.map(e => e.depth)));
  expect(summarizeModes([run])).toMatchObject({ games: 1, timeouts: 0, turn: { median: run.turn } });
}, 60000);
