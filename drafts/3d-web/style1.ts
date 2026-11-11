import * as THREE from 'three';

/**
 * 風格一「手工桌遊」的呈現素材。全部以程式繪製，不載入外部圖檔或字型。
 * 數值與 DESIGN.md 的規則一一對應；歪斜、手抖、套印偏移都是寫死的作者決定，不用亂數。
 */
export type BallStyle = 'a' | 'b' | 'c';
export type IconStyle = 'a' | 'b' | 'c';
export type LightStyle = 'a' | 'b' | 'c';
export interface StyleChoice { ball: BallStyle; icon: IconStyle; light: LightStyle; ring: boolean }

export function readChoice(search: string): StyleChoice {
  const q = new URLSearchParams(search), pick = (k: string, d: 'a' | 'b' | 'c') => { const v = q.get(k); return v === 'a' || v === 'b' || v === 'c' ? v : d; };
  return { ball: pick('ball', 'b'), icon: pick('icon', 'a'), light: pick('light', 'a'), ring: q.get('ring') === '1' };
}

/** 色票：用途寫在 DESIGN.md 第 2 節。 */
export const TOKENS = {
  desk: 0x1c120b, walnut: 0x5a3a22, walnutDark: 0x3a2416, paper: 0xe8dcc2, paperEdge: 0xcdbb98,
  ink: 0x2b2118, yarn: 0x8fdcc6, yarnGlow: 0xb8f5e2, ochre: 0xc9963f, brass: 0xb88a45, brassEdge: 0xd2a862,
  steel: 0x9aa3a8, glass: 0xd6ece6, lacquer: 0x9b2c1c, bone: 0xe9dfc9, pip: 0x6b1a12,
  surge: '#c8552d', tune: '#4f6f9a', event: '#d39a2c', start: '#5f8a5a', bgIdle: 0x120b06, bgShift: 0x0c1210,
} as const;
const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;
export const HAND_FONT = '"Segoe Print","Ink Free","Bradley Hand","Chalkboard SE","Comic Sans MS",cursive';
export const NUMBER_FONT = '"Georgia","Times New Roman",serif';

/** 主暖燈三版：色溫換算 RGB 依 Tanner Helland 近似表。 */
export const LIGHTS: Record<LightStyle, { kelvin: number; color: number; intensity: number; angle: number; penumbra: number; position: [number, number, number]; ambient: number; vignette: number }> = {
  a: { kelvin: 2700, color: 0xffa957, intensity: 30, angle: 0.55, penumbra: 0.6, position: [-3.6, 9.5, 1.6], ambient: 0.22, vignette: 0.72 },
  b: { kelvin: 3200, color: 0xffbb78, intensity: 22, angle: 0.85, penumbra: 0.9, position: [-3.0, 9.0, 2.2], ambient: 0.38, vignette: 0.5 },
  c: { kelvin: 2200, color: 0xff932c, intensity: 36, angle: 0.45, penumbra: 0.5, position: [-5.2, 7.0, 0.8], ambient: 0.15, vignette: 0.85 },
};

