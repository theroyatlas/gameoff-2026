import * as THREE from 'three';
import { TOKENS } from './style1';

/**
 * 毛線共振線：每條線是一段二次貝茲曲線，切成 10 小段鋪成柔軟的弧。
 * 兩層：芯線（斜捻紋理、不透明）與毛邊（半透明細毛、加亮混合），一起看起來是有毛的線。
 */
const SEGMENTS = 10;
function lcg(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

/** 斜捻芯線：兩股交錯加上細毛，沿線重複。 */
function coreTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d')!;
  x.fillStyle = '#8fdcc6'; x.fillRect(0, 0, 64, 256);
  for (let i = -8; i < 40; i++) { x.strokeStyle = i % 2 ? 'rgba(255,255,255,.42)' : 'rgba(30,80,70,.34)'; x.lineWidth = 6; x.beginPath(); x.moveTo(0, i * 8); x.bezierCurveTo(20, i * 8 + 6, 44, i * 8 + 18, 64, i * 8 + 26); x.stroke(); }
  const r = lcg(41); for (let i = 0; i < 160; i++) { x.strokeStyle = r() < .5 ? 'rgba(230,255,248,.4)' : 'rgba(40,100,90,.25)'; x.lineWidth = .8; const yy = r() * 256, xx = r() * 64; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + (r() - .5) * 12, yy + (r() - .5) * 12); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); return t;
}
/** 毛邊：中心淡、向外的細毛，四周透明，貼在比芯粗 2.6 倍的外殼上。 */
function fuzzTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d')!; const r = lcg(77);
  x.clearRect(0, 0, 64, 256);
  for (let i = 0; i < 700; i++) {
    const yy = r() * 256, xx = r() * 64, l = 3 + r() * 9, a = (r() - .5) * 2.2;
    x.strokeStyle = `rgba(${r() < .5 ? '200,250,236' : '90,150,135'},${.35 + r() * .45})`; x.lineWidth = .8; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + Math.sin(a) * l, yy + Math.cos(a) * l); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); return t;
}

export interface YarnLink { ax: number; az: number; bx: number; bz: number; side: number; glow: number }

