import { TOKENS, HAND_FONT, NUMBER_FONT, paperBase, handPath, circlePts, walnutTexture, type Pt, type IconStyle } from './style1';
import { cardFace, revealMoments, revealCount, REVEAL, type ArtVariant, type CardFace, type EventCardValues } from './art-round2';
import type { BoardAudio } from './board-audio';
import { bindRevealSkip } from './reveal-input';

/**
 * 事件卡卡面三版與抽卡展示。全部用 Canvas 程式繪製，不載入圖檔或字型。
 * a：手繪紙卡（02-board-closeup 的紙卡、粗筆畫與套印）。
 * b：印刷卡（style-1.png 的平整印刷卡、實心圖示、色帶）。
 * c：胡桃木鑲黃銅牌（01-same-angle 的木框角塊、style-1.png 的黃銅細邊）。
 */
const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;
const INK = css(TOKENS.ink), PAPER = css(TOKENS.paper), PAPER_EDGE = css(TOKENS.paperEdge), EVENT = TOKENS.event, SURGE = TOKENS.surge;
const BRASS = css(TOKENS.brass), BRASS_EDGE = css(TOKENS.brassEdge), WALNUT_DARK = css(TOKENS.walnutDark);
/** 中文手寫感用系統楷體；沒有就退回襯線字。 */
const KAI_FONT = '"DFKai-SB","BiauKai","KaiTi","Kaiti TC",serif';
const UI_FONT = '"Microsoft JhengHei",system-ui,sans-serif';
const TITLE_FONT = 'PMingLiU,"Noto Serif TC",serif';
export const CARD_W = 360, CARD_H = 504;
const ORDER = ['extra-shot', 'change-material', 'rewind', 'double-burst', 'burst-now', 'chip-boss'];

function makeCanvas(w = CARD_W, h = CARD_H) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
let walnutCache: HTMLCanvasElement | undefined;
function walnutCanvas() { return walnutCache ??= walnutTexture(256, false, false, 401).image as HTMLCanvasElement; }
/** 木牌底：深胡桃木紋鋪兩塊（紋路不拉伸），再壓一層夜桌色讓黃銅字跳出來。 */
function woodBase(x: CanvasRenderingContext2D, w: number, h: number) {
  const grain = walnutCanvas(); x.drawImage(grain, 0, 0, w, w); x.drawImage(grain, 0, w, w, w);
  x.fillStyle = 'rgba(18,11,6,.18)'; x.fillRect(0, 0, w, h);
}

