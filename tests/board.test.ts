import { describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import { CONFIG as C } from '../src/config';

function active(seed = 1) { const g = new Game(seed, 'board'); g.start(); return g; }
function advance(g: Game, ticks: number) { for (let i = 0; i < ticks; i++) g.step(); }
function land(g: Game, position: number) {
  // 指定起點後仍走真實擲骰／逐格狀態機，沒有改骰子或 RNG。
  expect(g.rollBoard()).toBe(true);
  g.board!.position = (position - g.board!.die + C.board.tiles.length) % C.board.tiles.length;
  while (g.board!.phase !== 'effect') g.step();
}
function shootTurn(g: Game) {
  if (g.board!.phase === 'roll') g.rollBoard();
  while (g.board!.phase !== 'shooting') g.step();
  while (g.board!.phase === 'shooting') {
    g.fire(-Math.PI / 2);
    if (g.board!.phase === 'shooting') advance(g, C.launcher.intervalTicks);
  }
}

describe('棋盤回合', () => {
  it('14 格包含 1 START、5 SURGE、5 TUNE、3 EVENT；材質均有效', () => {
    expect(C.board.tiles).toHaveLength(14);
    for (const [kind, count] of [['START', 1], ['SURGE', 5], ['TUNE', 5], ['EVENT', 3]] as const)
      expect(C.board.tiles.filter(tile => tile.kind === kind)).toHaveLength(count);
    for (const tile of C.board.tiles) if (tile.kind === 'TUNE') expect(C.materials[tile.material]).toBeDefined();
  });
  it('只在等待擲骰時接受骰子；骰子與發射共用 seeded RNG', () => {
    const g = new Game(42, 'board'), rng = new Game(42);
    expect(g.rollBoard()).toBe(false); g.start();
    expect(g.fire(-1)).toBe(false);
    expect(g.rollBoard()).toBe(true);
    expect(g.board!.die).toBe(1 + Math.floor(rng.random() * 6));
    expect(g.randomState).toBe(rng.randomState);
    expect(g.rollBoard()).toBe(false); expect(g.fire(-1)).toBe(false);
    expect(new Game().rollBoard()).toBe(false);
  });
  it('順時針逐格走，13 跨到 0 計一圈；當回合仍只有 3 發', () => {
    const g = active(); g.board!.position = 13; g.rollBoard();
    const die = g.board!.die;
    advance(g, C.board.rollTicks + C.board.moveTicks - 1);
    expect(g.board!.position).toBe(13); g.step();
    expect(g.board!.position).toBe(0); expect(g.board!.laps).toBe(1);
    expect(g.board!.nextTurnBonus).toBe(1); expect(g.board!.shotsLeft).toBe(3);
    advance(g, C.board.moveTicks * (die - 1));
    expect(g.board!.position).toBe((13 + die) % 14); expect(g.board!.phase).toBe('effect');
  });
  it('START 獎勵只在下一回合兌現一次，落在 START 不重複加發', () => {
    const g = active(); land(g, 0);
    expect(g.board!.nextTurnBonus).toBe(1); expect(g.board!.shotsLeft).toBe(3);
    shootTurn(g); advance(g, C.board.settleMaxTicks);
    expect(g.board!.phase).toBe('roll'); expect(g.rollBoard()).toBe(true);
    expect(g.board!.shotsLeft).toBe(4); expect(g.board!.nextTurnBonus).toBe(0);
    shootTurn(g); advance(g, C.board.settleMaxTicks); g.rollBoard();
    expect(g.board!.shotsLeft).toBe(3);
  });
  it('SURGE 喚醒全部留場球，包含冷卻／已共振球，震盪各加 1', () => {
    const g = active();
    const balls = [g.makeBall(100, 100), g.makeBall(220, 100, 1), g.makeBall(340, 100, 2)];
    g.balls.push(...balls); balls[0].cooldown = 9999;
    balls[1].oscillation = 1; balls[2].oscillation = 2; balls[2].resonant = true; balls[2].vx = 600;
    land(g, 1);
    expect(balls.map(b => b.oscillation)).toEqual([1, 2, 3]);
    expect(balls.map(b => b.resonant)).toEqual([false, true, true]);
    expect(balls.every(b => Math.hypot(b.vx, b.vy) >= C.shift.wakeSpeed - 1e-8)).toBe(true);
    expect(balls.every(b => b.cooldown === 0)).toBe(true);
    expect(g.balls).toHaveLength(3);
  });
  it('TUNE 只降低綁定材質門檻，已累積的球立即共振', () => {
    const g = active(), a = g.makeBall(100, 100, 0), b = g.makeBall(200, 100, 1);
    a.oscillation = b.oscillation = 1; g.balls.push(a, b); land(g, 2);
    expect(g.resonanceThreshold(a)).toBe(1); expect(g.resonanceThreshold(b)).toBe(2);
    expect(a.resonant).toBe(true); expect(b.resonant).toBe(false);
    const c = g.makeBall(300, 100, 0); g.charge(c, 1); expect(c.resonant).toBe(true);
  });
  it('TUNE 同頻倍率乘 1.5，範圍及傷害同步放大；其他材質維持原倍率', () => {
    const g = active(); land(g, 2);
    const a = g.makeBall(320, C.boss.y, 0), b = g.makeBall(320, C.boss.y + 28, 0);
    g.balls.push(a, b); g.charge(a, 1); g.charge(b, 1); g.collide(a, b);
    const multiplier = C.resonance.sameFrequencyMultiplier * 1.5;
    expect(g.events.map(e => e.radius)).toEqual([C.ball.radius * C.resonance.radiusInBalls * multiplier, C.ball.radius * C.resonance.radiusInBalls * multiplier]);
    expect(g.boss.hp).toBe(C.boss.hp - 2 * C.damage.burstExtra * multiplier);
    expect(g.sameFrequencyMultiplier(g.makeBall(50, 50, 1))).toBe(C.resonance.sameFrequencyMultiplier);
  });
  it('EVENT 在落格時抽一張牌並消耗 seeded RNG', () => {
    const g = active(); g.rollBoard(); g.board!.position = (3 - g.board!.die + 14) % 14;
    const state = g.randomState;
    while (g.board!.phase !== 'effect') g.step();
    expect(g.board!.position).toBe(3); expect(g.board!.tuneMaterial).toBeNull();
    expect(g.balls).toHaveLength(0); expect(g.randomState).not.toBe(state);
    expect(g.board!.cards).toHaveLength(1);
  });
  it('發完 3 發才結算，球還在動最多等 6 秒，Boss 鐘只加一次', () => {
    const g = active(); shootTurn(g);
    expect(g.shots).toBe(3); expect(g.board!.phase).toBe('settling'); expect(g.fire(-1)).toBe(false);
    const deadline = g.board!.phaseUntil;
    while (g.tick < deadline - 1) {
      for (const b of g.balls) { b.x = 200; b.y = 200 + b.id * 40; b.vx = 100; b.vy = 0; }
      g.step();
    }
    expect(g.board!.bossClock).toBe(0); g.step();
    expect(g.tick).toBe(deadline); expect(g.board!.phase).toBe('roll'); expect(g.board!.bossClock).toBe(1);
    const before = g.snapshot(); advance(g, 1000); expect(g.snapshot()).toEqual(before);
  });
  it('球停下且無未結束相變時提早結算，TUNE 在回合結束還原', () => {
    const g = active(); land(g, 2); shootTurn(g);
    for (const b of g.balls) { b.vx = b.vy = 0; b.x = 100 + b.id * 60; b.y = 100; b.oscillation = 1; b.resonant = b.material === 0; }
    g.phase = 'idle'; g.shiftReadyAt = g.tick + 1000;
    const start = g.tick; g.step();
    expect(g.tick).toBe(start + 1); expect(g.board!.phase).toBe('roll');
    expect(g.board!.tuneMaterial).toBeNull(); expect(g.balls.every(b => !b.resonant)).toBe(true);
  });
  it('依設定回合間隔出怪，鐘越高數量與血量越高，秒數與半血不額外生怪', () => {
    const g = active(); g.tick = 100000; g.boss.hp = 1; g.updateDifficulty();
    expect(g.monsters).toHaveLength(0); expect(g.upgraded).toBe(false);
    for (let turn = 1; turn <= 3 * C.board.waveEveryTurns; turn++) {
      g.board!.bossClock = turn; g.updateDifficulty();
      expect(g.wave).toBe(Math.floor(turn / C.board.waveEveryTurns));
    }
    expect(g.monsters).toHaveLength(7); expect(g.monsters.at(-1)!.hp).toBe(C.monsters.hp + 2 * C.board.waveHpGrowth);
    expect(g.wavePlan(3).count).toBeGreaterThan(g.wavePlan(1).count);
    const n = g.monsters.length; g.updateDifficulty(); expect(g.monsters).toHaveLength(n);
  });
  it('自然回合結算確實推進波次並可抵達終局', () => {
    const g = active(20261111);
    for (let i = 0; i < 60000 && g.status === 'playing'; i++) {
      if (g.board!.phase === 'roll') g.rollBoard();
      if (g.board!.phase === 'shooting') g.fire(-Math.PI / 2 + Math.sin(g.shots * 2) * .9);
      g.step();
    }
    expect(['won', 'lost']).toContain(g.status);
    expect(g.board!.bossClock).toBeGreaterThanOrEqual(C.board.waveEveryTurns); expect(g.wave).toBe(Math.floor(g.board!.bossClock / C.board.waveEveryTurns));
    const before = g.snapshot(); expect(g.rollBoard()).toBe(false); expect(g.fire(-1)).toBe(false); g.step(); expect(g.snapshot()).toEqual(before);
  });
  it('同 seed、同操作重現完整一局的骰子、球、相變、波次及勝負；重來清空棋盤', () => {
    const run = (seed: number) => {
      const g = active(seed);
      for (let i = 0; i < 60000 && g.status === 'playing'; i++) {
        if (g.board!.phase === 'roll') g.rollBoard();
        if (g.board!.phase === 'shooting') g.fire(-Math.PI / 2 + Math.sin(g.shots * 2) * .9);
        g.step();
      }
      return g;
    };
    const a = run(87), b = run(87);
    expect(a.status).not.toBe('playing'); expect(a.snapshot()).toEqual(b.snapshot());
    expect(run(88).board!.rolls).not.toEqual(a.board!.rolls);
    a.reset(); expect(a.snapshot()).toEqual(new Game(87, 'board').snapshot());
  }, 20000);
});
