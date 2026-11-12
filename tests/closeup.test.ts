import { expect, it } from 'vitest';
import { Game } from '../src/game';
import { CONFIG as C } from '../src/config';
import { closeupView, aimFan } from '../drafts/3d-web/closeup';

it('fieldB 顯示半徑放大，同 seed 同輸入的每 tick 完整規則狀態與整桌相同', () => {
  const baseline = new Game(20261113, 'board'), enlarged = new Game(20261113, 'board');
  const before = JSON.stringify(C);
  baseline.start(); enlarged.start();
  for (let i = 0; i < 5000; i++) {
    if (baseline.board!.phase === 'roll') { baseline.rollBoard(); enlarged.rollBoard(); }
    if (baseline.board!.phase === 'shooting' && baseline.tick % 137 === 0) {
      const angle = -Math.PI / 2 + Math.sin(i / 137);
      expect(enlarged.fire(angle)).toBe(baseline.fire(angle));
    }
    const view = closeupView('fieldB');
    expect(view.ballScale * C.ball.radius).toBeGreaterThan(C.ball.radius);
    // 模擬任意影格數的呈現取樣，輸入仍用規則球心和原角度。
    for (let frame = 0; frame < i % 3; frame++) {
      for (const ball of enlarged.balls) {
        const visual = { x: ball.x, y: view.ballScale * .14, z: ball.y, scale: view.ballScale };
        expect(visual.x).toBe(ball.x);
      }
      aimFan(-Math.PI / 2, C.launcher.coneHalfAngle, 0, (C.launcher.y - 340) * .01);
    }
    baseline.step(); enlarged.step();
    expect(enlarged.snapshot()).toEqual(baseline.snapshot());
  }
  expect(enlarged.shots).toBeGreaterThan(5);
  expect(enlarged.events.length).toBeGreaterThan(0);
  expect(JSON.stringify(C)).toBe(before);
}, 60000);

it('不加參數保留原尺寸，A 只縮小取景而不放大球', () => {
  expect(closeupView(null).ballScale).toBe(1);
  expect(closeupView(null).close).toBe(false);
  expect(closeupView('fieldA').ballScale).toBe(1);
  expect(closeupView('fieldA').halfWidth).toBeLessThan(closeupView('field').halfWidth);
});