/** 六張卡各自的圖示；筆觸沿用外圈紙卡的手抖線（DESIGN.md 第 5 節）。 */
function drawIcon(x: CanvasRenderingContext2D, id: string, cx: number, cy: number, k: number, color: string, style: IconStyle, fill?: string, weight = 1) {
  const line = (pts: Pt[], phase = 0) => handPath(x, pts, color, style, k * weight, phase);
  const dot = (px: number, py: number, r: number, c = color) => { x.save(); x.fillStyle = c; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill(); x.restore(); };
  const solid = (pts: Pt[]) => { if (!fill) return; x.save(); x.fillStyle = fill; x.globalAlpha = .85; x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.fill(); x.restore(); };
  const arrowHead = (tx: number, ty: number, angle: number, size: number) => line([[tx + Math.cos(angle + 2.5) * size, ty + Math.sin(angle + 2.5) * size], [tx, ty], [tx + Math.cos(angle - 2.5) * size, ty + Math.sin(angle - 2.5) * size]], 1);
  switch (id) {
    case 'extra-shot': {
      const ball = circlePts(cx - 12 * k, cy + 4 * k, 26 * k, 26 * k, .4); solid(ball); line(ball);
      line([[cx + 22 * k, cy - 22 * k], [cx + 46 * k, cy - 22 * k]], 2); line([[cx + 34 * k, cy - 34 * k], [cx + 34 * k, cy - 10 * k]], 3); break;
    }
    case 'change-material': {
      const left = circlePts(cx - 30 * k, cy + 10 * k, 17 * k, 17 * k, .2); solid(left); line(left);
      line(circlePts(cx + 30 * k, cy + 10 * k, 17 * k, 17 * k, 1.2), 1); line(circlePts(cx + 30 * k, cy + 10 * k, 9 * k, 9 * k, 2.1, Math.PI * 2.04, 32), 2);
      const arc = circlePts(cx, cy - 4 * k, 30 * k, 22 * k, Math.PI * 1.12, Math.PI * .76, 24); line(arc, 3);
      const [ex, ey] = arc[arc.length - 1]; arrowHead(ex, ey, .55, 11 * k); break;
    }
    case 'rewind': {
      const face = circlePts(cx, cy, 28 * k, 28 * k, .5); solid(face); line(face);
      line([[cx, cy], [cx, cy - 18 * k]], 1); line([[cx, cy], [cx + 13 * k, cy + 5 * k]], 2);
      const arc = circlePts(cx, cy, 40 * k, 40 * k, -.25, -Math.PI * .85, 24); line(arc, 3);
      const [ex, ey] = arc[arc.length - 1]; arrowHead(ex, ey, -Math.PI * .85 - Math.PI / 2 - .2, 11 * k); break;
    }
    case 'double-burst': {
      const outer = circlePts(cx, cy, 30 * k, 27 * k, .3); solid(outer); line(outer); line(circlePts(cx, cy, 16 * k, 14 * k, 1.4), 1);
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; line([[cx + Math.cos(a) * 38 * k, cy + Math.sin(a) * 36 * k], [cx + Math.cos(a) * 48 * k, cy + Math.sin(a) * 46 * k]], i); } break;
    }
    case 'burst-now': {
      const core = circlePts(cx, cy, 12 * k, 12 * k, .7); solid(core); line(core);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + .2, r0 = 20 * k, r1 = (i % 2 ? 34 : 44) * k; line([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], i); } break;
    }
    case 'chip-boss': {
      const dome = circlePts(cx, cy + 14 * k, 27 * k, 30 * k, Math.PI, Math.PI, 28); solid([...dome]); line(dome);
      line([[cx - 38 * k, cy + 14 * k], [cx + 38 * k, cy + 14 * k]], 1); dot(cx, cy - 20 * k, 5 * k);
      for (let i = 0; i < 3; i++) { const a = -Math.PI * .28 + i * .32; line([[cx + 30 * k + Math.cos(a) * 6 * k, cy - 22 * k + Math.sin(a) * 6 * k], [cx + 30 * k + Math.cos(a) * 18 * k, cy - 22 * k + Math.sin(a) * 18 * k]], i + 2); } break;
    }
    default: {
      line([...circlePts(cx, cy - 14 * k, 18 * k, 17 * k, Math.PI * 1.05, Math.PI * 1.45, 24), [cx + 2 * k, cy + 10 * k], [cx + 1 * k, cy + 18 * k]]); dot(cx + k, cy + 32 * k, 6 * k);
    }
  }
}
function fitText(x: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, font: string, weight = 700) {
  let s = size; do { x.font = `${weight} ${s}px ${font}`; s -= 2; } while (x.measureText(text).width > maxWidth && s > 10);
}
function headlineText(face: CardFace, count: number | null) { return `${face.prefix}${face.count === null ? '' : count ?? face.count}${face.suffix}`; }

