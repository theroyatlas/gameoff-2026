import { expect, it } from 'vitest';
import { measure, truePeak4x } from '../tools/audio-metrics';
it('48 kHz 雙聲道 997 Hz 校準音的 K 權重響度約 −20 LUFS', () => {
  const x = Float32Array.from({ length: 48000 }, (_, i) => .1 * Math.sin(2 * Math.PI * 997 * i / 48000));
  const m = measure([x, x]);
  expect(m.sample_peak_dbfs).toBeCloseTo(-20, 2);
  expect(m.rms_dbfs).toBeCloseTo(-23.0103, 2);
  expect(Math.abs(m.lufs_full + 20)).toBeLessThan(.05);
  expect(Math.abs(m.lufs_integrated + 20)).toBeLessThan(.05);
});
it('四倍 FIR 偵測 12 kHz 四分之一週期偏移的取樣間峰值', () => {
  const x = Float32Array.from({ length: 4800 }, (_, i) => Math.sin(2 * Math.PI * 12000 * i / 48000 + Math.PI / 4));
  expect(Math.max(...x)).toBeCloseTo(Math.SQRT1_2, 5);
  expect(truePeak4x([x])).toBeGreaterThan(.98);
  expect(truePeak4x([x])).toBeLessThan(1.1);
});