function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, x: c.getContext('2d')! }; }
function lcg(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function tex(c: HTMLCanvasElement, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }

/** 胡桃木：年輪沿長邊，深淺兩色之間只走正弦波紋，不加白噪點（避免像塑膠）。 */
export function walnutTexture(size = 1024, light = false) {
  const { c, x } = canvas(size, size), px = x.createImageData(size, size), r = lcg(811);
  const base = light ? [98, 62, 34] : [62, 38, 21];
  for (let v = 0; v < size; v++) for (let u = 0; u < size; u++) {
    const k = 1024 / size, warp = v * k + 9 * Math.sin(u * k * .008 + v * k * .005) + 4 * Math.sin(u * k * .017 + v * k * .009);
    const g = Math.sin(warp * .65) * 1.6 + Math.sin(warp * .11) * 4 + Math.sin(warp * .023) * 5 + (r() - .5) * 3, i = (v * size + u) * 4;
    px.data[i] = base[0] + g; px.data[i + 1] = base[1] + g * .62; px.data[i + 2] = base[2] + g * .38; px.data[i + 3] = 255;
  }
  x.putImageData(px, 0, 0); return tex(c);
}

/** 紙面：米白底、短纖維與幾塊淡色吸墨斑。 */
function paperBase(x: CanvasRenderingContext2D, w: number, h: number, seed: number, tone = css(TOKENS.paper)) {
  x.fillStyle = tone; x.fillRect(0, 0, w, h); const r = lcg(seed);
  for (let i = 0; i < 26; i++) { const g = x.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, 40 + r() * 120); g.addColorStop(0, 'rgba(160,130,90,.07)'); g.addColorStop(1, 'rgba(160,130,90,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  const fibers = Math.round(w * h / 300);
  for (let i = 0; i < fibers; i++) {
    const fx = r() * w, fy = r() * h, a = r() * Math.PI, l = 3 + r() * 9; x.strokeStyle = r() < .5 ? 'rgba(120,95,60,.10)' : 'rgba(255,250,235,.16)'; x.lineWidth = .7;
    x.beginPath(); x.moveTo(fx, fy); x.quadraticCurveTo(fx + Math.cos(a + .6) * l * .5, fy + Math.sin(a + .6) * l * .5, fx + Math.cos(a) * l, fy + Math.sin(a) * l); x.stroke();
  }
}

/** 手抖線：低頻正弦位移（像手腕的慢晃），不是高頻雜訊。 */
export const STROKES: Record<IconStyle, { width: number; tremor: number; wavelength: number; cap: CanvasLineCap; passes: number; plateOffset: number; inkDrop: boolean }> = {
  a: { width: 3, tremor: .8, wavelength: 40, cap: 'round', passes: 1, plateOffset: 1.5, inkDrop: false },
  b: { width: 7, tremor: 1.5, wavelength: 70, cap: 'round', passes: 2, plateOffset: 1.5, inkDrop: true },
  c: { width: 5, tremor: .4, wavelength: 90, cap: 'butt', passes: 1, plateOffset: 3, inkDrop: false },
};
type Pt = [number, number];
function handPath(x: CanvasRenderingContext2D, pts: Pt[], color: string, style: IconStyle, scale = 1, phase = 0) {
  const s = STROKES[style], dense: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 3)); for (let j = 0; j < n; j++) dense.push([ax + (bx - ax) * j / n, ay + (by - ay) * j / n]); }
  dense.push(pts[pts.length - 1]);
  let travelled = 0;
  for (let pass = 0; pass < s.passes; pass++) {
    x.save(); x.strokeStyle = color; x.lineCap = s.cap; x.lineJoin = 'round'; x.lineWidth = s.width * scale; x.globalAlpha = pass ? .55 : style === 'c' ? .88 : .95;
    x.beginPath(); travelled = 0;
    dense.forEach(([px, py], i) => {
      const [qx, qy] = dense[Math.min(dense.length - 1, i + 1)], [ox, oy] = dense[Math.max(0, i - 1)], dx = qx - ox, dy = qy - oy, l = Math.hypot(dx, dy) || 1;
      if (i) travelled += Math.hypot(px - dense[i - 1][0], py - dense[i - 1][1]);
      const off = s.tremor * scale * Math.sin(travelled / (s.wavelength * scale) * Math.PI * 2 + phase + pass * 1.7) + pass * .9 * scale;
      const tx = px - dy / l * off, ty = py + dx / l * off; if (i) x.lineTo(tx, ty); else x.moveTo(tx, ty);
    });
    x.stroke(); x.restore();
  }
  if (style === 'c') { // 版印：沿筆畫三段墨量不均，靠紙色淡塗回去。
    x.save(); x.globalAlpha = .22; x.strokeStyle = css(TOKENS.paper); x.lineWidth = s.width * scale * .6; x.setLineDash([14 * scale, 22 * scale]); x.beginPath(); dense.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.stroke(); x.restore();
  }
  if (s.inkDrop) { const [ex, ey] = dense[dense.length - 1]; x.save(); x.fillStyle = color; x.globalAlpha = .8; x.beginPath(); x.arc(ex, ey, s.width * scale * .62, 0, Math.PI * 2); x.fill(); x.restore(); }
}
function circlePts(cx: number, cy: number, rx: number, ry: number, start = 0, sweep = Math.PI * 2.04, n = 64): Pt[] { return Array.from({ length: n + 1 }, (_, i) => { const a = start + sweep * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; }); }

