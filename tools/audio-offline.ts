import { BoardAudio } from '../drafts/3d-web/board-audio';
import { impactStrength } from '../drafts/3d-web/juice';
import { measure } from './audio-metrics';

type Case = { name: string; category: string; family?: 'shiny' | 'wood'; cage?: 'a' | 'b' | 'c' | null; speed?: number; run: (audio: BoardAudio) => void };
const cases: Case[] = [];
const add = (name: string, category: string, run: Case['run']) => cases.push({ name, category, run });
add('dice-shake', 'dice', a => a.diceShake()); add('dice-land', 'dice', a => a.diceLand());
for (let i = 0; i < 6; i++) for (const final of [false, true]) add(`step-${i}-${final ? 'land' : 'walk'}`, 'step', a => a.step(i, final));
add('surge', 'surge', a => a.surge());
for (let i = 0; i < 3; i++) add(`tune-${i}`, 'tune', a => a.tune(i));
add('lap', 'lap', a => a.lap());
for (const v of ['a', 'b', 'c'] as const) {
  add(`card-draw-${v}`, 'card-draw', a => a.cardDraw(v)); add(`card-flip-${v}`, 'card-flip', a => a.cardFlip(v)); add(`card-stamp-${v}`, 'card-stamp', a => a.cardStamp(v));
}
for (let i = 0; i < 6; i++) add(`card-reward-${i}`, 'card-reward', a => a.cardReward(i));
for (let i = 0; i <= 10; i++) for (const amplified of [false, true]) add(`burst-${i}-${amplified ? 'amplified' : 'normal'}`, 'burst', a => a.burst(i, i, 0, amplified));
for (const n of [0, 12, 24]) add(`tick-${n}`, 'tick', a => a.tick(n));
for (const n of [1, 3]) add(`slam-${n}`, 'slam', a => a.slam(n));
for (const kind of ['launch', 'resonate', 'death', 'warning', 'shift', 'release', 'wave'] as const) {
  add(kind, kind, a => a.play({ kind, x: 400, y: 400 } as Parameters<BoardAudio['play']>[0], false));
  if (kind === 'resonate') add('resonate-shifted', kind, a => a.play({ kind, x: 400, y: 400 } as Parameters<BoardAudio['play']>[0], true));
}
for (const family of ['shiny', 'wood'] as const) for (const speed of [0, 950, 1900]) {
  for (const kind of ['wall', 'dome', 'cage', 'ball'] as const) for (let mat = 0; mat < 3; mat++) {
    const styles = kind === 'cage' ? [null, 'a', 'b', 'c'] as const : [null];
    for (const cage of styles) for (const matB of kind === 'ball' ? [0, 1, 2] : [null]) {
      cases.push({ name: `impact-${kind}-${cage ?? 'default'}-${family}-${mat}-${matB ?? 'none'}-v${speed}`, category: `impact-${kind}${kind === 'cage' ? `-${cage ?? 'default'}` : ''}`, family, cage, speed, run: a => a.impact(kind, impactStrength(speed), mat, matB, 0, 17) });
    }
  }
}

/** 原音效模組不修改。只替換時鐘、context 建構子與清理 timer，所有 AudioNode/參數仍出自 unlock()。 */
async function render(c: Case, dense = false, pan = 0) {
  const ctx = new OfflineAudioContext(2, 4 * 48000, 48000);
  let time = .1, lastStop = .1, timerId = 0;
  const timers: { at: number; fn: () => void }[] = [];
  const nativeAudio = window.AudioContext, nativeTimeout = window.setTimeout;
  const proxy = new Proxy(ctx, { get(target, key) {
    if (key === 'currentTime') return time;
    if (key === 'resume') return () => Promise.resolve();
    if (key === 'createOscillator' || key === 'createBufferSource') return () => {
      const node = key === 'createOscillator' ? ctx.createOscillator() : ctx.createBufferSource();
      const stop = node.stop.bind(node); node.stop = (at = 0) => { lastStop = Math.max(lastStop, at); stop(at); }; return node;
    };
    const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
  } });
  window.AudioContext = function () { return proxy; } as unknown as typeof AudioContext;
  window.setTimeout = ((fn: () => void, ms = 0) => { timers.push({ at: time + ms / 1000, fn }); return ++timerId; }) as typeof setTimeout;
  const audio = new BoardAudio(c.family ?? 'shiny'); audio.cageStyle = c.cage ?? null;
  try {
    audio.unlock();
    if (!dense) c.run(audio);
    else {
      // 60 個畫面／秒，每畫面嘗試六次最大速撞擊、連鎖、跳字，並夾入抽卡優先聲部。
      // 保留 ready() 的 40/64 聲部與 impact() 六次限制，不繞過拒絕聲部。
      for (let frame = 0; frame < 60; frame++) {
        time = .1 + frame / 60;
        for (let j = timers.length - 1; j >= 0; j--) if (timers[j].at <= time) { const timer = timers.splice(j, 1)[0]; timer.fn(); }
        audio.frame();
        if (frame === 0) { audio.play({ kind: 'shift', x: 400, y: 400 } as Parameters<BoardAudio['play']>[0], true); audio.cardDraw('a'); }
        if (frame % 6 === 0) audio.burst(frame / 6, 5, pan, true);
        for (let j = 0; j < 6; j++) audio.impact(j % 2 ? 'ball' : 'cage', 1, j % 3, (j + 1) % 3, pan, 17 + frame * 6 + j);
        audio.tick(frame);
        if (frame === 25) audio.cardFlip('a');
        if (frame === 37) audio.cardStamp('a');
        if (frame === 48) audio.cardReward(5);
        if (frame === 59) audio.slam(10);
      }
    }
  } finally { window.AudioContext = nativeAudio; window.setTimeout = nativeTimeout; }
  const buffer = await ctx.startRendering();
  // 包含完整 1.1 s IR 尾音及壓縮器延遲；計時起點 .1 s 是防止極小撞擊被冷卻規則略過。
  const end = Math.min(buffer.length, Math.ceil((lastStop + 1.1 + .02) * 48000)), start = 4800;
  const channels = [0, 1].map(ch => buffer.getChannelData(ch).slice(start, end));
  const result = { name: c.name, category: c.category, speed: c.speed ?? '', strength: c.speed === undefined ? '' : impactStrength(c.speed), ...measure(channels), voices: audio.played };
  if (!audio.played) throw new Error(`Silent unexecuted case: ${c.name}`);
  if (dense) {
    const second = [0, 1].map(ch => buffer.getChannelData(ch).slice(start, start + 48000));
    return { ...result, first_second: measure(second), attempted_impacts: 360, pan };
  }
  return result;
}
Object.assign(window, {
  audioCases: cases.map(c => c.name),
  measureAudioCase: (index: number) => render(cases[index]),
  measureDense: (family: 'wood' | 'shiny', cage: 'a' | 'b' | 'c' | null, pan: number) => render({ name: `dense-${family}-${cage ?? 'default'}-${pan}`, category: 'dense', family, cage, run: () => {} }, true, pan),
});
