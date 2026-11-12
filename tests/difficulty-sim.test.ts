import { describe, expect, it } from 'vitest';
import { CONFIG as C } from '../src/config';
import { Game } from '../src/game';
import { ObservedGame, quantiles, summarize, aim, type Run } from '../tools/difficulty-sim';

describe('難度量測可信度', () => {
  it('分位數使用線性內插；空事件不偽造成零秒', () => {
    expect(quantiles([])).toEqual({ n: 0, p10: null, median: null, p90: null });
    expect(quantiles([10, 0])).toEqual({ n: 2, p10: 1, median: 5, p90: 9 });
  });
  it('10 秒含邊界、未發生保留在比例分母，逾時不算輸局', () => {
    const rows = [10, 10 + C.dt, null].map((firstChainSeconds, i) => ({
      firstChainSeconds, firstCollisionSeconds: null, firstShiftSeconds: null, upgradeSeconds: null,
      status: i === 0 ? 'won' : i === 1 ? 'lost' : 'timeout', seconds: 100, shots: 50, deepestChain: 2, bins: [],
    } as unknown as Run));
    expect(summarize(rows)).toMatchObject({ games: 3, wins: 1, losses: 1, timeouts: 1,
      earlyChains: 1, earlyChainRate: 1 / 3, firstChainSeconds: { n: 2 }, firstCollisionSeconds: { n: 0 } });
  });
  it('觀察 wrapper 不改動任何遊戲 snapshot；記錄出怪前後與規則波次', () => {
    const base = new Game(123), observed = new ObservedGame(123);
    base.start(); observed.start();
    for (let tick = 0; tick < Math.round(76 / C.dt); tick++) {
      if (tick % 240 === 0) {
        const angle = aim(base, 'greedy', () => .5);
        base.fire(angle); observed.fire(angle);
      }
      base.step(); observed.step();
    }
    expect(observed.snapshot()).toEqual(base.snapshot());
    expect(observed.waveLog.filter(w => w.kind === 'scheduled').map(w => [w.seconds, w.planned, w.spawned, w.hp]))
      .toEqual([[15, 2, 2, 60], [45, 2, 2, 60], [75, 3, 3, 240]]);
  });
  it('greedy 選最近群聚或共振點，沒有候選時朝中央', () => {
    const game = new Game(1);
    expect(aim(game, 'greedy', () => 0)).toBe(-Math.PI / 2);
    const far = game.makeBall(500, 200), near = game.makeBall(350, 500);
    far.resonant = near.resonant = true;
    game.balls.push(far, near);
    expect(aim(game, 'greedy', () => 0)).toBeCloseTo(Math.atan2(500 - C.launcher.y, 350 - C.launcher.x));
    expect(aim(game, 'lazy', () => 0)).toBe(-Math.PI / 2);
  });
});