export type CardKind = 'START' | 'SURGE' | 'TUNE' | 'EVENT';
const KIND_COLOR: Record<CardKind, string> = { START: TOKENS.start, SURGE: TOKENS.surge, TUNE: TOKENS.tune, EVENT: TOKENS.event };
function drawIcon(x: CanvasRenderingContext2D, kind: CardKind, cx: number, cy: number, style: IconStyle, k: number) {
  const color = kind === 'START' || kind === 'TUNE' ? css(TOKENS.ink) : KIND_COLOR[kind];
  if (kind === 'TUNE') { handPath(x, circlePts(cx, cy, 34 * k, 30 * k), css(TOKENS.ink), style, k, 0); handPath(x, circlePts(cx, cy, 20 * k, 17 * k, 1), css(TOKENS.ink), style, k, 2); }
  if (kind === 'START') { handPath(x, [[cx - 40 * k, cy], [cx + 34 * k, cy]], color, style, k); handPath(x, [[cx + 14 * k, cy - 18 * k], [cx + 36 * k, cy], [cx + 14 * k, cy + 18 * k]], color, style, k, 1); }
  if (kind === 'SURGE') { handPath(x, [[cx + 10 * k, cy - 38 * k], [cx - 16 * k, cy + 4 * k], [cx + 6 * k, cy + 2 * k], [cx - 10 * k, cy + 38 * k], [cx + 22 * k, cy - 8 * k], [cx, cy - 6 * k], [cx + 10 * k, cy - 38 * k]], color, style, k); }
  if (kind === 'EVENT') { handPath(x, [...circlePts(cx, cy - 14 * k, 18 * k, 17 * k, Math.PI * 1.05, Math.PI * 1.45, 24), [cx + 2 * k, cy + 10 * k], [cx + 1 * k, cy + 18 * k]], color, style, k); x.save(); x.fillStyle = color; x.beginPath(); x.arc(cx + 1 * k, cy + 32 * k, STROKES[style].width * k * .9, 0, Math.PI * 2); x.fill(); x.restore(); }
}

/** 一張外圈紙卡：彩色邊框是另一版色，整批朝右下套印偏移。 */
export function drawCard(c: HTMLCanvasElement, kind: CardKind, index: number, style: IconStyle) {
  const x = c.getContext('2d')!, w = c.width, h = c.height, k = w / 256, off = STROKES[style].plateOffset * k;
  paperBase(x, w, h, 300 + index * 17);
  x.save(); x.strokeStyle = KIND_COLOR[kind]; x.globalAlpha = .9; x.lineWidth = 9 * k; x.strokeRect(9 * k + off, 9 * k + off, w - 18 * k, h - 18 * k); x.restore();
  drawIcon(x, kind, w / 2, h * .4, style, k);
  x.save(); x.fillStyle = css(TOKENS.ink); x.globalAlpha = .9; x.font = `700 ${28 * k}px ${HAND_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(kind, w / 2 + off * .3, h * .79); x.font = `${13 * k}px ${HAND_FONT}`; x.textAlign = 'left'; x.fillText(String(index + 1), 20 * k, 26 * k); x.restore();
}

/** 場地紙面與墨線（核心外兩圈、發射座弧線、四角對位記號）共用圖示筆觸。 */
export function drawField(c: HTMLCanvasElement, style: IconStyle, launcherZ: number) {
  const x = c.getContext('2d')!, w = c.width, h = c.height, px = (wx: number) => (wx + 4) / 8 * w, pz = (wz: number) => (wz + 3.4) / 6.8 * h, k = w / 1024;
  paperBase(x, w, h, 97);
  x.save(); x.globalAlpha = .55;
  handPath(x, circlePts(px(0), pz(0), 1.05 / 8 * w, 1.05 / 6.8 * h, .3), css(TOKENS.ink), style, k * .8, 0);
  handPath(x, circlePts(px(0), pz(0), 1.45 / 8 * w, 1.45 / 6.8 * h, 2.1), css(TOKENS.ink), style, k * .7, 1.3);
  handPath(x, circlePts(px(0), pz(launcherZ), .62 / 8 * w, .62 / 6.8 * h, Math.PI * 1.12, Math.PI * .76, 30), css(TOKENS.ink), style, k * .8, .7);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const cx = px(sx * 3.7), cz = pz(sz * 3.1); handPath(x, [[cx, cz - sz * 26 * k], [cx, cz], [cx - sx * 26 * k, cz]], css(TOKENS.ink), style, k * .7, sx + sz); }
  x.restore();
}

/** 球號紙籤：米白圓紙、手畫外圈、襯線數字；歪斜依球號奇偶交替 ±(2–4)°。 */
export function badgeCanvas(id: number) {
  const { c, x } = canvas(128, 128);
  x.fillStyle = css(TOKENS.paper); x.beginPath(); x.arc(64, 64, 54, 0, Math.PI * 2); x.fill();
  handPath(x, circlePts(64, 64, 52, 52, id * .7), css(TOKENS.ink), 'a', .9, id);
  x.fillStyle = css(TOKENS.ink); x.font = `700 64px ${NUMBER_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(id).padStart(2, '0'), 64, 68);
  return c;
}
export const badgeTilt = (id: number) => (id % 2 ? 1 : -1) * (2 + Math.abs(id) % 3) * Math.PI / 180;

