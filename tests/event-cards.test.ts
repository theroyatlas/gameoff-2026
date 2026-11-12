import { describe, expect, it, vi } from 'vitest';
import { Game } from '../src/game';
import { CONFIG as C } from '../src/config';
import { EVENT_CARDS, type EventCardId } from '../src/event-cards';

function draw(g: Game, id: EventCardId) {
  g.start(); g.board!.phase = 'roll'; g.rollBoard();
  g.board!.position = (3 - g.board!.die + 14) % 14;
  const rng = vi.spyOn(g, 'random').mockReturnValue((EVENT_CARDS.findIndex(c => c.id === id) + .5) / EVENT_CARDS.length);
  while (String(g.board!.phase) !== 'effect') g.step();
  expect(rng).toHaveBeenCalledTimes(1); rng.mockRestore();
  expect(g.board!.cards.at(-1)!.id).toBe(id);
}
function readyToFire(g: Game) { while (g.board!.phase !== 'shooting') g.step(); }
describe('EVENT 六張卡', () => {
  it('多留一發：只兌現於下一回合，與原本繞圈獎勵累計', () => {
    const g = new Game(10, 'board'); draw(g, 'extra-shot');
    expect(g.board!.shotsLeft).toBe(3);
    expect(g.board!.nextTurnBonus).toBe(C.board.events.bonusShots + g.board!.laps * C.board.lapBonusShots);
    const earned = g.board!.nextTurnBonus;
    g.board!.nextTurnBonus += 1; g.board!.phase = 'roll'; g.rollBoard();
    expect(g.board!.shotsLeft).toBe(3 + 1 + earned);
    expect(g.board!.nextTurnBonus).toBe(0);
  });
  it('換個材質：只覆寫下一次成功發射，無效發射不消耗', () => {
    const g = new Game(10, 'board'); draw(g, 'change-material');
    expect(g.nextMaterial).toBe(1); expect(g.fire(-1)).toBe(false); expect(g.nextMaterial).toBe(1);
    readyToFire(g); expect(g.fire(-Math.PI / 2)).toBe(true);
    expect(g.inputs[0].material).toBe(1); expect(g.board!.nextMaterial).toBeNull();
    expect(g.nextMaterial).toBe(g.shots % C.materials.length);
  });
  it('鐘慢一拍：最低為零，延後新波次，不重複既有波次', () => {
    const g = new Game(10, 'board'); g.start(); g.board!.bossClock = 5; g.updateDifficulty();
    const count = g.monsters.length; draw(g, 'rewind'); expect(g.board!.bossClock).toBe(4);
    g.board!.bossClock = 5; g.updateDifficulty(); expect(g.monsters.length).toBe(count);
    g.board!.bossClock = 6; g.updateDifficulty(); expect(g.wave).toBe(2);
    const empty = new Game(10, 'board'); draw(empty, 'rewind'); expect(empty.board!.bossClock).toBe(0);
  });
  it('雙倍共鳴：指定最後射出的球，傷害與範圍只加倍一次', () => {
    const g = new Game(10, 'board'), b = g.makeBall(400, 250); g.balls.push(b);
    draw(g, 'double-burst'); expect(g.board!.boostedBallId).toBe(b.id);
    g.burst(b); expect(g.events[0].radius).toBe(C.ball.radius * C.resonance.radiusInBalls * 2);
    expect(g.boss.hp).toBe(C.boss.hp - C.damage.burstExtra * 2);
    g.burst(b); expect(g.events[1].radius).toBe(C.ball.radius * C.resonance.radiusInBalls);
    expect(g.board!.boostedBallId).toBeNull();
  });
  it('即刻釋放：只引爆一顆、保留身份與球，傷害會判定勝負', () => {
    const g = new Game(10, 'board'), b = g.makeBall(400, 250); g.balls.push(b); g.boss.hp = 1;
    draw(g, 'burst-now'); expect(g.events).toHaveLength(1); expect(g.events[0].ballId).toBe(b.id);
    expect(g.balls).toEqual([b]); expect(g.status).toBe('won');
  });
  it('輕敲核心：固定小額傷害、可結束遊戲、不傷怪物', () => {
    const g = new Game(10, 'board'); g.spawnMonster(); const hp = g.monsters[0].hp;
    draw(g, 'chip-boss'); expect(g.boss.hp).toBe(C.boss.hp - C.board.events.bossDamage);
    expect(g.monsters[0].hp).toBe(hp);
    const end = new Game(10, 'board'); end.boss.hp = 1; draw(end, 'chip-boss'); expect(end.status).toBe('won');
  });
  it('空場的雙倍／引爆可在下一球兌現，重來清空所有待用效果', () => {
    const g = new Game(10, 'board'); draw(g, 'double-burst'); draw(g, 'burst-now');
    readyToFire(g); g.fire(-Math.PI / 2);
    expect(g.events).toHaveLength(1); expect(g.events[0].kind).toBe('amplified');
    expect(g.board!.boostedBallId).toBeNull(); expect(g.board!.burstNextBall).toBe(false);
    g.reset(); expect(g.snapshot()).toEqual(new Game(10, 'board').snapshot());
  });
  it('同 seed、同輸入：抽卡紀錄與完整盤面一致，不同 seed 改變序列', () => {
    const run = (seed: number) => {
      const g = new Game(seed, 'board'); g.start();
      for (let i = 0; i < 60000 && g.status === 'playing'; i++) {
        if (g.board!.phase === 'roll') g.rollBoard();
        if (g.board!.phase === 'shooting') g.fire(-Math.PI / 2 + Math.sin(g.shots * 2) * .9);
        g.step();
      }
      expect(g.board!.cards.length).toBeGreaterThan(0); return g.snapshot();
    };
    const first = run(20261111);
    expect(first).toEqual(run(20261111));
    expect(run(20261112).board.cards).not.toEqual(first.board.cards);
  }, 20000);
});
