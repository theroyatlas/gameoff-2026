import type { Effect } from '../../src/game';
import { comboSemitone, type ImpactKind } from './juice';

/**
 * 棋盤模式的音效。全部以 WebAudio 即時合成，不載入任何音檔。
 * 只在使用者手勢後建立 AudioContext；聲部上限與壓縮器限制密集碰撞。
 * 每一種聲音的做法寫在 ASSETS.md「音效」一節。
 */
type BallSound = { f: number; ratios: number[]; decay: number; q: number; noise: number };
/** 球的材質聲：基頻、泛音比、衰減。玻璃短而亮、鋼長而尖、黃銅較暖；木球是悶的敲擊。 */
const BALL_SOUNDS: Record<'shiny' | 'wood', BallSound[]> = {
  shiny: [
    { f: 2350, ratios: [1, 2.32, 4.25], decay: .09, q: 18, noise: 6200 },  // 玻璃
    { f: 1720, ratios: [1, 2.76, 5.40, 8.93], decay: .32, q: 30, noise: 7600 }, // 鋼
    { f: 1180, ratios: [1, 2.42, 4.6], decay: .24, q: 24, noise: 4800 },  // 黃銅
  ],
  wood: [
    { f: 780, ratios: [1, 2.9], decay: .045, q: 8, noise: 2600 },   // 原木
    { f: 920, ratios: [1, 3.1], decay: .05, q: 10, noise: 3200 },   // 紅漆木（漆面稍亮）
    { f: 560, ratios: [1, 2.6], decay: .035, q: 6, noise: 1800 },   // 陶土
  ],
};
const TUNE_PITCH = [880, 659.25, 523.25];

/** 最後一級軟限幅：單音範圍內保持單位增益，峰值才進入連續的一階曲線。
 * 留下取樣間峰值餘裕；實際 −1 dBTP 驗收由原本的四倍 FIR 壓力案例量測。
 * 不使用過取樣濾波，避免改變門檻以下單音的高頻與響度。
 */
export const LIMITER_ONSET = .65;
export const LIMITER_CEILING = .78;
export function limitMasterSample(sample: number) {
  const a = Math.abs(sample);
  if (a <= LIMITER_ONSET) return sample;
  const span = LIMITER_CEILING - LIMITER_ONSET;
  return Math.sign(sample) * (LIMITER_ONSET + span * (1 - Math.exp(-(a - LIMITER_ONSET) / span)));
}
export function masterLimiterCurve() {
  return Float32Array.from({ length: 65537 }, (_, i) => limitMasterSample(i / 32768 - 1));
}