/** 球三版。材質編號 0／1／2 仍以內圈數目區分（漆球的漆帶數 1／2／3）。 */
const ballTextures = new Map<string, THREE.Texture>();
export const SHARED_TEXTURES = new Set<THREE.Texture>();
function shared(key: string, make: () => THREE.Texture) { let t = ballTextures.get(key); if (!t) { t = make(); ballTextures.set(key, t); SHARED_TEXTURES.add(t); } return t; }
function lacquerTexture(material: number) {
  const { c, x } = canvas(256, 128), body = ['#cfe3d6', '#6f7d86', '#c9963f'][material];
  x.fillStyle = body; x.fillRect(0, 0, 256, 128);
  const bands = material + 1; // 經線方向一圈一圈的手刷漆帶
  for (let b = 0; b < bands; b++) { const y = 64 + (b - (bands - 1) / 2) * 14; handPath(x, [[-4, y], [260, y + 1]], css(TOKENS.ink), 'b', .9, b * 2); }
  return tex(c);
}
function beadTexture(material: number) {
  const { c, x } = canvas(256, 128), base = [[214, 170, 112], [104, 66, 38], [150, 44, 28]][material], px = x.createImageData(256, 128);
  for (let v = 0; v < 128; v++) for (let u = 0; u < 256; u++) { const g = Math.sin((v + 4 * Math.sin(u * .05)) * .5) * 6 + Math.sin(v * .13) * 5, i = (v * 256 + u) * 4; px.data[i] = base[0] + g; px.data[i + 1] = base[1] + g * .6; px.data[i + 2] = base[2] + g * .35; px.data[i + 3] = 255; }
  x.putImageData(px, 0, 0); return tex(c);
}
export function ballMaterial(style: BallStyle, material: number, emissive: number) {
  if (style === 'a') return new THREE.MeshPhysicalMaterial({ map: shared(`lacquer${material}`, () => lacquerTexture(material)), roughness: .38, metalness: 0, clearcoat: .6, clearcoatRoughness: .3, emissive, emissiveIntensity: 0 });
  if (style === 'c') return new THREE.MeshPhysicalMaterial({ map: shared(`bead${material}`, () => beadTexture(material)), roughness: material === 2 ? .45 : .58, metalness: 0, clearcoat: material === 2 ? .45 : 0, emissive, emissiveIntensity: 0 });
  return new THREE.MeshPhysicalMaterial({ color: [TOKENS.glass, TOKENS.steel, TOKENS.brass][material], metalness: [.05, .95, .9][material], roughness: [.06, .22, .3][material], transmission: material === 0 ? .85 : 0, thickness: .15, clearcoat: 1, emissive, emissiveIntensity: 0 });
}

/** 共振毛線：斜捻紋理，沿線方向重複；單一 InstancedMesh。 */
export function yarnTexture() {
  const { c, x } = canvas(64, 256); x.fillStyle = css(TOKENS.yarn); x.fillRect(0, 0, 64, 256);
  for (let i = -8; i < 40; i++) { x.strokeStyle = i % 2 ? 'rgba(255,255,255,.35)' : 'rgba(40,90,80,.28)'; x.lineWidth = 5; x.beginPath(); x.moveTo(0, i * 8); x.lineTo(64, i * 8 + 26); x.stroke(); }
  const r = lcg(41); for (let i = 0; i < 120; i++) { x.strokeStyle = 'rgba(230,255,248,.35)'; x.lineWidth = .8; const yy = r() * 256, xx = r() * 64; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + (r() - .5) * 10, yy + (r() - .5) * 10); x.stroke(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6); return t;
}

