import * as THREE from 'three';
import { TOKENS, paperBase, handPath, paperBumpTexture, walnutTexture } from './style1';
import type { ArtVariant } from './art-round2';
import { buildInside, type Inside } from './cage-inside';
import { INSIDE_TIMING } from './inside';

/**
 * 怪物籠三版。籠子的材料都取自參考圖裡桌上已有的東西，讓怪物一眼和球（玻璃／鋼／黃銅實心球）、
 * 核心（玻璃罩＋青光）分開：籠子比球高一倍、有底座、裡面關著一顆暖白的小光球（style-1.png 籠內的白球）。
 * a：鐵絲籠（style-1.png 場上的線框二十面體／金字塔／方塊）：深色鐵絲、黃銅焊點、胡桃木底座。
 * b：毛線纏繞的木樁籠（01／04 的毛線＋style-1.png 核心旁的木樁）：四根胡桃木樁，赭色粗毛線一圈圈繞上去。
 * c：紙卡摺成的燈籠籠（02 的紙卡、套印邊框、手抖墨線）：五片紙卡圍成一圈，墨線畫柵欄、柵欄間鏤空。
 */
const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;
/** 截圖用：把籠內反應停在某一刻（血量比例、受傷後幾秒、擊破後幾秒）。只改呈現。 */
export interface CagePose { hp: number; hitAgo?: number; defeatAgo?: number }
export interface Cage {
  group: THREE.Group; inner: THREE.Mesh; inside: Inside | null;
  jolt(now: number): void; update(now: number, reduced: boolean, hp?: number): void;
  /** 怪物被擊破（規則已移除）：籠內播倒下的動作，gone() 為真時再收走。 */
  defeat(now: number): void; gone(now: number): boolean; pose(p: CagePose | null): void;
}

let shared: ReturnType<typeof makeShared> | undefined;
function makeShared() {
  const walnut = new THREE.MeshStandardMaterial({ map: walnutTexture(256, false, false, 619), roughness: .6 });
  const inner = new THREE.MeshStandardMaterial({ color: TOKENS.bone, emissive: TOKENS.ochre, emissiveIntensity: .9, roughness: .5 });
  const iron = new THREE.MeshStandardMaterial({ color: TOKENS.ink, metalness: .6, roughness: .45 });
  const brass = new THREE.MeshStandardMaterial({ color: TOKENS.brassEdge, metalness: .8, roughness: .4 });
  const wool = new THREE.MeshStandardMaterial({ map: woolTexture(), color: 0xffffff, roughness: 1 });
  const paper = paperCageTextures();
  // 紙片帶一點紙色自發光（像燈籠透光），不然五片互相遮影後整個發黑。
  const paperMat = new THREE.MeshStandardMaterial({ map: paper.map, alphaMap: paper.alpha, alphaTest: .5, side: THREE.DoubleSide, roughness: .92, bumpMap: paperBumpTexture(), bumpScale: 1.2, emissive: TOKENS.paper, emissiveIntensity: .14 });
  const board = new THREE.MeshStandardMaterial({ color: TOKENS.paperEdge, roughness: .95 });
  return { walnut, inner, iron, brass, wool, paperMat, board, innerGeo: new THREE.SphereGeometry(.075, 20, 14) };
}
/** 赭色毛線：斜捻紋理加細毛（同共振毛線的做法，但用赭色，不跟共振的青色混）。 */
function woolTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d')!;
  x.fillStyle = css(TOKENS.ochre); x.fillRect(0, 0, 64, 256);
  for (let i = -8; i < 40; i++) { x.strokeStyle = i % 2 ? 'rgba(232,220,194,.35)' : 'rgba(58,36,22,.35)'; x.lineWidth = 5; x.beginPath(); x.moveTo(0, i * 8); x.lineTo(64, i * 8 + 26); x.stroke(); }
  let s = 77; const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 140; i++) { x.strokeStyle = 'rgba(232,220,194,.4)'; x.lineWidth = .8; const yy = r() * 256, xx = r() * 64; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + (r() - .5) * 10, yy + (r() - .5) * 10); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 10); return t;
}
/** 紙卡燈籠的一片：紙面＋SURGE 紅橙套印邊框＋三根手抖墨線柵欄；柵欄之間挖空（alphaMap）。 */
function paperCageTextures() {
  const w = 128, h = 224, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!;
  paperBase(x, w, h, 451);
  x.save(); x.strokeStyle = TOKENS.surge; x.globalAlpha = .92; x.lineWidth = 14; x.strokeRect(9, 9, w - 14, h - 14); x.restore();
  const bars = [w * .3, w * .5, w * .7];
  bars.forEach((bx, i) => handPath(x, [[bx, 22], [bx + (i - 1) * 1.5, h - 22]], css(TOKENS.ink), 'b', .8, i));
  const a = document.createElement('canvas'); a.width = w; a.height = h; const y = a.getContext('2d')!;
  y.fillStyle = '#fff'; y.fillRect(0, 0, w, h); y.fillStyle = '#000';
  // 只在柵欄之間割出窄縫：紙面仍佔大半，遠看是一盞紙燈籠，近看看得到裡面的光球。
  for (const cx of [w * .2, w * .4, w * .6, w * .8]) y.fillRect(cx - 8, 40, 16, h - 80);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const alpha = new THREE.CanvasTexture(a); alpha.generateMipmaps = false; alpha.minFilter = THREE.LinearFilter;
  return { map, alpha };
}
function rod(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) {
  const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 6), material);
  m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return m;
}

