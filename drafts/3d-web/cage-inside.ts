import * as THREE from 'three';
import { TOKENS, paperBase, handPath, circlePts, type Pt } from './style1';
import type { ArtVariant } from './art-round2';
import { cower, INSIDE_TIMING } from './inside';

/**
 * 籠子裡關的東西三版。材料只用參考圖桌上已有的：紅漆木、骨白、毛線、紙卡、麥克筆墨線。
 * a：紅漆木偶怪（02 特寫與 style-1.png 的紅漆木棋子，眼睛取骰子的骨白與點色），頭上兩支原木小角。
 * b：毛線團怪（01／04 的毛線，顏色取 TUNE 灰藍，不跟共振的青色、籠子的赭色混）。
 * c：紙摺怪（02 的紙卡、EVENT 赭黃套印邊框，臉用粗麥克筆手抖線畫）。紙用 TUNE 灰藍卡色：米白紙在手機整桌鏡頭下
 *    會和赭色毛線木樁籠混在一起，冷色的卡紙才和暖色的籠子、桌面分得開。
 * 反應全部由規則的血量與擊破驅動，只讀不寫；歪斜、角度都依怪物編號寫死，不用亂數。
 */
export interface InsideState { now: number; reduced: boolean; hp: number; hitT: number; defT: number }
export interface Inside { root: THREE.Group; update(s: InsideState): void }
const INSIDE_SCALE = 1.25;

const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeIn = (t: number) => t * t;
const FALL_AXIS = new THREE.Vector3(1, 0, -1).normalize();

let shared: ReturnType<typeof makeShared> | undefined;
function makeShared() {
  const lacquer = new THREE.MeshPhysicalMaterial({ color: TOKENS.lacquer, roughness: .45, clearcoat: .5, clearcoatRoughness: .4, emissive: TOKENS.lacquer, emissiveIntensity: .3 });
  const rawWood = new THREE.MeshStandardMaterial({ color: 0xd19e5c, roughness: .5, emissive: 0xd19e5c, emissiveIntensity: .12 });
  const bone = new THREE.MeshStandardMaterial({ color: TOKENS.bone, roughness: .6, emissive: TOKENS.bone, emissiveIntensity: .25 });
  const pip = new THREE.MeshStandardMaterial({ color: TOKENS.pip, roughness: .6 });
  const yarnBall = new THREE.MeshStandardMaterial({ map: yarnBallTexture(), roughness: 1, emissive: 0x4f6f9a, emissiveIntensity: .28 });
  const yarnStrand = new THREE.MeshStandardMaterial({ map: strandTexture(), roughness: 1, emissive: 0x4f6f9a, emissiveIntensity: .28 });
  const faces = { calm: paperFace('calm'), hurt: paperFace('hurt'), out: paperFace('out') };
  // 自發光用白色乘上紙面貼圖，讓籠子陰影裡的卡紙仍是原本的灰藍，不被染成暖色。
  const paperFront = new THREE.MeshStandardMaterial({ map: faces.calm, roughness: .92, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: .3, emissiveMap: faces.calm });
  const plain = plainPaper();
  const paperBack = new THREE.MeshStandardMaterial({ map: plain, roughness: .92, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: .3, emissiveMap: plain });
  return {
    lacquer, rawWood, bone, pip, yarnBall, yarnStrand, faces, paperFront, paperBack,
    eye: new THREE.SphereGeometry(.016, 12, 8), pupil: new THREE.SphereGeometry(.009, 10, 6),
    head: new THREE.SphereGeometry(.058, 20, 14), horn: new THREE.ConeGeometry(.014, .05, 8),
    pawnBody: new THREE.LatheGeometry(([[0, 0], [.074, 0], [.078, .016], [.062, .032], [.042, .058], [.032, .135], [.052, .152], [.052, .166], [.03, .178], [0, .18]] as [number, number][]).map(([r, y]) => new THREE.Vector2(r, y)), 28),
    ball: new THREE.SphereGeometry(.1, 28, 20),
  };
}
/** 毛線團：灰藍底，一束一束斜繞的線（深淺兩色交替）再加短纖維。 */
function yarnBallTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d')!;
  x.fillStyle = TOKENS.tune; x.fillRect(0, 0, 256, 128);
  // 四束不同方向的繞線，每束 7 股；方向與間距寫死。
  const bundles = [[.35, 0], [-.5, 40], [1.1, 90], [-1.3, 150]];
  bundles.forEach(([tilt, off], b) => {
    for (let i = 0; i < 7; i++) {
      x.strokeStyle = i % 2 ? 'rgba(232,220,194,.28)' : 'rgba(43,33,24,.32)'; x.lineWidth = 3.2; x.beginPath();
      for (let u = 0; u <= 256; u += 8) { const y = off + i * 4.5 + u * tilt * .25 + 6 * Math.sin(u / 40 + b); x[u ? 'lineTo' : 'moveTo'](u, ((y % 128) + 128) % 128); }
      x.stroke();
    }
  });
  let s = 913; const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 260; i++) { x.strokeStyle = r() < .5 ? 'rgba(232,220,194,.35)' : 'rgba(43,33,24,.25)'; x.lineWidth = .8; const px = r() * 256, py = r() * 128; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - .5) * 9, py + (r() - .5) * 9); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
