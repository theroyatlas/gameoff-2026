import { describe, expect, it } from 'vitest';
import { classifyImpact, comboSemitone, impactStrength, landingZoom, punchScale, tallyStep } from '../drafts/3d-web/juice';

describe('棋盤回饋節奏', () => {
  it('連鎖音高逐層往上，不回頭', () => {
    const steps = Array.from({ length: 11 }, (_, i) => comboSemitone(i));
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    expect(comboSemitone(99)).toBe(comboSemitone(10));
  });
  it('累加數字只往上追、不超過目標，差距大時跳得快', () => {
    expect(tallyStep(0, 100, .016)).toBeGreaterThan(0);
    expect(tallyStep(90, 100, 1)).toBe(100);
    expect(tallyStep(100, 100, .016)).toBe(100);
    expect(tallyStep(0, 1000, .016) - 0).toBeGreaterThan(tallyStep(0, 50, .016));
  });
  it('撞擊力度隨速度單調增加並夾在 0–1', () => {
    expect(impactStrength(0)).toBe(0);
    expect(impactStrength(5000)).toBe(1);
    expect(impactStrength(400)).toBeLessThan(impactStrength(1200));
  });
  it('依位置分出木框、玻璃罩、怪物籠與球', () => {
    const boss = { x: 400, y: 340, radius: 48 };
    expect(classifyImpact(14, 300, 14, 800, 680, boss, [])).toBe('wall');
    expect(classifyImpact(400, 340 - 62, 14, 800, 680, boss, [])).toBe('dome');
    expect(classifyImpact(200, 100, 14, 800, 680, boss, [{ x: 200, y: 135, radius: 21 }])).toBe('cage');
    expect(classifyImpact(600, 500, 14, 800, 680, boss, [])).toBe('ball');
  });
  it('落格放大先推近、停住、再退回；數字彈跳會回到原大小', () => {
    expect(landingZoom(0)).toBe(0);
    expect(landingZoom(.3)).toBe(1);
    expect(landingZoom(1)).toBe(0);
    expect(punchScale(.11)).toBeGreaterThan(1.2);
    expect(punchScale(.5)).toBe(1);
  });
});