export function createYarn(scene: THREE.Scene, maxLinks = 160, radius = .024) {
  const max = maxLinks * SEGMENTS, coreMap = coreTexture(), fuzzMap = fuzzTexture();
  const coreMat = new THREE.MeshStandardMaterial({ map: coreMap, emissiveMap: coreMap, emissive: TOKENS.yarn, emissiveIntensity: .2, roughness: .95, metalness: 0 });
  // 毛邊用一般混合、比芯線深一點的青色：亮紙上加亮混合會看不見毛。
  const fuzzMat = new THREE.MeshBasicMaterial({ map: fuzzMap, color: 0x5fae9a, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide });
  const coreGeo = new THREE.CylinderGeometry(radius, radius, 1, 7, 1, true), fuzzGeo = new THREE.CylinderGeometry(radius * 2.8, radius * 2.8, 1, 7, 1, true);
  const core = new THREE.InstancedMesh(coreGeo, coreMat, max), fuzz = new THREE.InstancedMesh(fuzzGeo, fuzzMat, max);
  const glow = new Float32Array(max);
  core.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
  fuzz.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
  for (const m of [core, fuzz]) { m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = m === core; scene.add(m); }
  const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), scale = new THREE.Vector3(), pos = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
  const pts: THREE.Vector3[] = Array.from({ length: SEGMENTS + 1 }, () => new THREE.Vector3());
  const dim = new THREE.Color(.62, .7, .68), bright = new THREE.Color(1, 1, 1), tmp = new THREE.Color(), halo = new THREE.Color();

  /** 線頭接在球腳（高 0.07），中段貼紙面（0.03）；中點往一側彎 14% 線長。 */
  function set(links: readonly YarnLink[]) {
    let n = 0;
    for (const link of links) {
      if (n + SEGMENTS > max) break;
      const dx = link.bx - link.ax, dz = link.bz - link.az, len = Math.hypot(dx, dz); if (len < .05) continue;
      const bend = .14 * link.side;
      curve.v0.set(link.ax, .07, link.az); curve.v2.set(link.bx, .07, link.bz);
      curve.v1.set((link.ax + link.bx) / 2 - dz * bend, .0, (link.az + link.bz) / 2 + dx * bend);
      for (let i = 0; i <= SEGMENTS; i++) curve.getPoint(i / SEGMENTS, pts[i]);
      const g = Math.max(0, Math.min(1, link.glow)); tmp.copy(dim).lerp(bright, g); halo.setScalar(.75 + .45 * g);
      for (let i = 0; i < SEGMENTS; i++) {
        const p = pts[i], q = pts[i + 1], l = p.distanceTo(q);
        dir.subVectors(q, p).normalize(); pos.addVectors(p, q).multiplyScalar(.5); quat.setFromUnitVectors(up, dir); scale.set(1, l + .012, 1);
        matrix.compose(pos, quat, scale); core.setMatrixAt(n, matrix); fuzz.setMatrixAt(n, matrix);
        core.setColorAt(n, tmp); fuzz.setColorAt(n, halo); glow[n] = link.glow; n++;
      }
    }
    core.count = fuzz.count = n;
    if (n) { core.instanceMatrix.needsUpdate = fuzz.instanceMatrix.needsUpdate = true; core.instanceColor!.needsUpdate = fuzz.instanceColor!.needsUpdate = true; }
    core.visible = fuzz.visible = n > 0;
    return n;
  }
  /** 紋理沿線慢慢流動；減少動態時固定。 */
  function animate(seconds: number, reduced: boolean, intensity = 1) {
    coreMap.offset.y = reduced ? 0 : -seconds * .35; fuzzMap.offset.y = reduced ? 0 : -seconds * .2;
    coreMat.emissiveIntensity = (reduced ? .3 : .24 + .08 * Math.sin(seconds * Math.PI)) * intensity;
    fuzzMat.opacity = .8;
  }
  return { set, animate, core, fuzz };
}

/** 04-chain 的光點：從爆發的球沿線跑到被點燃的球。固定 24 顆循環使用。 */
export function createPulses(scene: THREE.Scene, count = 24) {
  const geo = new THREE.SphereGeometry(.05, 10, 8), mat = new THREE.MeshBasicMaterial({ color: TOKENS.yarnGlow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.MeshBasicMaterial({ color: TOKENS.yarn, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false });
  const items = Array.from({ length: count }, () => { const m = new THREE.Mesh(geo, mat); const h = new THREE.Mesh(geo, halo); h.scale.setScalar(2.6); m.add(h); m.visible = false; scene.add(m); return { mesh: m, from: new THREE.Vector3(), to: new THREE.Vector3(), side: 1, start: 0, duration: .25 }; });
  let next = 0;
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
  function emit(ax: number, az: number, bx: number, bz: number, side: number, now: number, duration = .25) {
    const item = items[next++ % count]; item.from.set(ax, .1, az); item.to.set(bx, .1, bz); item.side = side; item.start = now; item.duration = duration; item.mesh.visible = true;
  }
  function update(now: number, reduced: boolean) {
    for (const item of items) {
      if (!item.mesh.visible) continue;
      const t = (now - item.start) / item.duration;
      if (t >= 1.25) { item.mesh.visible = false; continue; }
      const dx = item.to.x - item.from.x, dz = item.to.z - item.from.z, bend = .14 * item.side;
      curve.v0.copy(item.from); curve.v2.copy(item.to); curve.v1.set((item.from.x + item.to.x) / 2 - dz * bend, .02, (item.from.z + item.to.z) / 2 + dx * bend);
      curve.getPoint(reduced ? 1 : Math.min(1, t), item.mesh.position);
      item.mesh.scale.setScalar(reduced ? 1 : t < 1 ? 1 : 1 + (t - 1) * 6);
    }
  }
  return { emit, update };
}