/** 鬆脫的線頭：同色斜捻紋理。 */
function strandTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 128; const x = c.getContext('2d')!;
  x.fillStyle = TOKENS.tune; x.fillRect(0, 0, 32, 128);
  for (let i = -4; i < 20; i++) { x.strokeStyle = i % 2 ? 'rgba(232,220,194,.32)' : 'rgba(43,33,24,.32)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, i * 8); x.lineTo(32, i * 8 + 12); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6); return t;
}
/**
 * 紙摺怪的正面：TUNE 灰藍卡紙（紙纖維底）、EVENT 赭黃套印邊框（往右下偏 1.5 px）、粗麥克筆畫的臉。
 * calm：圓眼＋鋸齒嘴；hurt：擠成 > < 的眼＋波浪嘴；out：被擊破的 × 眼。
 */
function paperFace(mood: 'calm' | 'hurt' | 'out') {
  const w = 160, h = 192, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!;
  paperBase(x, w, h, 517, TOKENS.tune);
  x.save(); x.strokeStyle = TOKENS.event; x.globalAlpha = .9; x.lineWidth = 12; x.strokeRect(9.5, 9.5, w - 16, h - 16); x.restore();
  const ink = css(TOKENS.ink), ex = [52, 108], ey = 78;
  if (mood === 'calm') {
    ex.forEach((cx, i) => { handPath(x, circlePts(cx, ey, 18, 20, i, Math.PI * 2.04, 32), ink, 'b', 1.2, i); x.fillStyle = ink; x.beginPath(); x.arc(cx + 3, ey + 4, 10, 0, Math.PI * 2); x.fill(); });
    handPath(x, [[38, 134], [54, 120], [70, 136], [86, 120], [102, 136], [118, 120], [124, 130]], ink, 'b', 1.2, 2);
  } else if (mood === 'hurt') {
    handPath(x, [[36, 62], [64, 78], [36, 94]], ink, 'b', 1.2, 0);
    handPath(x, [[124, 62], [96, 78], [124, 94]], ink, 'b', 1.2, 1);
    const wave: Pt[] = Array.from({ length: 13 }, (_, i) => [44 + i * 6, 128 + Math.sin(i * 1.4) * 6]);
    handPath(x, wave, ink, 'b', 1.2, 2);
  } else {
    ex.forEach((cx, i) => { handPath(x, [[cx - 16, ey - 16], [cx + 16, ey + 16]], ink, 'b', 1.2, i); handPath(x, [[cx + 16, ey - 16], [cx - 16, ey + 16]], ink, 'b', 1.2, i + 2); });
    handPath(x, [[46, 130], [114, 128]], ink, 'b', 1.2, 3);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function plainPaper() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 96; const x = c.getContext('2d')!;
  paperBase(x, 96, 96, 733, TOKENS.tune);
  x.save(); x.strokeStyle = TOKENS.event; x.globalAlpha = .9; x.lineWidth = 8; x.strokeRect(6, 6, 85, 85); x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** 眼睛：骨白圓點＋骰子點色的瞳孔，面向鏡頭（+z）。squint 0–1 時壓扁成一條縫。 */
function eyes(parent: THREE.Object3D, s: ReturnType<typeof makeShared>, y: number, z: number, gap: number) {
  const list = [-1, 1].map(side => {
    const g = new THREE.Group(); g.position.set(side * gap, y, z);
    g.add(new THREE.Mesh(s.eye, s.bone)); const p = new THREE.Mesh(s.pupil, s.pip); p.position.set(side * -.002, -.002, .011); g.add(p);
    parent.add(g); return { g, p };
  });
  return (squint: number, out: boolean) => list.forEach(({ g, p }) => { g.scale.set(1, 1 - .78 * squint, 1); p.visible = !out; });
}

/** 紅漆木偶怪。受傷：以底座為軸左右搖晃；血少：縮起、往後仰；擊破：倒下靠在籠邊。 */
function pawnMonster(id: number, s: ReturnType<typeof makeShared>): Inside {
  const root = new THREE.Group(), pivot = new THREE.Group(), body = new THREE.Group(); root.add(pivot); pivot.add(body);
  const lacquer = s.lacquer.clone(); // 每隻自己一份，受傷時才能單獨變亮
  body.add(new THREE.Mesh(s.pawnBody, lacquer));
  const head = new THREE.Group(); head.position.y = .225; body.add(head);
  head.add(new THREE.Mesh(s.head, lacquer));
  for (const side of [-1, 1]) { const h = new THREE.Mesh(s.horn, s.rawWood); h.position.set(side * .034, .052, -.006); h.rotation.z = -side * .45; head.add(h); }
  const look = eyes(head, s, .008, .05, .023);
  const lean = (id % 2 ? 1 : -1) * .06; // 依編號寫死的站姿歪斜
  return { root, update({ now, reduced, hp, hitT, defT }) {
    const fear = cower(hp);
    let rockZ = 0, squint = fear * .35, out = false;
    if (hitT >= 0 && hitT < INSIDE_TIMING.hit) {
      if (reduced) { if (hitT < INSIDE_TIMING.flinch) { rockZ = .3; squint = 1; } }
      else { rockZ = .42 * Math.sin(hitT * 26) * Math.exp(-hitT * 5.5); if (hitT < INSIDE_TIMING.flinch) squint = 1; }
    }
    // 血少：整隻縮矮、頭往下垂、往後縮（離開最近的球）。
    body.scale.set(1 + .08 * fear, 1 - .3 * fear, 1 + .08 * fear); head.rotation.x = .35 * fear;
    pivot.rotation.set(-.18 * fear, 0, lean + rockZ); pivot.position.set(0, 0, 0);
    if (!reduced) body.position.y = .004 * Math.sin(now * 2.2 + id); else body.position.y = 0;
    if (defT >= 0) {
      const k = reduced ? 1 : clamp01(defT / .32), fall = easeIn(k) * .85, bounce = reduced || k < 1 ? 0 : .1 * Math.exp(-(defT - .32) * 9) * Math.abs(Math.sin((defT - .32) * 22));
      // 往右前方倒，靠在籠子的毛線上（約 49°），不穿出籠外；頭垂下、眼睛只剩一條縫。
      pivot.quaternion.setFromAxisAngle(FALL_AXIS, fall - bounce); body.scale.setScalar(1 - .1 * k); head.rotation.x = .5 * k; squint = 1; out = true;
    }
    look(squint, out);
  } };
}

/** 毛線團怪。受傷：被壓扁再彈起來；血少：越縮越小、鬆脫的線頭越拉越長；擊破：攤成地上扁扁的一團線。 */
function yarnMonster(id: number, s: ReturnType<typeof makeShared>): Inside {
  const root = new THREE.Group(), ball = new THREE.Group(); root.add(ball);
  // 材質每隻自己一份，受傷時才能單獨變亮。
  const strand = s.yarnStrand.clone(), core = new THREE.Mesh(s.ball, s.yarnBall.clone()); core.rotation.set(.4, id * .7, .2); ball.add(core);
  // 三圈繞在外面的線：傾角依圈序寫死。
  [[.3, 0], [1.2, .9], [-.7, 2.1]].forEach(([tx, ty]) => {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(.102, .011, 6, 40), strand); loop.rotation.set(tx, ty, 0); ball.add(loop);
  });
  const look = eyes(ball, s, .03, .093, .033);
  let tail: THREE.Mesh | null = null, tailKey = -1;
  /** 線頭：從球的左下拉到地面再往外彎；length 0–1。 */
  function setTail(length: number, scale: number) {
    const key = Math.round(length * 20) * 100 + Math.round(scale * 20); if (key === tailKey) return; tailKey = key;
    if (tail) { ball.parent!.remove(tail); tail.geometry.dispose(); }
    const r = .1 * scale, start = new THREE.Vector3(-r * .7, .1 * scale + r * -.2, r * .55), pts = [start];
    const n = 4 + Math.round(length * 10);
    for (let i = 1; i <= n; i++) { const a = i / n, ang = 2.4 + a * length * 4.2, rad = r * .9 + a * length * .2; pts.push(new THREE.Vector3(Math.cos(ang) * rad, Math.max(.008, start.y * (1 - a * 3)), Math.sin(ang) * rad * .8 + .02)); }
    tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 6, .009, 5, false), strand); root.add(tail);
  }
  return { root, update({ now, reduced, hp, hitT, defT }) {
    const fear = cower(hp);
    let size = 1 - .3 * fear, sy = 1, sxz = 1, hop = 0, squint = fear * .4, out = false, tailLen = .15 + .5 * fear;
    if (hitT >= 0 && hitT < INSIDE_TIMING.hit) {
      if (reduced) { if (hitT < INSIDE_TIMING.flinch) { sy = .7; sxz = 1.2; squint = 1; } }
      else {
        const t = hitT / .22, k = t < 1 ? Math.sin(Math.PI * t) * (1 - t * .4) : 0; sy = 1 - .38 * k; sxz = 1 + .26 * k;
        const h = (hitT - .12) / .3; if (h > 0 && h < 1) hop = .07 * Math.sin(Math.PI * h); if (hitT < INSIDE_TIMING.flinch) squint = 1;
      }
    }
    if (!reduced && hitT >= INSIDE_TIMING.hit && defT < 0) { const b = Math.sin(now * 2.6 + id) * .03; sy = 1 + b; sxz = 1 - b * .5; }
    if (defT >= 0) { const k = reduced ? 1 : clamp01(defT / .5); size = (1 - .3 * fear) * (1 - .45 * k); tailLen = 1; squint = 1; out = true; sy = 1 - .8 * k; sxz = 1 + 1.2 * k; core.rotation.y = id * .7 + (reduced ? 0 : k * 5); }
    ball.scale.set(size * sxz, size * sy, size * sxz); ball.position.y = .1 * size * sy + hop;
    setTail(tailLen, size);
    look(squint, out);
  } };
}