/** 卡面底圖（不含跳動的大字），翻開後只重畫大字。 */
function drawFrontBase(c: HTMLCanvasElement, variant: ArtVariant, id: string, name: string, face: CardFace) {
  const x = c.getContext('2d')!, w = c.width, h = c.height, k = w / 256, index = ORDER.indexOf(id) + 1, tag = `${index}/6`;
  x.clearRect(0, 0, w, h);
  if (variant === 'a') {
    // 手繪紙卡：EVENT 赭黃邊框是另一版色，往右下套印偏移 3 px；圖示用粗麥克筆。
    paperBase(x, w, h, 700 + index * 13); const off = 3 * k;
    x.save(); x.strokeStyle = EVENT; x.globalAlpha = .9; x.lineWidth = 10 * k; x.strokeRect(10 * k + off, 10 * k + off, w - 20 * k, h - 20 * k); x.restore();
    x.save(); x.fillStyle = INK; x.globalAlpha = .85; x.font = `700 ${15 * k}px ${HAND_FONT}`; x.textBaseline = 'middle'; x.fillText('EVENT', 24 * k, 30 * k); x.textAlign = 'right'; x.fillText(tag, w - 24 * k, 30 * k); x.restore();
    drawIcon(x, id, w / 2, h * .3, k * 1.05, INK, 'b', css(TOKENS.ochre));
    x.save(); x.fillStyle = INK; x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(x, name, w - 50 * k, 30 * k, KAI_FONT); x.fillText(name, w / 2, h * .78);
    x.globalAlpha = .8; fitText(x, face.short, w - 40 * k, 18 * k, UI_FONT, 700); x.fillText(face.short, w / 2, h * .885); x.restore();
  } else if (variant === 'b') {
    // 印刷卡：平整紙面、半色調網點、上方實心色帶（色帶與框線套印錯開 3 px）、實心圖示。
    x.fillStyle = PAPER; x.fillRect(0, 0, w, h);
    x.save(); x.fillStyle = PAPER_EDGE; for (let yy = 8; yy < h; yy += 9) for (let xx = (yy / 9) % 2 ? 4 : 8.5; xx < w; xx += 9) { x.beginPath(); x.arc(xx, yy, 1.3, 0, Math.PI * 2); x.fill(); } x.restore();
    const off = 3 * k; x.save(); x.fillStyle = EVENT; x.fillRect(12 * k + off, 12 * k + off, w - 24 * k, 44 * k); x.restore();
    x.save(); x.strokeStyle = INK; x.lineWidth = 2.5 * k; x.strokeRect(12 * k, 12 * k, w - 24 * k, h - 24 * k); x.restore();
    x.save(); x.fillStyle = PAPER; x.textBaseline = 'middle'; x.textAlign = 'center'; fitText(x, name, w - 90 * k, 22 * k, UI_FONT, 800); x.fillText(name, w / 2 + off, 34 * k + off);
    x.font = `800 ${16 * k}px ${NUMBER_FONT}`; x.textAlign = 'left'; x.fillText(String(index), 22 * k + off, 34 * k + off); x.restore();
    drawIcon(x, id, w / 2, h * .37, k * 1.05, INK, 'c', EVENT);
    x.save(); x.fillStyle = INK; x.globalAlpha = .85; x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(x, face.short, w - 40 * k, 18 * k, UI_FONT, 700); x.fillText(face.short, w / 2, h * .87); x.restore();
  } else {
    // 胡桃木牌：淺木紋底、黃銅雙線框與四角銅釘；名稱寫在嵌入的紙籤上，圖示與大字是刻進木頭的黃銅。
    woodBase(x, w, h);
    x.save(); x.strokeStyle = BRASS; x.lineWidth = 4 * k; x.strokeRect(9 * k, 9 * k, w - 18 * k, h - 18 * k); x.strokeStyle = BRASS_EDGE; x.lineWidth = 1.5 * k; x.strokeRect(16 * k, 16 * k, w - 32 * k, h - 32 * k); x.restore();
    for (const [px, py] of [[16, 16], [w / k - 16, 16], [16, h / k - 16], [w / k - 16, h / k - 16]] as Pt[]) {
      const g = x.createRadialGradient(px * k - 1.5 * k, py * k - 1.5 * k, 0, px * k, py * k, 6 * k); g.addColorStop(0, BRASS_EDGE); g.addColorStop(1, BRASS);
      x.save(); x.fillStyle = g; x.beginPath(); x.arc(px * k, py * k, 5.5 * k, 0, Math.PI * 2); x.fill(); x.restore();
    }
    x.save(); x.translate(0, 2 * k); x.globalAlpha = .9; drawIcon(x, id, w / 2, h * .3, k, WALNUT_DARK, 'a', undefined, 2); x.restore(); // 刻痕的陰影
    drawIcon(x, id, w / 2, h * .3, k, BRASS_EDGE, 'a', undefined, 2);
    x.save(); x.fillStyle = BRASS_EDGE; x.font = `700 ${12 * k}px ${NUMBER_FONT}`; x.textAlign = 'right'; x.textBaseline = 'middle'; x.fillText(tag, w - 28 * k, 30 * k); x.restore();
    const lw = w - 60 * k, lh = 52 * k, lx = 30 * k, ly = h * .74;
    x.save(); x.translate(w / 2, ly + lh / 2); x.rotate(-1.5 * Math.PI / 180); x.translate(-w / 2, -(ly + lh / 2));
    x.fillStyle = PAPER_EDGE; x.fillRect(lx + 2 * k, ly + 3 * k, lw, lh); paperLabel(x, lx, ly, lw, lh);
    x.fillStyle = INK; x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(x, name, lw - 20 * k, 24 * k, TITLE_FONT); x.fillText(name, w / 2, ly + lh * .42);
    x.globalAlpha = .8; fitText(x, face.short, lw - 16 * k, 14 * k, UI_FONT, 700); x.fillText(face.short, w / 2, ly + lh * .8); x.restore();
  }
}
function paperLabel(x: CanvasRenderingContext2D, lx: number, ly: number, lw: number, lh: number) {
  const c = makeCanvas(Math.round(lw), Math.round(lh)); paperBase(c.getContext('2d')!, c.width, c.height, 913); x.drawImage(c, lx, ly);
}
function drawHeadline(c: HTMLCanvasElement, variant: ArtVariant, face: CardFace, count: number | null) {
  const x = c.getContext('2d')!, w = c.width, h = c.height, k = w / 256, text = headlineText(face, count);
  x.save(); x.textAlign = 'center'; x.textBaseline = 'middle';
  if (variant === 'a') { fitText(x, text, w - 60 * k, 44 * k, `${NUMBER_FONT},${KAI_FONT}`, 800); x.fillStyle = SURGE; x.fillText(text, w / 2 + 2 * k, h * .6 + 2 * k); x.fillStyle = INK; x.fillText(text, w / 2, h * .6); }
  else if (variant === 'b') { fitText(x, text, w - 60 * k, 46 * k, UI_FONT, 900); x.fillStyle = EVENT; x.fillText(text, w / 2 + 3 * k, h * .66 + 3 * k); x.fillStyle = INK; x.fillText(text, w / 2, h * .66); }
  else { fitText(x, text, w - 60 * k, 42 * k, `${NUMBER_FONT},${TITLE_FONT}`, 800); x.fillStyle = WALNUT_DARK; x.fillText(text, w / 2, h * .58 + 2 * k); x.fillStyle = BRASS_EDGE; x.fillText(text, w / 2, h * .58); }
  x.restore();
}
/** 卡背：a 紙卡大問號；b 印刷同心圈；c 胡桃木黃銅問號。 */
export function drawCardBack(c: HTMLCanvasElement, variant: ArtVariant) {
  const x = c.getContext('2d')!, w = c.width, h = c.height, k = w / 256;
  if (variant === 'a') {
    paperBase(x, w, h, 655); x.save(); x.strokeStyle = EVENT; x.globalAlpha = .9; x.lineWidth = 10 * k; x.strokeRect(13 * k, 13 * k, w - 20 * k, h - 20 * k); x.restore();
    drawIcon(x, '?', w / 2, h * .46, k * 1.9, EVENT, 'b');
    x.save(); x.fillStyle = INK; x.globalAlpha = .85; x.font = `700 ${24 * k}px ${HAND_FONT}`; x.textAlign = 'center'; x.fillText('EVENT', w / 2, h * .84); x.restore();
  } else if (variant === 'b') {
    x.fillStyle = PAPER_EDGE; x.fillRect(0, 0, w, h);
    x.save(); x.strokeStyle = EVENT; x.lineWidth = 5 * k; x.globalAlpha = .75; for (let r = 14; r < 200; r += 16) { x.beginPath(); x.ellipse(w / 2 + 3 * k, h / 2 + 3 * k, r * k, r * k * 1.1, 0, 0, Math.PI * 2); x.stroke(); } x.restore();
    x.save(); x.strokeStyle = INK; x.lineWidth = 2.5 * k; x.strokeRect(12 * k, 12 * k, w - 24 * k, h - 24 * k); x.fillStyle = INK; x.fillRect(12 * k, h / 2 - 22 * k, w - 24 * k, 44 * k);
    x.fillStyle = PAPER; x.font = `800 ${24 * k}px ${UI_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('EVENT', w / 2, h / 2); x.restore();
  } else {
    woodBase(x, w, h);
    x.save(); x.strokeStyle = BRASS; x.lineWidth = 4 * k; x.strokeRect(9 * k, 9 * k, w - 18 * k, h - 18 * k); x.strokeStyle = BRASS_EDGE; x.lineWidth = 1.5 * k; x.strokeRect(16 * k, 16 * k, w - 32 * k, h - 32 * k); x.restore();
    x.save(); x.translate(0, 3 * k); drawIcon(x, '?', w / 2, h * .46, k * 1.8, WALNUT_DARK, 'a'); x.restore(); drawIcon(x, '?', w / 2, h * .46, k * 1.8, BRASS_EDGE, 'a');
  }
}
/** 一張卡面：底圖快取，翻開後只重畫跳動的大字。 */
export class CardFront {
  readonly canvas = makeCanvas(); private base = makeCanvas(); private shown: number | null = -1;
  constructor(readonly variant: ArtVariant, readonly id: string, readonly name: string, readonly face: CardFace) { drawFrontBase(this.base, variant, id, name, face); }
  draw(count: number | null) {
    if (count === this.shown) return false; this.shown = count;
    const x = this.canvas.getContext('2d')!; x.clearRect(0, 0, CARD_W, CARD_H); x.drawImage(this.base, 0, 0); drawHeadline(this.canvas, this.variant, this.face, count); return true;
  }
}

export interface DrawnLike { id: string; name: string; material?: number; targetBallId?: number }
export interface RevealOptions { variant: ArtVariant; audio: BoardAudio; reduced: boolean; stage: HTMLElement; slot: HTMLCanvasElement; values: EventCardValues; materialName: (m: number) => string }
/**
 * 抽卡展示：卡背從 EVENT 格飛起 → 抖一下 → 翻面 → 蓋章（舞台小震）→ 大字跳到目標值 → 收進操作區。
 * 減少動態：不移動、不翻、不震，直接在舞台中央顯示靜態卡面 1.6 秒；聲音照常。
 */
export function createEventReveal(o: RevealOptions) {
  const root = document.createElement('div'); root.className = 'event-reveal'; root.dataset.variant = o.variant; root.setAttribute('aria-hidden', 'true'); root.hidden = true;
  root.innerHTML = '<div class="er-card"><div class="er-face er-back"></div><div class="er-face er-front"></div></div><div class="er-stamp">抽到</div><div class="er-dots"></div>';
  document.body.append(root);
  const card = root.querySelector<HTMLElement>('.er-card')!, stampEl = root.querySelector<HTMLElement>('.er-stamp')!, dots = root.querySelector<HTMLElement>('.er-dots')!;
  const back = makeCanvas(); drawCardBack(back, o.variant); root.querySelector('.er-back')!.append(back);
  for (let i = 0; i < 10; i++) dots.append(document.createElement('i'));
  let front: CardFront | null = null, startAt = -1, frozen: number | null = null, from = { x: 0, y: 0 }, fired = new Set<string>();
  const m = revealMoments(), staticEnd = 1.6;
  function faceFor(drawn: DrawnLike) {
    const face = cardFace(drawn.id, o.values, drawn.material !== undefined ? o.materialName(drawn.material) : undefined, drawn.targetBallId);
    return new CardFront(o.variant, drawn.id, drawn.name, face);
  }
  function paintSlot(f: CardFront) {
    f.draw(null); const x = o.slot.getContext('2d')!; o.slot.width = CARD_W / 2; o.slot.height = CARD_H / 2;
    x.drawImage(f.canvas, 0, 0, CARD_W / 2, CARD_H / 2); o.slot.hidden = false;
    o.slot.style.visibility = '';
  }
  function finish() {
    if (root.hidden || !front) return;
    paintSlot(front); root.hidden = true; o.stage.style.translate = ''; frozen = null;
    // 不補播跳過的音效，避免快速連點時把整串聲音擠在一起。
    fired.add('slot');
    if (!o.reduced) o.slot.classList.add('slot-arrive');
  }
  bindRevealSkip(document, () => !root.hidden, finish);
  function start(drawn: DrawnLike, now: number, fromPoint: { x: number; y: number }) {
    front?.canvas.remove(); front = faceFor(drawn); front.draw(o.reduced || front.face.count === null ? null : 0);
    root.querySelector('.er-front')!.append(front.canvas); from = fromPoint; startAt = now; frozen = null; fired = new Set(); root.hidden = false; o.slot.classList.remove('slot-arrive');
    if (o.reduced) paintSlot(faceFor(drawn));
    // 手機保留操作區的排版位置作收卡終點，不另外在舞台疊一張卡。
    if (innerWidth <= 700) { o.slot.hidden = false; o.slot.style.visibility = 'hidden'; }
  }
  function once(key: string, fn: () => void) { if (!fired.has(key)) { fired.add(key); if (frozen === null) fn(); } }
  function update(now: number) {
    if (root.hidden || !front) return;
    const t = frozen ?? now - startAt, r = o.stage.getBoundingClientRect(), narrow = r.width < 600;
    const w = narrow ? 124 : 168, cx = r.left + r.width / 2, cy = r.top + r.height * (narrow ? .5 : .47);
    root.style.setProperty('--card-w', `${w}px`);
    once('draw', () => o.audio.cardDraw(o.variant));
    if (o.reduced) {
      if (t >= m.flipAt + REVEAL.flip / 2) once('flip', () => o.audio.cardFlip(o.variant));
      if (t >= m.stampAt) once('stamp', () => o.audio.cardStamp(o.variant));
      if (t >= m.countEnd) once('reward', () => o.audio.cardReward(ORDER.indexOf(front!.id)));
      place(cx, cy, 1, 0, 0, 1); stamp(1, 1); root.dataset.phase = 'static';
      if (frozen === null && t > staticEnd) finish();
      return;
    }
    let x = cx, y = cy, scale = 1, rotY = 0, rotZ = 0, opacity = 1;
    if (t < REVEAL.rise) { const p = easeOut(t / REVEAL.rise); x = from.x + (cx - from.x) * p; y = from.y + (cy - from.y) * p; scale = .3 + .75 * p; rotY = 180; rotZ = -14 * (1 - p); }
    else if (t < m.flipAt) { const k = (t - REVEAL.rise) / REVEAL.shake; scale = 1.05 - .05 * k; rotY = 180; rotZ = Math.sin(k * Math.PI * 6) * 3 * (1 - k); }
    else if (t < m.stampAt) { const k = (t - m.flipAt) / REVEAL.flip; rotY = 180 * (1 - easeInOut(k)); scale = 1 + .14 * Math.sin(Math.PI * k); }
    // 畫面掉幀跳過翻面那一段時，翻卡聲仍要補上。
    if (t >= m.flipAt + REVEAL.flip / 2) once('flip', () => o.audio.cardFlip(o.variant));
    else if (t >= m.flyAt) {
      const k = Math.min(1, (t - m.flyAt) / REVEAL.fly), s = o.slot.getBoundingClientRect(), visible = !o.slot.hidden && s.width > 0 && s.bottom > 0 && s.top < innerHeight;
      const tx = visible ? s.left + s.width / 2 : cx, ty = visible ? s.top + s.height / 2 : cy + r.height * .6, e = k * k;
      x = cx + (tx - cx) * e; y = cy + (ty - cy) * e; scale = 1 - .62 * e; opacity = 1 - .7 * e;
    }
    // 桌機保留現有呈現；手機的收卡與翻卡音效條件獨立，終點使用正常排版的操作區卡位。
    if (innerWidth <= 700 && t >= m.flyAt) {
      const s = o.slot.getBoundingClientRect(), k = Math.min(1, (t - m.flyAt) / REVEAL.fly), e = k * k;
      x = cx + (s.left + s.width / 2 - cx) * e; y = cy + (s.top + s.height / 2 - cy) * e;
      scale = 1 + (s.width / w - 1) * e; opacity = 1;
    }
    root.dataset.phase = t < m.flipAt ? 'back' : t < m.stampAt ? 'flip' : t < m.flyAt ? 'shown' : 'fly';
    place(x, y, scale, rotY, rotZ, opacity);
    // 蓋章：翻開那一刻章從 2.2 倍砸下來，舞台震 3 px，墨點往外濺。
    if (t >= m.stampAt) {
      once('stamp', () => o.audio.cardStamp(o.variant));
      const k = Math.min(1, (t - m.stampAt) / REVEAL.stamp); stamp(2.2 - 1.2 * easeOut(k), Math.min(1, k * 2) * (t >= m.flyAt ? opacity : 1));
      const shake = t - m.stampAt < .15 ? 3 * (1 - (t - m.stampAt) / .15) : 0; o.stage.style.translate = shake ? `${Math.sin(t * 160) * shake}px ${Math.cos(t * 130) * shake * .6}px` : '';
      const d = Math.min(1, (t - m.stampAt) / .4); dots.style.setProperty('--burst', String(easeOut(d))); dots.style.opacity = String(d < 1 ? 1 - d : 0);
    } else { stamp(0, 0); dots.style.opacity = '0'; }
    // 數字跳動：每跳一次一記短點擊；跳完一串上行的獎勵音。
    if (front.face.count !== null && t >= m.stampAt) { const value = revealCount(t, front.face.count); if (front.draw(value) && t < m.countEnd) once(`tick-${value}`, () => o.audio.tick(value * 2)); }
    if (t >= m.countEnd) once('reward', () => o.audio.cardReward(ORDER.indexOf(front!.id)));
    if (t >= m.end && frozen === null) finish();
  }
  function place(x: number, y: number, scale: number, rotY: number, rotZ: number, opacity: number) {
    root.style.transform = `translate(${x}px,${y}px)`; card.style.transform = `translate(-50%,-50%) scale(${scale}) rotateZ(${rotZ}deg) rotateY(${rotY}deg)`; root.style.opacity = String(opacity);
  }
  function stamp(scale: number, opacity: number) { stampEl.style.transform = `translate(-50%,-50%) rotate(-12deg) scale(${scale})`; stampEl.style.opacity = String(opacity); }
  return {
    start, update, finish,
    /** 截圖用：停在時間表的某一刻，不發聲。 */
    freeze(drawn: DrawnLike, t: number, fromPoint: { x: number; y: number }) { start(drawn, 0, fromPoint); frozen = t; fired = new Set(['draw', 'flip', 'stamp', 'reward', 'slot']); update(0); },
    /** 不播展示，直接把這張卡面放進操作區（例如截圖腳本快轉之後）。 */
    show(drawn: DrawnLike) { paintSlot(faceFor(drawn)); },
    reset() { root.hidden = true; o.slot.hidden = true; o.slot.style.visibility = ''; o.stage.style.translate = ''; front = null; },
    get active() { return !root.hidden; },
  };
}
function easeOut(t: number) { return 1 - (1 - Math.max(0, Math.min(1, t))) ** 3; }
function easeInOut(t: number) { return t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2; }

/** 卡面特寫：一次畫出某一版的六張卡（截圖用）。 */
export function faceSheet(variant: ArtVariant, names: readonly { id: string; name: string }[], values: EventCardValues, materialName: string) {
  return names.map(card => { const f = new CardFront(variant, card.id, card.name, cardFace(card.id, values, materialName, 12)); f.draw(null); return f.canvas; });
}