/** 外圈棋盤：只有外觀，不接規則。14 格順時針，從左下 START 起。 */
const RING: { kind: CardKind; x: number; z: number; tilt: number }[] = [
  { kind: 'START', x: -4.6, z: 4.55, tilt: -5.5 }, { kind: 'TUNE', x: -2.3, z: 4.6, tilt: 3 }, { kind: 'TUNE', x: 0, z: 4.55, tilt: -2.5 }, { kind: 'SURGE', x: 2.3, z: 4.6, tilt: 4 }, { kind: 'EVENT', x: 4.6, z: 4.55, tilt: -6 },
  { kind: 'SURGE', x: 5.2, z: 1.45, tilt: 3.5 }, { kind: 'TUNE', x: 5.2, z: -1.5, tilt: -2 },
  { kind: 'EVENT', x: 4.6, z: -4.55, tilt: 5 }, { kind: 'SURGE', x: 2.3, z: -4.6, tilt: -3 }, { kind: 'TUNE', x: 0, z: -4.55, tilt: 2 }, { kind: 'SURGE', x: -2.3, z: -4.6, tilt: -4 }, { kind: 'EVENT', x: -4.6, z: -4.55, tilt: 6 },
  { kind: 'TUNE', x: -5.2, z: -1.5, tilt: -3.5 }, { kind: 'SURGE', x: -5.2, z: 1.45, tilt: 2.5 },
];
export function buildRing(walnut: THREE.Material, style: IconStyle) {
  const group = new THREE.Group(); group.name = 'outer-ring';
  const slab = new THREE.Mesh(new THREE.BoxGeometry(12.6, .1, 10.9), walnut); slab.position.y = -.33; slab.receiveShadow = true; group.add(slab);
  const edgeMat = new THREE.MeshStandardMaterial({ color: TOKENS.paperEdge, roughness: .95 });
  const cards: { canvas: HTMLCanvasElement; texture: THREE.Texture; kind: CardKind; index: number }[] = [];
  RING.forEach((cell, index) => {
    const { c } = canvas(256, 196); drawCard(c, cell.kind, index, style); const t = tex(c); t.anisotropy = 4;
    const top = new THREE.MeshStandardMaterial({ map: t, roughness: .92, metalness: 0 });
    const card = new THREE.Mesh(new THREE.BoxGeometry(1.5, .014, 1.15), [edgeMat, edgeMat, top, edgeMat, edgeMat, edgeMat]);
    // 放卡的手往棋盤中心推一點：每張朝內 0.04（約卡寬 3%）。
    const inward = new THREE.Vector2(-cell.x, -cell.z).normalize().multiplyScalar(.04);
    card.position.set(cell.x + inward.x, -.263, cell.z + inward.y); card.rotation.y = cell.tilt * Math.PI / 180; card.castShadow = card.receiveShadow = true; group.add(card);
    cards.push({ canvas: c, texture: t, kind: cell.kind, index });
  });
  // 紅漆木棋子：站在下排 SURGE 上。
  const profile = [[0, 0], [.17, 0], [.17, .04], [.11, .07], [.07, .2], [.05, .3], [.09, .36], [.1, .42], [.07, .5], [0, .52]].map(([a, b]) => new THREE.Vector2(a, b));
  const pawn = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), new THREE.MeshPhysicalMaterial({ color: TOKENS.lacquer, roughness: .45, clearcoat: .5, clearcoatRoughness: .4 }));
  pawn.position.set(2.62, -.256, 4.45); pawn.castShadow = true; group.add(pawn);
  // 骨白骰子：放在桌面，五點朝上。
  const face = (n: number) => { const { c, x } = canvas(128, 128); x.fillStyle = css(TOKENS.bone); x.fillRect(0, 0, 128, 128); x.fillStyle = css(TOKENS.pip);
    const spots: Record<number, Pt[]> = { 1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[34, 34], [64, 64], [94, 94]], 4: [[36, 36], [92, 36], [36, 92], [92, 92]], 5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]], 6: [[36, 30], [92, 30], [36, 64], [92, 64], [36, 98], [92, 98]] };
    for (const [sx, sy] of spots[n]) { x.beginPath(); x.arc(sx + 1, sy + 1, 10, 0, Math.PI * 2); x.fill(); } return new THREE.MeshStandardMaterial({ map: tex(c), roughness: .6 }); };
  const die = new THREE.Mesh(new THREE.BoxGeometry(.42, .42, .42), [face(3), face(4), face(5), face(2), face(1), face(6)]);
  die.position.set(4.2, -.565, 6.2); die.rotation.y = .42; die.castShadow = die.receiveShadow = true; group.add(die);
  return { group, redraw(style: IconStyle) { for (const card of cards) { drawCard(card.canvas, card.kind, card.index, style); card.texture.needsUpdate = true; } } };
}