/** 紙摺怪：一張對摺立起來的紙卡，頂上兩隻摺出來的耳朵。受傷：耳朵亂拍、換成 > < 的臉；血少：耳朵垂下、整張塌低；擊破：塌成快攤平的一張，× 眼。 */
function paperMonster(id: number, s: ReturnType<typeof makeShared>): Inside {
  const root = new THREE.Group(), W = .21, H = .25;
  const front = new THREE.Group(), back = new THREE.Group(); root.add(front, back);
  const faceMat = s.paperFront.clone(); // 每隻自己的臉，才能各自換表情（貼圖共用）
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(W, H), faceMat); fm.position.y = H / 2; front.add(fm);
  const backMat = s.paperBack.clone(), bm = new THREE.Mesh(new THREE.PlaneGeometry(W, H), backMat); bm.position.y = H / 2; back.add(bm);
  const earShape = new THREE.Shape([new THREE.Vector2(-.035, 0), new THREE.Vector2(.035, 0), new THREE.Vector2(.004, .075)]);
  const earGeo = new THREE.ShapeGeometry(earShape);
  const ears = [-1, 1].map(side => { const p = new THREE.Group(); p.position.set(side * .065, H, 0); const e = new THREE.Mesh(earGeo, backMat); p.add(e); fm.parent!.add(p); return { p, side }; });
  const skew = (id % 2 ? 1 : -1) * .07; root.rotation.y = skew;
  let mood: 'calm' | 'hurt' | 'out' = 'calm';
  const setMood = (m: typeof mood) => { if (m === mood) return; mood = m; faceMat.map = faceMat.emissiveMap = s.faces[m]; faceMat.needsUpdate = true; };
  return { root, update({ now, reduced, hp, hitT, defT }) {
    const fear = cower(hp);
    let open = .3 + .28 * fear, earDrop = .25 + 1.05 * fear, flap = 0, shake = 0, m: typeof mood = 'calm';
    if (hitT >= 0 && hitT < INSIDE_TIMING.hit) {
      if (reduced) { if (hitT < INSIDE_TIMING.flinch) { m = 'hurt'; earDrop = 1.4; } }
      else { flap = .7 * Math.sin(hitT * 38) * Math.exp(-hitT * 6); shake = .02 * Math.sin(hitT * 50) * Math.exp(-hitT * 8); if (hitT < INSIDE_TIMING.flinch) m = 'hurt'; }
    }
    if (!reduced && defT < 0) flap += .08 * Math.sin(now * 3 + id);
    let shrink = 1;
    if (defT >= 0) { const k = reduced ? 1 : easeIn(clamp01(defT / .35)); open = .3 + .95 * k; earDrop = 1.5; m = 'out'; shrink = 1 - .15 * k; }
    root.scale.setScalar(shrink);
    // 對摺的兩片：底邊踩在地上，頂邊在中間相碰；open 越大塌得越低。
    const d = 2 * Math.sin(open) * H;
    front.position.set(shake, 0, d / 2); front.rotation.x = -open;
    back.position.set(shake, 0, -d / 2); back.rotation.x = open;
    ears.forEach(({ p, side }) => { p.rotation.set(0, 0, side * -(earDrop + flap * side)); });
    setMood(m);
  } };
}

