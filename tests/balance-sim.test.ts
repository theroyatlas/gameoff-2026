import { describe, expect, it } from 'vitest';
import { waveStats, summarize } from '../scripts/balance-sim';
import type { ChainEvent } from '../src/game';

const event = (tick: number, chainId = 1, targetDamage: ChainEvent['targetDamage'] = []): ChainEvent => ({
  id: tick, tick, chainId, depth: 99, ballId: 1, kind: 'burst', radius: 84, ignitedBallIds: [], targetDamage,
});
const damage = (amount: number) => [{ targetId: 0, amount, killed: false }];
describe('時間波段與哇計分', () => {
  it('先排序，跨 chainId 合併，剛好一秒相連，多一個 tick 就拆波', () => {
    const events = [event(242, 1, damage(20)), event(121, 2, damage(15)), event(1, 1, damage(10))];
    const result = waveStats(events, 100, 600);
    expect(result.waves.map(w => [w.bursts, w.bossDamage])).toEqual([[2, 25], [1, 20]]);
    expect(result.wow.boss).toBe(true);
    expect(waveStats(events, 200, 600).wow.boss).toBe(false);
    expect(events[0].tick).toBe(242);
  });
  it('整波剛好三秒可計分，再多一 tick 即使大傷害也不算', () => {
    const events = [event(1, 1, damage(25)), event(121), event(241), event(361)];
    expect(waveStats(events, 100, 600).anyWow).toBe(true);
    expect(waveStats([...events, event(362)], 100, 600).anyWow).toBe(false);
  });
  it('擊殺計不同怪物，Boss 不算；深度高本身不算哇', () => {
    const kills = [0, 1, 2, 2, 3].map(targetId => ({ targetId, amount: 1, killed: true }));
    expect(waveStats([event(1, 1, kills)], 100, 240)).toMatchObject({ wow: { boss: false, kills: true, bursts: false } });
    expect(waveStats([event(1)], 100, 240).anyWow).toBe(false);
  });
  it('八次爆發且大於等於中位數四倍才算，不把持續長波切出短片段', () => {
    const eight = Array.from({ length: 8 }, (_, i) => event(600 + i * 10));
    const small = [event(1), event(2), event(240), event(241)];
    expect(waveStats([...small, ...eight], 100, 1000)).toMatchObject({ medianWaveBursts: 2, wow: { bursts: true } });
    expect(waveStats(eight, 100, 1000).wow.bursts).toBe(false);
    const long = Array.from({ length: 20 }, (_, i) => event(i * 60, 1, damage(10)));
    expect(waveStats(long, 100, 1500).anyWow).toBe(false);
  });
  it('秒窗不重複扣，邊界與最後半秒按實際長度算，沒有爆發全安靜', () => {
    expect(waveStats([event(1), event(120), event(121)], 100, 300)).toMatchObject({ quietSeconds: .5, quietRatio: .2 });
    expect(waveStats([event(300)], 100, 300)).toMatchObject({ quietSeconds: 2, quietRatio: .8 });
    expect(waveStats([], 100, 300)).toMatchObject({ quietSeconds: 2.5, quietRatio: 1, medianWaveBursts: 0, maxWave: null });
    expect(() => waveStats([event(301)], 100, 300)).toThrow();
  });
  it('偶數波數的中位數取平均；終局截斷另外標記', () => {
    const result = waveStats([event(1), event(240), event(241), event(242)], 100, 300);
    expect(result.medianWaveBursts).toBe(2);
    expect(result.waves.map(w => w.endedByOutcome)).toEqual([false, true]);
  });
  it('逾時獨立列出，不偷算成輸局或從平均刪除', () => {
    const result = summarize([{ seed: 1, status: 'timeout', shots: 300, seconds: 600, bossHp: 1, monsters: 1,
      ...waveStats([], 100, 72000) }]);
    expect(result).toMatchObject({ wins: 0, losses: 0, timeouts: 1, averageSeconds: 600, winRate: 0, quietRatio: { median: 1 } });
  });
});