export class BoardAudio {
  context?: AudioContext; master?: GainNode; dry?: GainNode; wet?: GainNode; noise?: AudioBuffer;
  muted = false; voices = 0; played = 0; log: string[] = [];
  private lastImpact = 0; private impactsThisFrame = 0;
  /** 怪物籠的材質聲（?cage=a|b|c）；null 維持原本的籠聲。 */
  cageStyle: 'a' | 'b' | 'c' | null = null;
  constructor(private ballFamily: 'shiny' | 'wood' = 'shiny') {}
  unlock() {
    if (!this.context) {
      const ctx = new AudioContext(); this.context = ctx;
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : .5;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18; compressor.knee.value = 8; compressor.ratio.value = 6; compressor.attack.value = .003; compressor.release.value = .12;
      const limiter = ctx.createWaveShaper(); limiter.curve = masterLimiterCurve(); limiter.oversample = 'none';
      this.master.connect(compressor); compressor.connect(limiter); limiter.connect(ctx.destination);
      // 小房間殘響：程式產生的指數衰減雜訊脈衝，1.1 秒。讓桌面聽起來在一個房間裡。
      this.dry = ctx.createGain(); this.wet = ctx.createGain(); this.wet.gain.value = .16;
      const reverb = ctx.createConvolver(); reverb.buffer = this.impulse(1.1, 3.2);
      this.dry.connect(this.master); this.wet.connect(reverb); reverb.connect(this.master);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0); let seed = 1337;
      for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    }
    void this.context.resume();
  }
  toggle() { this.muted = !this.muted; if (this.context && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : .5, this.context.currentTime, .025); }
  setFamily(family: 'shiny' | 'wood') { this.ballFamily = family; }
  /** 每個畫面開始時呼叫，重設同一畫面的撞擊上限。 */
  frame() { this.impactsThisFrame = 0; }

  private impulse(seconds: number, decay: number) {
    const ctx = this.context!, length = Math.round(ctx.sampleRate * seconds), buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buffer.getChannelData(ch); let s = 99 + ch * 7;
      for (let i = 0; i < length; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; d[i] = (s / 2147483648 - 1) * (1 - i / length) ** decay; } }
    return buffer;
  }
  /** priority：抽卡那一串聲音是玩家等著聽的回饋，密集撞擊佔滿 40 聲時仍保留額外 24 聲給它。 */
  private ready(priority = false) { return !!(this.context && this.master && !this.muted && this.voices < (priority ? 64 : 40)); }
  /** 一個聲部的出口：音量包絡 → 左右定位 → 乾／濕兩路。 */
  private out(start: number, end: number, pan = 0, wet = 1) {
    const ctx = this.context!, gain = ctx.createGain(), panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-.85, Math.min(.85, pan)); gain.connect(panner); panner.connect(this.dry!);
    if (wet > 0) { const send = ctx.createGain(); send.gain.value = wet; panner.connect(send); send.connect(this.wet!); setTimeout(() => send.disconnect(), (end - ctx.currentTime) * 1000 + 1600); }
    this.voices++; this.played++;
    setTimeout(() => { this.voices--; gain.disconnect(); panner.disconnect(); }, Math.max(0, end - ctx.currentTime) * 1000 + 1500);
    void start; return gain;
  }
  private tone(freq: number, start: number, duration: number, peak: number, opts: { type?: OscillatorType; to?: number; pan?: number; attack?: number; wet?: number } = {}) {
    const ctx = this.context!, osc = ctx.createOscillator(), end = start + duration;
    const out = this.out(start, end, opts.pan, opts.wet ?? 1);
    osc.type = opts.type ?? 'sine'; osc.frequency.setValueAtTime(freq, start);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), end);
    out.gain.setValueAtTime(.0001, start); out.gain.linearRampToValueAtTime(peak, start + (opts.attack ?? .003));
    out.gain.exponentialRampToValueAtTime(.0001, end);
    osc.connect(out); osc.start(start); osc.stop(end + .02);
  }
  private hiss(start: number, duration: number, peak: number, filter: { type: BiquadFilterType; f: number; q?: number; to?: number }, pan = 0, wet = 1) {
    const ctx = this.context!, src = ctx.createBufferSource(), biquad = ctx.createBiquadFilter(), end = start + duration;
    const out = this.out(start, end, pan, wet);
    src.buffer = this.noise!; src.loop = true; biquad.type = filter.type; biquad.frequency.setValueAtTime(filter.f, start); biquad.Q.value = filter.q ?? 1;
    if (filter.to) biquad.frequency.exponentialRampToValueAtTime(filter.to, end);
    out.gain.setValueAtTime(.0001, start); out.gain.linearRampToValueAtTime(peak, start + .002); out.gain.exponentialRampToValueAtTime(.0001, end);
    src.connect(biquad); biquad.connect(out); src.start(start, (start * 7.13) % .9); src.stop(end + .02);
  }
  /** 驗收用：出現過的聲音種類（去掉數字尾碼）。 */
  kinds = new Set<string>();
  private note(name: string) { this.kinds.add(name.replace(/-\d+$/, '')); this.log.push(name); if (this.log.length > 200) this.log.shift(); }

  /** 骰子在手裡搖：六下骨頭互敲，間隔越來越短。 */
  diceShake() {
    if (!this.ready()) return; const t = this.context!.currentTime; this.note('dice-shake');
    [0, .07, .125, .17, .205, .235].forEach((dt, i) => { this.hiss(t + dt, .025, .16 + i * .02, { type: 'bandpass', f: 2600 + i * 180, q: 4 }, -.2 + i * .08); this.tone(1900 + i * 70, t + dt, .03, .03, { type: 'triangle' }); });
  }
  /** 骰子落桌：一聲悶響加兩下越來越小的彈跳，木桌的低頻在前。 */
  diceLand(pan = .5) {
    if (!this.ready()) return; const t = this.context!.currentTime; this.note('dice-land');
    [[0, 1], [.085, .45], [.14, .2]].forEach(([dt, k]) => {
      this.tone(118, t + dt, .14 * k + .04, .55 * k, { to: 70, pan });
      this.hiss(t + dt, .05, .32 * k, { type: 'bandpass', f: 900, q: 1.6 }, pan);
      this.hiss(t + dt, .018, .18 * k, { type: 'highpass', f: 3800 }, pan);
    });
  }
  /** 棋子走一格：木頭點在紙卡上，每一步音高往上爬；最後一步較重，帶紙聲。 */
  step(index: number, final: boolean, pan = 0) {
    if (!this.ready()) return; const t = this.context!.currentTime; this.note(final ? 'step-land' : 'step');
    const f = 520 * 2 ** (comboSemitone(index) / 12);
    this.tone(f, t, final ? .12 : .06, final ? .32 : .22, { type: 'triangle', to: f * .92, pan });
    this.hiss(t, .025, final ? .28 : .16, { type: 'bandpass', f: 1800, q: 2.5 }, pan);
    if (final) { this.hiss(t + .01, .11, .2, { type: 'lowpass', f: 1400 }, pan); this.tone(150, t, .12, .3, { to: 90, pan }); }
  }
  /** SURGE：電流往上衝、劈啪聲，最後一記低頻。 */
  surge(pan = 0) {
    if (!this.ready()) return; const t = this.context!.currentTime; this.note('surge');
    this.tone(70, t, .5, .2, { type: 'sawtooth', to: 360, pan, attack: .08 });
    this.hiss(t, .42, .22, { type: 'bandpass', f: 600, q: 3, to: 5200 }, pan);
    for (let i = 0; i < 7; i++) this.hiss(t + .05 + i * .045, .012, .25, { type: 'highpass', f: 3000 + i * 400 }, pan + (i % 2 ? .25 : -.25));
    this.tone(55, t + .42, .55, .7, { to: 38, pan });
    this.hiss(t + .42, .2, .3, { type: 'lowpass', f: 500 }, pan);
    this.tone(1760, t + .42, .25, .08, { type: 'square', to: 880, pan });
  }
  /** TUNE：調音鐘，音高跟材質走，再補一個五度。 */
  tune(material: number, pan = 0) {
    if (!this.ready()) return; const t = this.context!.currentTime, f = TUNE_PITCH[material] ?? 660; this.note(`tune-${material}`);
    const ctx = this.context!, carrier = ctx.createOscillator(), mod = ctx.createOscillator(), depth = ctx.createGain(), end = t + 1.5;
    const out = this.out(t, end, pan, 1.4);
    carrier.frequency.value = f; mod.frequency.value = f * 1.4;
    depth.gain.setValueAtTime(f * 2.2, t); depth.gain.exponentialRampToValueAtTime(f * .05, t + .9);
    mod.connect(depth); depth.connect(carrier.frequency); carrier.connect(out);
    out.gain.setValueAtTime(.0001, t); out.gain.linearRampToValueAtTime(.28, t + .004); out.gain.exponentialRampToValueAtTime(.0001, end);
    carrier.start(t); mod.start(t); carrier.stop(end + .02); mod.stop(end + .02);
    this.tone(f * 1.5, t + .09, 1.1, .1, { pan: pan + .2, wet: 1.4 });
    this.tone(f / 2, t, .3, .2, { type: 'triangle', pan });
  }
  /** 繞過起點加一發：三個往上的亮音，像硬幣疊上去。 */
  lap() {
    if (!this.ready()) return; const t = this.context!.currentTime; this.note('lap');
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => { this.tone(f, t + i * .075, .32, .16, { type: 'triangle', pan: -.3 + i * .2, wet: 1.2 }); this.tone(f * 2.76, t + i * .075, .08, .04, { pan: -.3 + i * .2 }); });
  }
  /**
   * 撞擊：強度 0–1 同時改音量、亮度與接觸噪音；不同材質各自的泛音。
   * 同一畫面最多 6 聲，40 ms 內的極輕碰撞直接略過，避免一團糊。
   */
  impact(kind: ImpactKind, strength: number, matA: number, matB: number | null, pan: number, seed: number) {
    if (!this.ready() || this.impactsThisFrame >= 6) return;
    const t = this.context!.currentTime; if (strength < .12 && t - this.lastImpact < .04) return;
    this.impactsThisFrame++; this.lastImpact = t; this.note(`impact-${kind}`);
    const k = Math.max(0, Math.min(1, strength)), gain = .015 + .42 * k ** 1.35, detune = 1 + ((seed * 37) % 13 - 6) * .004;
    const voice = (m: number, scale: number) => {
      const s = BALL_SOUNDS[this.ballFamily][m] ?? BALL_SOUNDS.shiny[0], partials = 1 + Math.round(k * (s.ratios.length - 1));
      s.ratios.slice(0, partials).forEach((r, i) => this.tone(s.f * r * detune * (1 + k * .03), t, s.decay * (1 - i * .18) * (.6 + k * .7), gain * scale / (1 + i * 1.3), { pan, wet: .8 }));
      this.hiss(t, .004 + .006 * k, gain * scale * (.4 + k), { type: 'highpass', f: s.noise * (.6 + k * .4) }, pan, .3);
    };
    if (kind === 'wall') {
      // 木框：低頻的「咚」為主，球本身的金屬聲壓低。
      this.tone(150 + k * 60, t, .05 + k * .06, gain * 1.1, { to: 95, pan, wet: .6 });
      this.hiss(t, .03 + k * .02, gain * .9, { type: 'bandpass', f: 950 + k * 500, q: 1.8 }, pan, .5);
      voice(matA, .35);
    } else if (kind === 'dome') {
      this.tone(2900 * detune, t, .5, gain * .35, { pan, wet: 1.3 }); this.tone(4630 * detune, t, .25, gain * .18, { pan, wet: 1.3 }); voice(matA, .6);
    } else if (kind === 'cage' && this.cageStyle === 'a') {
      // 鐵絲籠：細鐵絲被敲到的「叮」，兩個不成整數比的泛音拖長一點，加焊點的金屬接觸聲。
      this.tone(1480 * detune, t, .42, gain * .32, { type: 'triangle', pan, wet: 1.1 }); this.tone(3870 * detune, t, .2, gain * .12, { pan, wet: 1.1 });
      this.tone(620 * detune, t, .16, gain * .2, { pan }); this.hiss(t, .012, gain * .5, { type: 'highpass', f: 6000 }, pan, .3); voice(matA, .45);
    } else if (kind === 'cage' && this.cageStyle === 'b') {
      // 毛線籠：毛線吃掉高頻，只剩悶悶的「噗」和木樁的低頻。
      this.hiss(t, .07 + k * .04, gain * 1.1, { type: 'lowpass', f: 700 + k * 500 }, pan, .4); this.tone(165 * detune, t, .1, gain * .6, { to: 110, pan, wet: .4 }); voice(matA, .3);
    } else if (kind === 'cage' && this.cageStyle === 'c') {
      // 紙燈籠：紙板被撞的「啪」加兩下紙張抖動的沙沙聲。
      this.hiss(t, .03, gain * 1.2, { type: 'bandpass', f: 2400, q: 1.2 }, pan, .5); this.tone(240 * detune, t, .06, gain * .5, { to: 160, pan });
      [.035, .07].forEach((dt, i) => this.hiss(t + dt, .025, gain * (.45 - i * .15), { type: 'bandpass', f: 3600 - i * 600, q: 2 }, pan, .5)); voice(matA, .45);
    } else if (kind === 'cage') {
      this.tone(410 * detune, t, .18, gain * .5, { type: 'triangle', pan }); this.tone(1130 * detune, t, .12, gain * .25, { type: 'square', pan }); voice(matA, .5);
    } else { voice(matA, .75); voice(matB ?? matA, .6); }
  }
  /** 連鎖爆發：同一串裡第 step 下，音高沿五聲音階往上疊；層數越深越亮。 */
  burst(step: number, depth: number, pan = 0, amplified = false) {
    if (!this.ready()) return; const t = this.context!.currentTime, f = 392 * 2 ** (comboSemitone(step) / 12); this.note(`burst-${step}`);
    this.tone(f, t, .45, .26, { type: 'triangle', pan, wet: 1.3 });
    this.tone(f * 2, t, .3, .1, { pan, wet: 1.3 });
    this.tone(f * 3.01, t + .01, .16, .05 + Math.min(depth, 5) * .012, { pan, wet: 1.3 });
    this.tone(f / 4, t, .22, .3, { to: f / 6, pan });
    this.hiss(t, .06, .14, { type: 'bandpass', f: 3200, q: 1.5, to: 900 }, pan);
    if (amplified) this.tone(f * 1.5, t + .05, .5, .12, { pan, wet: 1.5 });
  }
  /** 傷害累加時的跳字聲：很短的點擊，跟著累加次數往上。 */
  tick(count: number) {
    if (!this.ready()) return; const t = this.context!.currentTime;
    this.tone(1400 * 2 ** (Math.min(count, 24) / 24), t, .025, .05, { type: 'square', wet: .2 });
  }
  /** 一串連鎖收尾：累加數字定格時的一記重拍。 */
  slam(size: number) {
    if (!this.ready()) return; const t = this.context!.currentTime; this.note('slam');
    this.tone(98, t, .3, .45, { to: 55 }); this.hiss(t, .09, .25, { type: 'lowpass', f: 1800 });
    if (size >= 3) this.tone(784, t + .02, .5, .1, { type: 'triangle', wet: 1.4 });
  }
  /**
   * 抽事件卡：卡從牌堆抽出來的紙張摩擦聲，加一段往上爬的期待音。
   * 卡的材質決定摩擦聲：a 手繪紙卡較軟、b 印刷卡較脆、c 木牌是木頭滑過桌面。
   */
  cardDraw(variant: 'a' | 'b' | 'c') {
    if (!this.ready(true)) return; const t = this.context!.currentTime; this.note(`card-draw-${variant}`);
    if (variant === 'c') { this.hiss(t, .22, .16, { type: 'bandpass', f: 500, q: 2, to: 900 }); this.tone(130, t, .2, .12, { type: 'triangle', to: 150 }); }
    else this.hiss(t, .2, variant === 'b' ? .2 : .16, { type: 'bandpass', f: variant === 'b' ? 1800 : 1100, q: 1.4, to: variant === 'b' ? 4200 : 2800 });
    // 期待：兩個聲部往上滑，翻面前停在屬音。
    this.tone(392, t + .05, .42, .07, { type: 'triangle', to: 587, wet: 1.2 }); this.tone(784, t + .1, .36, .03, { to: 1175, wet: 1.2 });
  }
  /** 翻面：一記短促的「啪」；木牌是兩下木頭輕敲。 */
  cardFlip(variant: 'a' | 'b' | 'c') {
    if (!this.ready(true)) return; const t = this.context!.currentTime; this.note(`card-flip-${variant}`);
    if (variant === 'c') { this.tone(980, t, .05, .2, { type: 'triangle', to: 820 }); this.tone(1240, t + .045, .04, .12, { type: 'triangle' }); this.hiss(t, .02, .2, { type: 'bandpass', f: 1800, q: 3 }); }
    else { this.hiss(t, .035, variant === 'b' ? .34 : .26, { type: 'highpass', f: variant === 'b' ? 3200 : 2200 }); this.hiss(t + .004, .05, .18, { type: 'bandpass', f: 900, q: 1.5 }); this.tone(170, t, .06, .18, { to: 120 }); }
  }
  /** 蓋章：橡皮章壓到紙上的悶響；木牌版是黃銅印壓進木頭，多一個金屬泛音。 */
  cardStamp(variant: 'a' | 'b' | 'c') {
    if (!this.ready(true)) return; const t = this.context!.currentTime; this.note(`card-stamp-${variant}`);
    this.tone(140, t, .18, .55, { to: 58 }); this.hiss(t, .07, .32, { type: 'lowpass', f: 1300 }); this.hiss(t, .012, .2, { type: 'bandpass', f: 2600, q: 1 });
    if (variant === 'c') this.tone(1660, t + .005, .35, .07, { type: 'triangle', wet: 1.2 });
  }
  /** 獎勵：依卡號換主音的上行琶音（大調五聲），最後一個音拉長並帶八度泛音。 */
  cardReward(index: number) {
    if (!this.ready(true)) return; const t = this.context!.currentTime; this.note(`card-reward-${index}`);
    const root = 523.25 * 2 ** ([0, 2, 4, 7, 9, 12][Math.max(0, index) % 6] / 12);
    [0, 4, 7, 12].forEach((semi, i) => { const f = root * 2 ** (semi / 12), last = i === 3; this.tone(f, t + i * .06, last ? .6 : .2, last ? .16 : .12, { type: 'triangle', pan: -.3 + i * .2, wet: 1.3 }); if (last) this.tone(f * 2, t + i * .06, .4, .05, { wet: 1.5 }); });
  }
  /** 規則的其他效果：發射、相變、怪物、波次。 */
  play(e: Effect, shifted: boolean) {
    if (!this.ready()) return; const t = this.context!.currentTime, pan = (e.x - 400) / 400;
    if (e.kind === 'launch') { this.note('launch'); this.tone(210, t, .12, .3, { to: 85, pan }); this.hiss(t, .05, .2, { type: 'bandpass', f: 1300, q: 2 }, pan); this.hiss(t + .01, .16, .06, { type: 'bandpass', f: 500, q: 1, to: 2500 }, pan); }
    else if (e.kind === 'resonate') { this.note('resonate'); this.tone(shifted ? 990 : 660, t, .35, .07, { pan, wet: 1.4 }); this.tone(shifted ? 1485 : 990, t + .04, .3, .04, { pan, wet: 1.4 }); }
    else if (e.kind === 'death') { this.note('death'); this.tone(320, t, .3, .3, { type: 'square', to: 80, pan }); this.hiss(t, .25, .3, { type: 'bandpass', f: 2200, q: 1, to: 400 }, pan); this.tone(1240, t, .2, .08, { type: 'triangle', pan }); }
    else if (e.kind === 'warning') { this.note('warning'); this.tone(330, t, .7, .12, { to: 660, wet: 1.5 }); }
    else if (e.kind === 'shift') { this.note('shift'); this.tone(65, t, 1.4, .3, { type: 'sawtooth', to: 260 }); this.tone(523, t + .1, 1.2, .1, { wet: 1.6 }); this.tone(784, t + .2, 1.1, .08, { wet: 1.6 }); }
    else if (e.kind === 'release') { this.note('release'); this.tone(260, t, .9, .2, { type: 'triangle', to: 90, wet: 1.4 }); }
    else if (e.kind === 'wave') { this.note('wave'); this.tone(110, t, .5, .3, { type: 'triangle', to: 82 }); this.tone(165, t + .12, .5, .2, { type: 'triangle', to: 123 }); }
  }
}