export function buildInside(variant: ArtVariant, id: number): Inside {
  const s = shared ??= makeShared();
  const inside = variant === 'a' ? pawnMonster(id, s) : variant === 'b' ? yarnMonster(id, s) : paperMonster(id, s);
  inside.root.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  // 放大 1.25 倍：整桌鏡頭下籠子只有十幾 px，角色要夠大才看得出顏色和輪廓；仍在四根木樁之內。
  const holder = new THREE.Group(); holder.add(inside.root); holder.scale.setScalar(INSIDE_SCALE);
  // 受傷的那一下要在整桌鏡頭（籠子十幾 px）也看得到：角色瞬間放大 20% 再回彈，自身顏色亮一下。
  // 減少動態時不放大，只在縮起的那 0.35 秒換成較亮的顏色（靜態換色）。
  const glow = new Map<THREE.MeshStandardMaterial, number>();
  inside.root.traverse(o => { if (o instanceof THREE.Mesh) { const m = o.material as THREE.MeshStandardMaterial; if (m !== s.bone && m !== s.pip && !glow.has(m)) glow.set(m, m.emissiveIntensity); } });
  return { root: holder, update(st) {
    inside.update(st);
    const t = st.hitT, live = t >= 0 && st.defT < 0;
    const pop = !st.reduced && live ? (t < .06 ? t / .06 : Math.max(0, 1 - (t - .06) / .24)) : 0;
    const flash = !live ? 0 : st.reduced ? (t < INSIDE_TIMING.flinch ? .7 : 0) : Math.max(0, 1 - t / .3);
    holder.scale.setScalar(INSIDE_SCALE * (1 + .2 * pop));
    for (const [m, base] of glow) m.emissiveIntensity = base + .5 * flash;
  } };
}
