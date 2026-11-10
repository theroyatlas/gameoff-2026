import { describe, expect, it } from 'vitest';
import { chainStats, summarize } from '../scripts/balance-sim';
import type { ChainEvent } from '../src/game';

const event = (chainId: number, depth: number, targetDamage: ChainEvent['targetDamage']): ChainEvent => ({
  id: 1, tick: 1, chainId, depth, ballId: 1, kind: 'burst', radius: 84, ignitedBallIds: [], targetDamage,
});
describe('平衡模擬計分', () => {
  it('只累計同一 chainId，Boss 門檻是最大 HP 的四分之一', () => {
    const events = [event(1, 1, [{ targetId: 0, amount: 10, killed: false }]),
      event(1, 2, [{ targetId: 0, amount: 15, killed: false }]),
      event(2, 1, [{ targetId: 0, amount: 20, killed: false }])];
    expect(chainStats(events, 100)).toMatchObject({ maxBossDamage: 25, wow: { boss: true } });
    expect(chainStats(events, 600).wow.boss).toBe(false);
  });
  it('同鏈三個不同怪物死亡與八層各自成立，Boss 死亡不算怪物', () => {
    const events = [event(1, 8, [0, 1, 2, 2, 3].map(targetId => ({ targetId, amount: 1, killed: true })))];
    expect(chainStats(events, 100)).toMatchObject({ maxKills: 3, maxDepth: 8,
      wow: { boss: false, kills: true, depth: true }, anyWow: true });
    expect(chainStats([], 100)).toMatchObject({ maxDepth: 0, anyWow: false });
  });
  it('逾時獨立列出，不偷算成輸局或從平均刪除', () => {
    const result = summarize([{ seed: 1, status: 'timeout', shots: 300, seconds: 600, bossHp: 1, monsters: 1,
      ...chainStats([], 100) }]);
    expect(result).toMatchObject({ wins: 0, losses: 0, timeouts: 1, averageSeconds: 600, winRate: 0 });
  });
});