export function buildCage(variant: ArtVariant, id: number, insideVariant: ArtVariant | null = null): Cage {
  const s = shared ??= makeShared(), group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const inner = new THREE.Mesh(s.innerGeo, s.inner); inner.position.y = .2; inner.castShadow = false; body.add(inner);
  // 籠內換成角色時，角色站在底座上、不跟著籠子轉，臉一直朝鏡頭（+z）。
  const inside = insideVariant ? buildInside(insideVariant, id) : null;
  if (inside) { inner.visible = false; inside.root.position.y = variant === 'c' ? .02 : .05; group.add(inside.root); }
  if (variant === 'a') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.22, .24, .05, 24), s.walnut); base.position.y = .025; group.add(base);
    // 三種線框輪流：二十面體、雙角錐、方塊（取自 style-1.png 場上的線框籠；四角錐改成上下對稱的雙角錐，避免輪廓像棋子）。
    const shape = id % 3, geo = shape === 0 ? new THREE.IcosahedronGeometry(.2, 0) : shape === 1 ? new THREE.OctahedronGeometry(.2, 0) : new THREE.BoxGeometry(.3, .3, .3);
    const edges = new THREE.EdgesGeometry(geo), p = edges.attributes.position as THREE.BufferAttribute, lift = shape === 0 ? .25 : shape === 1 ? .26 : .2, joints = new Map<string, THREE.Vector3>();
    for (let i = 0; i < p.count; i += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1); a.y += lift; b.y += lift;
      body.add(rod(a, b, .014, s.iron)); for (const v of [a, b]) joints.set(v.toArray().map(n => n.toFixed(3)).join(), v);
    }
    for (const v of joints.values()) { const j = new THREE.Mesh(new THREE.SphereGeometry(.024, 8, 6), s.brass); j.position.copy(v); body.add(j); }
    geo.dispose(); edges.dispose(); inner.position.y = lift;
  } else if (variant === 'b') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(.38, .05, .38), s.walnut); base.position.y = .025; base.rotation.y = .1; group.add(base);
    const posts = [[-.15, -.15], [.15, -.15], [.15, .15], [-.15, .15]].map(([px, pz]) => new THREE.Vector3(px, 0, pz));
    for (const p of posts) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.018, .02, .44, 8), s.walnut); post.position.set(p.x, .25, p.z); body.add(post); }
    // 毛線一圈一圈往上繞，每圈的高度和鬆緊依圈序寫死（像手繞的，不用亂數）。
    const loops = [.08, .13, .19, .3, .36, .41];
    loops.forEach((yy, i) => {
      const pts = Array.from({ length: 33 }, (_, j) => { const a = j / 32 * Math.PI * 2 + i * .4, sq = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))) ** .85; const rr = (.165 + .008 * Math.sin(i * 1.7)) * sq; return new THREE.Vector3(Math.cos(a) * rr, yy + .012 * Math.sin(a * 2 + i), Math.sin(a) * rr); });
      body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 48, .017, 6, true), s.wool));
    });
    // 收尾的線結。
    const knot = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), s.wool); knot.position.set(.17, .42, .1); knot.scale.set(1, .8, 1.2); body.add(knot);
    inner.position.y = .24;
  } else {
    const base = new THREE.Mesh(new THREE.BoxGeometry(.4, .02, .4), s.board); base.position.y = .01; base.rotation.y = -.12; group.add(base);
    // 五片紙卡圍成五角燈籠；每片往內外歪 ±4°，正負交替（DESIGN.md 第 4 節的歪斜規則）。
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2, panel = new THREE.Mesh(new THREE.PlaneGeometry(.2, .36), s.paperMat);
      panel.position.set(Math.cos(a) * .15, .19, Math.sin(a) * .15); panel.rotation.order = 'YXZ'; panel.rotation.y = -a + Math.PI / 2; panel.rotation.x = (i % 2 ? 1 : -1) * 4 * Math.PI / 180; body.add(panel);
    }
    inner.position.y = .17;
  }
  group.scale.setScalar(1.3);
  group.traverse(o => { if (o instanceof THREE.Mesh && o !== inner && !inside?.root.getObjectById(o.id)) { o.castShadow = true; o.receiveShadow = !(variant === 'c' && o.material === s.paperMat); } });
  let joltAt = -99, defeatAt = -1, override: CagePose | null = null;
  return { group, inner, inside,
    jolt(now) { joltAt = now; },
    defeat(now) { if (defeatAt < 0) defeatAt = now; },
    gone(now) { return defeatAt >= 0 && now - defeatAt >= INSIDE_TIMING.defeat; },
    pose(p) { override = p; },
    update(now, reduced, hp = 1) {
      if (override) { hp = override.hp; joltAt = override.hitAgo !== undefined ? now - override.hitAgo : -99; defeatAt = override.defeatAgo !== undefined ? now - override.defeatAgo : -1; }
      if (!reduced) body.rotation.y = now * .4 + id;
      // 被打到：籠子往上一縮再彈回，0.18 秒；減少動態時不動。
      const t = (now - joltAt) / .18, k = !reduced && t >= 0 && t < 1 ? Math.sin(Math.PI * t) * (1 - t) : 0;
      body.scale.set(1 + .18 * k, 1 - .14 * k, 1 + .18 * k); (inner.material as THREE.MeshStandardMaterial).emissiveIntensity = .9;
      if (inside) {
        const defT = defeatAt >= 0 ? now - defeatAt : -1;
        inside.update({ now, reduced, hp: defT >= 0 ? 0 : hp, hitT: now - joltAt, defT });
        // 擊破後最後 0.2 秒籠子縮小收走；減少動態時直接在時間到時移除。
        const end = defT >= 0 && !reduced ? Math.min(1, Math.max(0, (defT - (INSIDE_TIMING.defeat - .2)) / .2)) : 0;
        group.scale.setScalar(1.3 * (1 - end));
      }
    } };
}
