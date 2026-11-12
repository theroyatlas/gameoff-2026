/** 48 kHz、立體聲。ITU-R BS.1770-5 Annex 1 Tables 1–2 / Annex 2 FIR。
 * https://www.itu.int/rec/R-REC-BS.1770-5-202311-I/en
 * 浮點計算無需整數路徑的 12.04 dB 頭部空間縮放。
 */
const FIR = [
  [.001708984375, -.0291748046875, -.0189208984375, -.00830078125],
  [.010986328125, .029296875, .0330810546875, .014892578125],
  [-.0196533203125, -.0517578125, -.0582275390625, -.026611328125],
  [.033203125, .089111328125, .1015625, .047607421875],
  [-.0594482421875, -.16650390625, -.2003173828125, -.102294921875],
  [.1373291015625, .465087890625, .77978515625, .97216796875],
  [.97216796875, .77978515625, .465087890625, .1373291015625],
  [-.102294921875, -.2003173828125, -.16650390625, -.0594482421875],
  [.047607421875, .1015625, .089111328125, .033203125],
  [-.026611328125, -.0582275390625, -.0517578125, -.0196533203125],
  [.014892578125, .0330810546875, .029296875, .010986328125],
  [-.00830078125, -.0189208984375, -.0291748046875, .001708984375],
];
function biquad(input: Float32Array | Float64Array, b: number[], a: number[]) {
  const out = new Float64Array(input.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i], y = b[0] * x + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
    out[i] = y; x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
  return out;
}
export function kWeight(input: Float32Array) {
  return biquad(biquad(input, [1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, .73248077421585]), [1, -2, 1], [-1.99004745483398, .99007225036621]);
}
export function truePeak4x(channels: Float32Array[]) {
  let peak = 0;
  for (const x of channels) {
    for (let i = 0; i < x.length + 11; i++) {
      for (let phase = 0; phase < 4; phase++) {
        let y = 0;
        for (let tap = 0; tap < 12; tap++) { const j = i - tap; if (j >= 0 && j < x.length) y += x[j] * FIR[tap][phase]; }
        peak = Math.max(peak, Math.abs(y));
      }
    }
  }
  return peak;
}
const db = (v: number) => 10 * Math.log10(Math.max(v, 1e-30));
export function measure(channels: Float32Array[], sampleRate = 48000) {
  if (sampleRate !== 48000 || channels.length !== 2 || channels[0].length !== channels[1].length) throw new Error('Expected stereo 48 kHz');
  const n = channels[0].length; let peak = 0, energy = 0;
  for (const ch of channels) for (const x of ch) { peak = Math.max(peak, Math.abs(x)); energy += x * x; }
  const power = new Float64Array(n);
  for (const ch of channels) { const k = kWeight(ch); for (let i = 0; i < n; i++) power[i] += k[i] * k[i]; }
  const prefix = new Float64Array(n + 1); for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + power[i];
  const lufs = -.691 + db(prefix[n] / n), blocks: number[] = [];
  const block = 19200, hop = 4800;
  for (let i = 0; i + block <= n; i += hop) { const p = (prefix[i + block] - prefix[i]) / block; if (-.691 + db(p) >= -70) blocks.push(p); }
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const gated = blocks.filter(p => p >= mean(blocks) / 10);
  return { sample_peak_dbfs: 20 * Math.log10(Math.max(peak, 1e-15)), true_peak_dbtp: 20 * Math.log10(Math.max(truePeak4x(channels), 1e-15)), rms_dbfs: db(energy / (n * 2)), lufs_full: lufs, lufs_integrated: gated.length ? -.691 + db(mean(gated)) : lufs, duration_seconds: n / sampleRate };
}
