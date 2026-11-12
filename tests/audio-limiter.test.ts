import { describe, expect, it } from 'vitest';
import { LIMITER_CEILING, LIMITER_ONSET, limitMasterSample, masterLimiterCurve } from '../drafts/3d-web/board-audio';

describe('主輸出軟限幅', () => {
  it('門檻以下單位增益、零輸入無偏移，正負大振幅不超過上限', () => {
    for (let i = -1000; i <= 1000; i++) {
      const x = i * LIMITER_ONSET / 1000;
      expect(limitMasterSample(x)).toBe(x);
    }
    for (const x of [-100, -2, -1, -.7, .7, 1, 2, 100]) {
      expect(Math.abs(limitMasterSample(x))).toBeLessThanOrEqual(LIMITER_CEILING);
      expect(limitMasterSample(-x)).toBe(-limitMasterSample(x));
    }
  });
  it('實際 WaveShaper 表線性插值維持低振幅，端點夾限仍低於 −1 dBFS', () => {
    const curve = masterLimiterCurve();
    const at = (x: number) => {
      const p = (Math.max(-1, Math.min(1, x)) + 1) * (curve.length - 1) / 2;
      const i = Math.floor(p), f = p - i;
      return curve[i] + f * (curve[Math.min(i + 1, curve.length - 1)] - curve[i]);
    };
    for (let i = 0; i < 4800; i++) {
      const x = .63 * Math.sin(i * 2 * Math.PI * 997 / 48000);
      expect(Math.abs(at(x) - x)).toBeLessThan(1e-7);
    }
    for (let i = -4000; i <= 4000; i++) expect(Math.abs(at(i / 1000))).toBeLessThan(10 ** (-1 / 20));
  });
});
