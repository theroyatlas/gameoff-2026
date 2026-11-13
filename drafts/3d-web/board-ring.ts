import { t, materialName, cardText } from './i18n';
import { language, mountLanguageButton } from './language';
import * as THREE from 'three';
import { Game, type Ball } from '../../src/game';
import { CONFIG as C } from '../../src/config';
import type { BoardPhase } from '../../src/board';
import './board-ring.css';
import { readChoice, TOKENS, LIGHTS, walnutTexture, drawField, numberedBallMaterial, buildRing, paperBumpTexture } from './style1';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BoardAudio } from './board-audio';
import { createYarn, createPulses, type YarnLink } from './yarn';
import { classifyImpact, impactStrength, COMBO_WINDOW_SECONDS, tallyStep, landingZoom, punchScale } from './juice';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { readArt } from './art-round2';
import { applyUiSkin } from './ui-skins';
import { buildCage, type Cage, type CagePose } from './cage';
import { readInside } from './inside';
import { createEventReveal, faceSheet } from './event-card-art';
import { EVENT_CARDS } from '../../src/event-cards';
import { closeupView, aimFan } from './closeup';

const phaseNames = (): Record<BoardPhase, string> => ({
  roll: t('phaseRoll'), rolling: t('phaseRolling'), moving: t('phaseMoving'), effect: t('phaseEffect'), shooting: t('phaseShooting'), settling: t('phaseSettling'),
});
const colors = { background: TOKENS.bgIdle, edge: TOKENS.brass,
  landed: TOKENS.ochre, pawn: TOKENS.lacquer, boss: TOKENS.brass, monster: TOKENS.brass,
  resonance: TOKENS.yarn };

export function startBoard() {
  document.body.classList.add('board-mode');
  document.title = t('title');
  const root = document.querySelector('main')!;
  root.className = 'board-app';
  root.innerHTML = `
    <header class="board-header"><div><h1 data-i18n="title">${t('title')}</h1><p data-i18n="subtitle">${t('subtitle')}</p></div><a id="board-realtime" data-i18n="realtime">${t('realtime')}</a></header>
    <div class="board-topline"><label class="board-boss">Boss <progress id="board-hp" max="12000" value="12000"></progress><span id="board-hp-value"></span></label><span id="board-monsters"></span></div>
    <form id="board-setup"><label><span data-i18n="seed">${t('seed')}</span> <input id="board-seed" type="number" min="0" max="4294967295" step="1" required value="${C.seed}"></label><button id="board-start" type="submit" data-i18n="start">${t('start')}</button></form>
    <div class="board-readout"><strong id="board-phase" role="status"></strong><span id="board-turn"></span><span id="board-shots"></span><strong id="board-clock"></strong></div>
    <p id="board-banner" role="status">${t('bannerReady')}</p>
    <div class="board-layout">
      <section id="board-stage" data-i18n-aria="stageAria" aria-label="${t('stageAria')}"><canvas id="board-scene" tabindex="0" data-i18n-aria="sceneAria" aria-label="${t('sceneAria')}"></canvas><div id="board-labels" aria-hidden="true"></div><p id="board-failure" role="alert" hidden data-i18n="failure">${t('failure')}</p></section>
      <aside class="board-controls" data-i18n-aria="controlsAria" aria-label="${t('controlsAria')}">
        <div class="board-die-line"><strong id="board-die">${t('die', { v0: '—' })}</strong><span id="board-position">00 START</span></div>
        <button id="board-roll" disabled data-i18n="roll">${t('roll')}</button>
        <label class="board-angle"><span data-i18n="aim">${t('aim')}</span> <output id="board-angle-value">−90°</output><input id="board-angle" type="range" min="-165" max="-15" step="1" value="-90" data-i18n-aria="angleAria" aria-label="${t('angleAria')}" disabled></label>
        <button id="board-fire" disabled data-i18n="fire">${t('fire')}</button>
        <div class="board-details" tabindex="0" role="region" data-i18n-aria="detailsAria" aria-label="${t('detailsAria')}"><p class="scroll-hint" data-i18n="scrollHint">${t('scrollHint')}</p><p id="board-next"></p><p id="board-wave"></p><p id="board-bonus"></p>
        <p id="board-card" role="status" hidden></p>
        <p id="board-inspect" role="status">${t('inspectHint')}</p>
        </div><button id="board-inspect-toggle" aria-pressed="false">${t('inspect')}</button>
        <div class="board-utilities"><button id="board-mute" aria-pressed="false">${t('soundOn')}</button><button id="board-restart" data-i18n="restart">${t('restart')}</button></div>
      </aside>
    </div>
    <p id="board-result" role="status" hidden></p><p id="board-chain-live" class="sr-only" aria-live="polite"></p>
    <footer class="board-help"><p data-i18n="helpFlow">${t('helpFlow')}</p><p data-i18n="helpControls">${t('helpControls')}</p></footer>`;
  root.querySelector('.board-details')!.append(root.querySelector('.board-help')!);
  mountLanguageButton(root.querySelector('.board-header')!);
  function refreshStaticLanguage() {
    document.title = t('title');
    root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n as Parameters<typeof t>[0]); });
    root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria as Parameters<typeof t>[0])); });
  }
  language.subscribe(refreshStaticLanguage);
  const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
  const realtimeURL = new URL(location.href); realtimeURL.searchParams.set('mode', 'realtime');
  get<HTMLAnchorElement>('board-realtime').href = realtimeURL.href;
  const choice = readChoice(location.search);
  // 介面、怪物籠與事件卡使用選定預設，可由 ?ui=、?cage=、?card= 覆蓋。
  const art = readArt(location.search);
  // 籠子裡關的東西：預設 c 紙摺怪，可用 ?inside=a（紅漆木偶怪）、?inside=b（毛線團怪）覆蓋。
  const inside = readInside(location.search);
  if (art.ui) applyUiSkin(art.ui);
  const canvas = get<HTMLCanvasElement>('board-scene'), stage = get('board-stage'), labels = get('board-labels');
  const roll = get<HTMLButtonElement>('board-roll'), fire = get<HTMLButtonElement>('board-fire');
  const aim = get<HTMLInputElement>('board-angle'), seed = get<HTMLInputElement>('board-seed');
  const game = new Game(C.seed, 'board');
  const params = new URLSearchParams(location.search);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.get('motion') === 'reduce';
  const audio = new BoardAudio(choice.ball === 'a' ? 'wood' : 'shiny'), sound = audio;
  audio.cageStyle = art.cage;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
  catch { get('board-failure').hidden = false; language.subscribe(() => { get('board-banner').textContent = t('failure'); }); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(colors.background);
  // 參考圖 C1 的斜上方俯視：看得到桌子厚度。寬畫面仰角 45°，窄畫面 58°。
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, .1, 120);
  const camTarget = new THREE.Vector3(0, -.35, .5), camBase = new THREE.Vector3(), lookNow = new THREE.Vector3();
  let elevation = 45 * Math.PI / 180; // resize 的 fit 會依寬高比重新設定。
  let shot = params.get('cam'), cageFocus: THREE.Vector3 | null = null;
  const aimHint = document.createElement('p'); aimHint.id = 'board-closeup-aim'; aimHint.hidden = true;
  aimHint.setAttribute('aria-live', 'polite'); stage.append(aimHint);
  let inspectMode = false, inspectedId: number | null = null, legacyDensity = false;
  let visibleTagCount = 0, visibleLinkCount = 0;
  const L = LIGHTS[choice.light];
  // 棋盤模式的補光只用一半，讓暖色聚光在中央形成光池、外圈退進暗處（C1、B1）。
  scene.add(new THREE.HemisphereLight(0xffe5b7, 0x2a1a10, L.ambient * .5));
  // LIGHTS 的強度是以 1 單位距離表示；燈離桌面約 10 單位，衰減 2，所以乘 SPOT_GAIN 換回桌面上的亮度，否則聚光被補光蓋過、看不出光池。
  const SPOT_GAIN = 9;
  const light = new THREE.SpotLight(L.color, L.intensity * SPOT_GAIN, 34, L.angle, L.penumbra, 2);
  light.position.set(...L.position); light.target.position.set(0, -.3, .3); light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048); light.shadow.bias = -.0004; light.shadow.normalBias = .02; light.shadow.radius = 4;
  scene.add(light, light.target);
  const rim = new THREE.DirectionalLight(0xc8d8d4, .3); rim.position.set(4, 6, -5); scene.add(rim);
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, .04).texture; scene.environmentIntensity = .1; room.dispose(); pmrem.dispose();
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .32, .5, .86); composer.addPass(bloom); composer.addPass(new OutputPass());
  const mat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .55 });
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z); object.castShadow = object.receiveShadow = true; scene.add(object); return object;
  }
  // 木頭：桌面、台座、邊框都有年輪與對應的凹凸；框條順著長邊走紋。
  const grain = walnutTexture(1024), grainBump = walnutTexture(512, false, true);
  const wood = new THREE.MeshStandardMaterial({ map: grain, bumpMap: grainBump, bumpScale: 1.2, roughness: .6 });
  const railMap = walnutTexture(512, true, false, 233), railBump = walnutTexture(512, true, true, 233);
  railMap.repeat.set(1, .25); railBump.repeat.set(1, .25);
  const rail = new THREE.MeshPhysicalMaterial({ map: railMap, bumpMap: railBump, bumpScale: 1.4, color: 0xb08868, roughness: .42, clearcoat: .4, clearcoatRoughness: .5 });
  const deskMap = walnutTexture(1024, false, false, 977), deskBump = walnutTexture(512, false, true, 977);
  deskMap.repeat.set(3, 3); deskBump.repeat.set(3, 3);
  const desk = mesh(new THREE.PlaneGeometry(48, 48), new THREE.MeshStandardMaterial({ map: deskMap, bumpMap: deskBump, bumpScale: 1.6, color: 0xa0704c, roughness: .65 }), 0, -.83, 0);
  desk.rotation.x = -Math.PI / 2; desk.castShadow = false;
  mesh(new THREE.BoxGeometry(15, .35, 13), wood, 0, -.65);
  const fieldCanvas = document.createElement('canvas'); fieldCanvas.width = 1024; fieldCanvas.height = 870;
  drawField(fieldCanvas, choice.icon, (C.launcher.y - 340) * .01);
  const fieldMap = new THREE.CanvasTexture(fieldCanvas); fieldMap.colorSpace = THREE.SRGBColorSpace; fieldMap.anisotropy = 8;
  const fieldBump = paperBumpTexture().clone(); fieldBump.repeat.set(2.4, 2); fieldBump.needsUpdate = true;
  mesh(new THREE.BoxGeometry(8, .18, 6.8), new THREE.MeshStandardMaterial({ map: fieldMap, color: 0xd6c6a2, bumpMap: fieldBump, bumpScale: 1.4, roughness: .92 }), 0, -.12);
  // 邊框：四條上油的邊條（紋路沿長邊）＋四角的方木塊，照 C1 的角塊。
  for (const z of [-3.49, 3.49]) mesh(new THREE.BoxGeometry(8.36, .3, .22), rail, 0, .02, z);
  for (const x of [-4.09, 4.09]) { const side = mesh(new THREE.BoxGeometry(7.2, .3, .22), rail, x, .02, 0); side.rotation.y = Math.PI / 2; }
  const cornerMat = new THREE.MeshStandardMaterial({ map: grain, bumpMap: grainBump, bumpScale: 2, color: 0x9a7a5c, roughness: .58 });
  for (const x of [-4.09, 4.09]) for (const z of [-3.49, 3.49]) { const block = mesh(new THREE.BoxGeometry(.36, .38, .36), cornerMat, x, .06, z); block.rotation.y = (x * z > 0 ? 1 : -1) * .06; }
  const outer = buildRing(wood, choice.icon, C.board.tiles); scene.add(outer.group);
  const positions = outer.cards.map(card => [card.mesh.position.x, card.mesh.position.z]);
  const tiles = outer.cards.map((card, i) => {
    const tile = C.board.tiles[i];
    const label = document.createElement('div'); label.className = 'board-tile-label';
    // 卡面已印格號與類型；標籤只補卡上沒有的資訊（TUNE 的材質）。
    label.dataset.index = String(i);
    label.textContent = tile.kind === 'TUNE' ? materialName(tile.material) : '';
    label.hidden = tile.kind !== 'TUNE';
    labels.append(label); return { ...card, label };
  });
  const pawn = outer.pawn, dice = outer.die;
  const dieRest = new THREE.Vector3(3.42, -.265, 5.52); dice.position.copy(dieRest);
  // 核心：胡桃木底座、黃銅細邊、玻璃罩與發光芯（C1）。
  mesh(new THREE.CylinderGeometry(.66, .7, .16, 40), wood, 0, .06);
  mesh(new THREE.TorusGeometry(.67, .018, 8, 48), new THREE.MeshStandardMaterial({ color: TOKENS.brassEdge, metalness: .8, roughness: .4 }), 0, .14).rotation.x = Math.PI / 2;
  const boss = mesh(new THREE.SphereGeometry(C.boss.radius * .01, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: TOKENS.glass, transmission: .9, thickness: .18, roughness: .06, clearcoat: 1, transparent: true, opacity: .9 }), 0, .14);
  boss.castShadow = false;
  const knob = mesh(new THREE.SphereGeometry(.06, 16, 12), new THREE.MeshPhysicalMaterial({ color: TOKENS.glass, transmission: .8, roughness: .05 }), 0, .64);
  const core = mesh(new THREE.SphereGeometry(.13, 20, 16), new THREE.MeshStandardMaterial({ color: TOKENS.yarnGlow, emissive: TOKENS.yarn, emissiveIntensity: 2.2 }), 0, .32);
  core.castShadow = false;
  const coreLight = new THREE.PointLight(TOKENS.yarn, .3, 4, 2); coreLight.position.set(0, .4, 0); scene.add(coreLight);
  const launcher = mesh(new THREE.CylinderGeometry(.26, .28, .14, 28), wood, 0, .04, (C.launcher.y - 340) * .01);
  mesh(new THREE.TorusGeometry(.27, .014, 6, 32), new THREE.MeshStandardMaterial({ color: TOKENS.brassEdge, metalness: .8, roughness: .4 }), 0, .11, (C.launcher.y - 340) * .01).rotation.x = Math.PI / 2;
  const aimLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: TOKENS.ochre })); scene.add(aimLine);
  const fanGeometry = new THREE.BufferGeometry();
  fanGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Array(9).fill(0), 3));
  const fan = new THREE.Mesh(fanGeometry, new THREE.MeshBasicMaterial({ color: TOKENS.ochre,
    side: THREE.DoubleSide, transparent: true, opacity: .16, depthWrite: false,
    clippingPlanes: [new THREE.Plane(new THREE.Vector3(1, 0, 0), 4), new THREE.Plane(new THREE.Vector3(-1, 0, 0), 4),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), 3.4), new THREE.Plane(new THREE.Vector3(0, 0, -1), 3.4)] }));
  fan.visible = false; scene.add(fan); renderer.localClippingEnabled = true;
  const ballGeometry = new THREE.SphereGeometry(C.ball.radius * .01, 32, 24);
  const ringGeometry = new THREE.TorusGeometry(.20, .02, 6, 32);
  const resonanceMaterial = new THREE.MeshBasicMaterial({ color: colors.resonance });
  const balls = new Map<number, { sphere: THREE.Mesh; ring: THREE.Mesh; label: HTMLElement }>();
  const monsters = new Map<number, THREE.Object3D>(), cages = new Map<number, Cage>();
  // 已被規則擊破、正在播倒下動作的籠子；只是呈現，規則裡已經沒有這隻怪物。
  const dying = new Map<number, Cage>(), lastHp = new Map<number, number>();
  const monsterGeometry = new THREE.IcosahedronGeometry(.26, 0), monsterMaterial = new THREE.MeshStandardMaterial({ color: TOKENS.brassEdge, metalness: .75, roughness: .35, wireframe: true });
  const effectGeometry = new THREE.TorusGeometry(1, .012, 5, 64);
  const effects = new Map<object, THREE.Mesh>();
  const yarn = createYarn(scene), pulses = createPulses(scene);
  const vignette = document.createElement('div'); vignette.id = 'board-vignette'; vignette.setAttribute('aria-hidden', 'true');
  vignette.style.setProperty('--vignette', String(L.vignette)); stage.insertBefore(vignette, labels);
  const tally = document.createElement('div'); tally.id = 'board-tally'; tally.setAttribute('aria-hidden', 'true'); tally.hidden = true;
  tally.innerHTML = '<span class="tally-chain"></span><strong class="tally-value"></strong>'; stage.append(tally);
  const stamp = document.createElement('div'); stamp.id = 'board-stamp'; stamp.setAttribute('aria-hidden', 'true'); stamp.hidden = true; stage.append(stamp);
  // 事件卡卡面（?card=）：抽到時翻卡展示，最近一張的卡面留在操作區文字卡旁。
  const cardSlot = document.createElement('canvas'); cardSlot.id = 'board-card-face'; cardSlot.hidden = true; cardSlot.setAttribute('aria-hidden', 'true');
  const reveal = art.card ? createEventReveal({ variant: art.card, audio, reduced, stage, slot: cardSlot, values: C.board.events, materialName: m => materialName(m) }) : null;
  if (art.card) { const row = document.createElement('div'); row.className = 'board-card-row'; const cardText = get('board-card'); cardText.before(row); row.append(cardSlot, cardText); }
  let lastCards = 0, cardReveals = 0;
  let seen = new WeakSet<object>(), previous = performance.now(), accumulator = 0, angle = -Math.PI / 2;
  let drag: number | null = null, stopped = false, frameCount = 0, lastDie = 0;
  // 回饋狀態：連鎖音階、累加數字、落格放大、棋子跳格、骰子翻滾。全部只讀規則狀態。
  const juice = { step: -1, lastBurst: -99, total: 0, shown: 0, lastTick: 0, ticks: 0, punchAt: -99, slammed: true, hideAt: 0,
    landAt: -99, landKind: '', kickAt: -99, kick: 0, hopFrom: 0, hopAt: -99, lastPos: 0, lastLaps: 0, lastPhase: 'roll' as BoardPhase, rollAt: -99, landed: false,
    bursts: 0, maxStep: 0, damageNumbers: 0, slams: 0 };
  let ballPx = 0;
  const floaters: { el: HTMLElement; content: () => string; x: number; z: number; y: number; born: number; life: number }[] = [];
  const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const text = (id: string, value: string) => { const node = get(id); if (node.textContent !== value) node.textContent = value; };
  function project(x: number, y: number, height = 0) {
    const r = canvas.getBoundingClientRect();
    const p = new THREE.Vector3((x - 400) * .01, height, (y - 340) * .01).project(camera);
    return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 };
  }
  function world(clientX: number, clientY: number) {
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1), camera);
    const p = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    return p ? { x: p.x * 100 + 400, y: p.z * 100 + 340 } : null;
  }
  function setAngle(value: number) {
    angle = THREE.MathUtils.clamp(value, -165 * Math.PI / 180, -15 * Math.PI / 180);
    aim.value = String(Math.round(angle * 180 / Math.PI)); text('board-angle-value', `${aim.value}°`);
  }
  function aimAt(e: PointerEvent) {
    const p = world(e.clientX, e.clientY); if (!p) return;
    setAngle(Math.atan2(Math.min(-20, p.y - C.launcher.y), p.x - C.launcher.x));
  }
  const unlock = () => sound.unlock();
  const inspectToggle = get<HTMLButtonElement>('board-inspect-toggle');
  inspectToggle.addEventListener('click', () => {
    inspectMode = !inspectMode; inspectedId = null;
    inspectToggle.setAttribute('aria-pressed', String(inspectMode));
    inspectToggle.textContent = inspectMode ? t('inspectEnd') : t('inspect');
  });
  function inspectAt(e: PointerEvent) {
    let best = 24, found: number | null = null;
    for (const b of game.balls) {
      const p = project(b.x, b.y, .14 * closeupView(shot).ballScale), d = Math.hypot(p.x - e.clientX, p.y - e.clientY);
      if (d < best) { best = d; found = b.id; }
    }
    inspectedId = found;
  }
  roll.addEventListener('click', () => { unlock(); game.rollBoard(); canvas.focus({ preventScroll: true }); });
  fire.addEventListener('click', () => { unlock(); game.fire(angle); });
  aim.addEventListener('input', () => setAngle(Number(aim.value) * Math.PI / 180));
  get('board-mute').addEventListener('click', () => { unlock(); sound.toggle(); text('board-mute', sound.muted ? t('soundOff') : t('soundOn')); get('board-mute').setAttribute('aria-pressed', String(sound.muted)); });
  canvas.addEventListener('pointerdown', e => {
    if (inspectMode) { inspectAt(e); canvas.focus({ preventScroll: true }); return; }
    if (e.button !== 0 || game.board!.phase !== 'shooting' || game.status !== 'playing') return;
    const p = world(e.clientX, e.clientY); if (!p || p.x < 0 || p.x > C.width || p.y < 0 || p.y > C.height) return;
    unlock(); drag = e.pointerId; canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true }); aimAt(e);
  });
  canvas.addEventListener('pointermove', e => { if (drag === e.pointerId) aimAt(e); else if (e.pointerType === 'mouse') inspectAt(e); });
  canvas.addEventListener('pointerleave', () => { if (!inspectMode) inspectedId = null; });
  canvas.addEventListener('pointerup', e => {
    if (drag !== e.pointerId) return;
    aimAt(e); game.fire(angle); drag = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  });
  for (const event of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(event, () => { drag = null; });
  window.addEventListener('blur', () => { drag = null; });
  document.addEventListener('keydown', e => {
    if (inspectMode && e.target === canvas && ['ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key)) {
      e.preventDefault();
      if (e.key === 'Escape') { inspectToggle.click(); return; }
      const i = game.balls.findIndex(b => b.id === inspectedId), n = game.balls.length;
      if (n) inspectedId = game.balls[(i + (e.key === 'ArrowLeft' ? -1 : 1) + n) % n].id;
      return;
    }
    if (inspectMode && e.target === canvas) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement || game.status !== 'playing') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { setAngle(angle + (e.key === 'ArrowLeft' ? -.08 : .08)); e.preventDefault(); }
    if (e.code === 'Space') { e.preventDefault(); if (e.repeat) return; unlock(); if (game.board!.phase === 'roll') game.rollBoard(); else game.fire(angle); }
  });
  function resetVisuals() {
    for (const item of balls.values()) { scene.remove(item.sphere, item.ring); (item.sphere.material as THREE.MeshPhysicalMaterial).map?.dispose(); (item.sphere.material as THREE.Material).dispose(); item.label.remove(); } balls.clear();
    for (const item of monsters.values()) scene.remove(item); monsters.clear(); cages.clear();
    for (const cage of dying.values()) scene.remove(cage.group); dying.clear(); lastHp.clear();
    reveal?.reset(); lastCards = 0;
    for (const item of effects.values()) { scene.remove(item); (item.material as THREE.Material).dispose(); } effects.clear();
    for (const f of floaters) f.el.remove(); floaters.length = 0;
    seen = new WeakSet(); drag = null; accumulator = 0; previous = performance.now(); setAngle(-Math.PI / 2);
    inspectedId = null;
    lastDie = 0; outer.setDie(1); dice.rotation.set(0, .25, 0); dice.position.copy(dieRest);
    Object.assign(juice, { step: -1, lastBurst: -99, total: 0, shown: 0, punchAt: -99, slammed: true, landAt: -99, kickAt: -99, hopAt: -99, lastPos: 0, lastLaps: 0, lastPhase: 'roll', rollAt: -99, landed: false });
    tally.hidden = true; stamp.hidden = true;
  }
  get('board-setup').addEventListener('submit', e => {
    e.preventDefault(); if (!seed.reportValidity()) return;
    unlock(); game.reset(Number(seed.value)); resetVisuals(); game.start(); get('board-setup').hidden = true;
    canvas.focus({ preventScroll: true });
  });
  get('board-restart').addEventListener('click', () => {
    game.reset(); resetVisuals(); seed.value = String(game.seed); get('board-setup').hidden = false;
    get('board-start').focus({ preventScroll: true });
  });
  // 整張棋盤（含前緣的骰子）必須完整入鏡：二分搜尋鏡頭距離，讓八個角落都落在畫面 96% 內。
  const fitCorners = [-5.65, 5.65].flatMap(x => [-.3, .3].flatMap(y => [-5.0, 5.55].map(z => new THREE.Vector3(x, y, z))));
  const probe = new THREE.Vector3();
  function fit(aspect: number) {
    const narrow = aspect < 1.3;
    elevation = (narrow ? 58 : 45) * Math.PI / 180; camera.fov = narrow ? 34 : 30; camera.aspect = aspect;
    camTarget.set(0, -.35, narrow ? .3 : .5);
    const dir = new THREE.Vector3(0, Math.sin(elevation), Math.cos(elevation));
    const view = closeupView(shot), close = shot === 'field' || view.close;
    if (close) camTarget.set(0, 0, 0);
    const crop = view.cropped && narrow ? .7 : 1;
    const corners = close ? [-view.halfWidth * crop, view.halfWidth * crop].flatMap(x => [-.15, .65].flatMap(y => [-view.halfDepth * crop, view.halfDepth * crop].map(z => new THREE.Vector3(x, y, z)))) : fitCorners;
    let lo = 4, hi = 80;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2; camera.position.copy(camTarget).addScaledVector(dir, mid); camera.lookAt(camTarget);
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      const fits = corners.every(c => { probe.copy(c).project(camera); return Math.abs(probe.x) <= .985 && Math.abs(probe.y) <= .97; });
      if (fits) hi = mid; else lo = mid;
    }
    camBase.copy(camTarget).addScaledVector(dir, hi);
    // 截圖用特寫鏡頭（?cam=ball／?cam=icon），只改鏡頭，不改任何狀態。
    if (shot === 'ball') { camTarget.set(-.6, 0, .4); camBase.set(-.6, 2.6, 3.0); camera.fov = 30; }
    if (shot === 'icon') { camTarget.set(-1.15, -.25, 4.55); camBase.set(-1.15, 1.75, 6.55); camera.fov = 30; }
    // 截圖用（?lab=1 的 cagePose）：對準一隻怪物籠，仰角同整桌鏡頭 45°。
    if (shot === 'cage' && cageFocus) { camTarget.copy(cageFocus); camBase.set(cageFocus.x, cageFocus.y + 1.3, cageFocus.z + 1.3); camera.fov = 30; }
    camera.position.copy(camBase); camera.lookAt(camTarget); lookNow.copy(camTarget); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    for (const item of balls.values()) item.sphere.rotation.x = -elevation;
  }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    fit(w / h); renderer.setSize(w, h, false); composer.setSize(w, h);
    const narrow = w < 600; light.shadow.mapSize.set(narrow ? 1024 : 2048, narrow ? 1024 : 2048); light.shadow.map?.dispose(); light.shadow.map = null;
  }
  new ResizeObserver(resize).observe(stage); resize();
  document.addEventListener('visibilitychange', () => { previous = performance.now(); accumulator = 0; drag = null; });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); stopped = true; get('board-failure').hidden = false; roll.disabled = fire.disabled = true; });
  function banner() {
    const board = game.board!, tile = C.board.tiles[board.position];
    if (game.status === 'won') return t('bannerWin');
    if (game.status === 'lost') return t('bannerLoss');
    if (game.status === 'ready') return t('bannerReady');
    if (board.phase === 'rolling') return t('rolling');
    if (board.phase === 'moving') return t('moving', { v0: board.stepsLeft });
    if (board.phase === 'roll') return t('turnEnd', { v0: board.bossClock });
    if (tile.kind === 'SURGE') return t('surge');
    if (tile.kind === 'TUNE') return t('tune', { v0: materialName(tile.material) });
    if (tile.kind === 'EVENT') { const card = board.cards.at(-1); return card ? t('eventBanner', { v0: cardText(card).name, v1: cardText(card).effect }) : 'EVENT'; }
    return t('lapBanner', { v0: C.board.lapBonusShots });
  }
  function addBall(b: Ball) {
    const material = numberedBallMaterial(choice.ball, b.material, b.id); material.envMapIntensity = 3.2; // 只有球：整體環境 0.1 × 3.2 ≈ 0.32，讓鋼與黃銅在遠景仍看得出亮面（C1）
    const sphere = mesh(ballGeometry, material); sphere.rotation.x = -elevation;
    const ring = mesh(ringGeometry, resonanceMaterial); ring.rotation.x = -Math.PI / 2; ring.castShadow = false;
    const label = document.createElement('span'); label.className = 'board-ball-label'; label.textContent = String(b.id).padStart(2, '0'); labels.append(label);
    const item = { sphere, ring, label }; balls.set(b.id, item); return item;
  }
  const W = (x: number) => (x - 400) * .01, Z = (y: number) => (y - 340) * .01;
  function floater(content: () => string, cls: string, x: number, z: number, y = .5, life = .9) {
    const el = document.createElement('span'); el.className = `board-float ${cls}`; el.textContent = content(); labels.append(el);
    floaters.push({ el, content, x, z, y, born: performance.now() / 1000, life }); juice.damageNumbers++;
  }
  /** 規則效果轉成聲音與畫面回饋；只讀，不回寫。 */
  function feedback(e: typeof game.effects[number], now: number) {
    const pan = (e.x - 400) / 400;
    if (e.kind === 'impact') {
      const kind = classifyImpact(e.x, e.y, C.ball.radius, C.width, C.height, game.boss.hp > 0 ? game.boss : null, game.monsters);
      let a = 0, b: number | null = null, best = Infinity, second = Infinity, seed = 0;
      for (const ball of game.balls) { const d = Math.hypot(ball.x - e.x, ball.y - e.y); if (d < best) { second = best; b = a; best = d; a = ball.material; seed = ball.id; } else if (d < second) { second = d; b = ball.material; } }
      audio.impact(kind, impactStrength(e.value), a, kind === 'ball' ? b : null, pan, seed);
      return;
    }
    if (e.kind === 'burst') {
      if (now - juice.lastBurst > COMBO_WINDOW_SECONDS) { juice.step = -1; juice.total = 0; juice.shown = 0; juice.ticks = 0; }
      juice.step = Math.min(10, juice.step + 1); juice.lastBurst = now; juice.bursts++; juice.maxStep = Math.max(juice.maxStep, juice.step); juice.slammed = false;
      audio.burst(juice.step, e.value, pan, e.amplified);
      if (e.value >= 2 && !reduced) { juice.kickAt = now; juice.kick = Math.min(1, e.value * .25); }
      floater(() => t('depth', { v0: e.value }), 'board-float-chain', W(e.x), Z(e.y), .45, .7);
      if (effects.size < 32) {
        const ring = mesh(effectGeometry, new THREE.MeshBasicMaterial({ color: e.amplified ? TOKENS.yarnGlow : TOKENS.ochre, transparent: true, opacity: .7 }), W(e.x), .04, Z(e.y));
        ring.rotation.x = -Math.PI / 2; ring.castShadow = false; effects.set(e, ring);
      }
      return;
    }
    if (e.kind === 'ignite' && e.fromX !== undefined && e.fromY !== undefined) { pulses.emit(W(e.fromX), Z(e.fromY!), W(e.x), Z(e.y), 1, now); return; }
    if (e.kind === 'damage') {
      juice.total += e.value; if (now - juice.lastBurst > COMBO_WINDOW_SECONDS) juice.lastBurst = now - COMBO_WINDOW_SECONDS + .5;
      juice.slammed = false; floater(() => `−${e.value}`, 'board-float-damage', W(e.x), Z(e.y), .6, .8);
      // 怪物籠被打到時縮一下再彈回（只有新籠子三版）。
      if (cages.size) { let best: Cage | null = null, d = Infinity; for (const m of game.monsters) { const dd = Math.hypot(m.x - e.x, m.y - e.y); if (dd < d && dd < m.radius + C.ball.radius * 3) { d = dd; best = cages.get(m.id) ?? null; } } best?.jolt(now); }
      return;
    }
    if ((e.kind === 'resonate' || e.kind === 'release') && effects.size < 32) {
      const ring = mesh(effectGeometry, new THREE.MeshBasicMaterial({ color: colors.resonance, transparent: true, opacity: .6 }), W(e.x), .04, Z(e.y));
      ring.rotation.x = -Math.PI / 2; ring.castShadow = false; effects.set(e, ring);
    }
    audio.play(e, game.phase === 'active');
  }
  /** 棋盤流程的聲音與動作：擲骰、骰子落桌、逐格、落格、繞圈。 */
  function boardBeats(now: number) {
    const board = game.board!;
    if (board.phase === 'rolling' && juice.lastPhase !== 'rolling') { juice.rollAt = now; audio.diceShake(); }
    if (board.phase === 'moving' && juice.lastPhase === 'rolling') audio.diceLand((dieRest.x) / 7);
    if (board.position !== juice.lastPos && game.status === 'playing') {
      juice.hopFrom = juice.lastPos; juice.hopAt = now;
      const index = board.die - board.stepsLeft - 1, final = board.stepsLeft === 0;
      audio.step(Math.max(0, index), final, positions[board.position][0] / 6);
      juice.lastPos = board.position;
    }
    if (board.laps > juice.lastLaps) { juice.lastLaps = board.laps; audio.lap(); floater(() => t('extraFloater', { v0: C.board.lapBonusShots }), 'board-float-lap', positions[0][0], positions[0][1], .4, 1.4); }
    if (board.landed && !juice.landed) {
      const tile = C.board.tiles[board.position], pan = positions[board.position][0] / 6;
      juice.landAt = now; juice.landKind = tile.kind;
      if (tile.kind === 'SURGE') setTimeout(() => audio.surge(pan), 70);
      if (tile.kind === 'TUNE') setTimeout(() => audio.tune(tile.material, pan), 70);
      if (tile.kind === 'SURGE' || tile.kind === 'TUNE') {
        stamp.textContent = tile.kind === 'TUNE' ? `TUNE · ${materialName(tile.material)}` : 'SURGE';
        stamp.dataset.kind = tile.kind; stamp.hidden = false; stamp.classList.remove('stamp-in'); void stamp.offsetWidth; stamp.classList.add('stamp-in');
      }
    }
    juice.landed = board.landed; juice.lastPhase = board.phase;
    // 新抽到的事件卡：從那張 EVENT 格飛起來翻開。
    if (board.cards.length > lastCards) {
      lastCards = board.cards.length;
      if (reveal) { const drawn = board.cards.at(-1)!, r = canvas.getBoundingClientRect(), p = new THREE.Vector3(positions[board.position][0], -.2, positions[board.position][1]).project(camera);
        reveal.start(drawn, now, { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 }); cardReveals++; }
    }
  }
  const hop = new THREE.Vector3(), cardWorld = new THREE.Vector3(), basePos = new THREE.Vector3();
  function render() {
    const now = performance.now() / 1000, board = game.board!, running = game.status === 'playing', shooting = running && board.phase === 'shooting';
    audio.frame(); const rect = canvas.getBoundingClientRect();
    text('board-phase', game.status === 'ready' ? t('ready') : game.status === 'won' ? t('won') : game.status === 'lost' ? t('lost') : phaseNames()[board.phase]);
    text('board-turn', t('turn', { v0: board.turn })); text('board-shots', t('shots', { v0: board.shotsLeft })); text('board-clock', t('clock', { v0: board.bossClock }));
    text('board-banner', banner()); text('board-die', t('die', { v0: board.die || '—' }));
    const bannerKind = game.status === 'playing' && board.landed && board.phase !== 'roll' ? C.board.tiles[board.position].kind : '';
    if (get('board-banner').dataset.kind !== bannerKind) get('board-banner').dataset.kind = bannerKind;
    text('board-position', `${String(board.position).padStart(2, '0')} ${C.board.tiles[board.position].kind}`);
    text('board-next', t('next', { v0: materialName(game.nextMaterial), v1: game.balls.length }));
    text('board-wave', t('wave', { v0: game.wave, v1: (game.wave + 1) * C.board.waveEveryTurns - board.bossClock }));
    text('board-bonus', t('bonus', { v0: board.nextTurnBonus, v1: board.laps }));
    const card = board.cards.at(-1); get('board-card').hidden = !card;
    if (card) text('board-card', t('card', { v0: card.turn, v1: cardText(card).name, v2: cardText(card).effect }));
    const inspected = game.balls.find(b => b.id === inspectedId);
    text('board-inspect', inspected ? t('inspected', { id: inspected.id, material: materialName(inspected.material), state: inspected.resonant ? t('resonating') : t('charging') }) : inspectMode ? t('inspectHelp') : t('inspectHint'));
    text('board-monsters', t('monsters', { v0: game.monsters.length, v1: C.monsters.loseAbove }));
    text('board-hp-value', `${game.boss.hp} / ${game.boss.maxHp}`); get<HTMLProgressElement>('board-hp').value = game.boss.hp;
    roll.disabled = !running || board.phase !== 'roll'; fire.disabled = !shooting || game.tick - game.lastShotTick < C.launcher.intervalTicks; aim.disabled = !shooting;
    get('board-result').hidden = game.status !== 'won' && game.status !== 'lost';
    if (game.status === 'won' || game.status === 'lost') text('board-result', t('result', { outcome: game.status === 'won' ? t('resultWin') : t('resultLoss'), turns: board.turn, shots: game.shots }));
    boardBeats(now);
    for (const e of game.effects) { if (seen.has(e)) continue; seen.add(e); feedback(e, now); }

    // 骰子：擲骰期間從桌邊翻滾進來，落定後顯示點數；減少動態時直接出現在定位。
    dice.visible = board.die > 0 || board.phase === 'rolling';
    if (board.die && board.die !== lastDie) { lastDie = board.die; outer.setDie(board.die); }
    const rollT = Math.min(1, (now - juice.rollAt) / .32);
    if (board.phase === 'rolling' && !reduced) {
      const bounce = Math.abs(Math.sin(rollT * Math.PI * 2.5)) * (1 - rollT) * .7;
      dice.position.set(dieRest.x + 2.2 * (1 - rollT), dieRest.y + bounce, dieRest.z + .5 * (1 - rollT));
      dice.rotation.set(rollT * 9.1, .25 + rollT * 6.3, rollT * 4.7);
    } else { dice.position.copy(dieRest); dice.rotation.set(0, .25, 0); }

    // 落格：卡片放大彈一下，鏡頭往那張卡推近再退回（C2 的特寫角度）；減少動態時只留高亮。
    const landT = (now - juice.landAt) / .95, zoom = reduced ? 0 : landingZoom(landT) * (juice.landKind === 'SURGE' || juice.landKind === 'TUNE' ? 1 : .35);
    tiles.forEach(({ top, label, mesh: card }, i) => {
      const selected = i === board.position, landed = selected && board.landed;
      top.emissive.setHex(landed ? colors.landed : 0); top.emissiveIntensity = landed ? .35 + (reduced ? 0 : .4 * zoom) : 0;
      card.scale.setScalar(landed && !reduced ? 1 + .12 * zoom : 1);
      const tile = C.board.tiles[i], narrow = rect.width < 600, right = positions[i][0] > 4;
      label.hidden = !(tile.kind === 'TUNE' || (narrow && right));
      const labelText = narrow && right ? `${String(i).padStart(2, '0')} ${tile.kind}${tile.kind === 'TUNE' ? '\n' + materialName(tile.material) : ''}` : tile.kind === 'TUNE' ? materialName(tile.material) : '';
      if (label.textContent !== labelText) label.textContent = labelText;
      label.dataset.active = String(selected); label.dataset.right = String(narrow && right);
      if (!(narrow && right)) labelAt(label, positions[i][0] + .5, positions[i][1] - .46, .02);
      if (narrow && right) { const p = projectWorld(positions[i][0], .02, positions[i][1]); label.style.transform = `translate(${rect.width - 4}px,${p.y - 16}px) translate(-100%,-50%)`; }
    });
    if (stamp.hidden === false) {
      const tile = C.board.tiles[board.position]; stamp.textContent = tile.kind === 'TUNE' ? `TUNE · ${materialName(tile.material)}` : 'SURGE';
      const p = projectWorld(positions[board.position][0], -.2, positions[board.position][1] - .7);
      stamp.style.left = `${p.x}px`; stamp.style.top = `${p.y}px`;
      if (landT > 1.3 || !board.landed) stamp.hidden = true;
    }
    // 棋子：每一格跳一下（0.14 秒弧線）。
    const target = positions[board.position], from = positions[juice.hopFrom] ?? target, hopT = reduced ? 1 : Math.min(1, (now - juice.hopAt) / .14);
    hop.set(from[0] + (target[0] - from[0]) * hopT + .38, -.25 + Math.sin(Math.PI * hopT) * .35, from[1] + (target[1] - from[1]) * hopT - .18);
    pawn.position.copy(hop);

    // 鏡頭：落格推近＋連鎖時一點點 FOV 收縮。
    const kickT = (now - juice.kickAt) / .28, kick = !reduced && kickT >= 0 && kickT < 1 ? juice.kick * (1 - kickT) ** 2 : 0;
    if (!shot) {
      cardWorld.set(target[0], -.25, target[1]);
      basePos.copy(camBase).lerp(cardWorld, .32 * zoom); camera.position.copy(basePos);
      lookNow.copy(camTarget).lerp(cardWorld, .45 * zoom); camera.lookAt(lookNow);
      const baseFov = elevation > 50 * Math.PI / 180 ? 34 : 30; const fov = baseFov - kick * 1.6;
      if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
      camera.updateMatrixWorld();
    }

    function labelAt(label: HTMLElement, x: number, z: number, y: number) {
      const p = new THREE.Vector3(x, y, z).project(camera);
      label.style.transform = `translate(${(p.x + 1) * rect.width / 2}px,${(1 - p.y) * rect.height / 2}px) translate(-50%,-50%)`;
    }
    function projectWorld(x: number, y: number, z: number) { const p = new THREE.Vector3(x, y, z).project(camera); return { x: (p.x + 1) * rect.width / 2, y: (1 - p.y) * rect.height / 2 }; }
    // 球：號碼印在球上；螢幕上的球小於 22 px 時，另補一張小紙籤在右上，不蓋住球。
    const view = closeupView(shot), r = C.ball.radius * .01 * view.ballScale;
    const edge = projectWorld(r, r, 0), center = projectWorld(0, r, 0), diameter = Math.abs(edge.x - center.x) * 2;
    const needTag = diameter < 22; ballPx = Math.round(diameter * 10) / 10;
    // 只保留最近三球、被查看的球與少量共振球；紙籤按螢幕距離避讓。
    const recent = new Set(game.balls.slice(-3).map(b => b.id));
    const priority = [...game.balls].sort((a, b) =>
      Number(b.id === inspectedId) - Number(a.id === inspectedId) || Number(recent.has(b.id)) - Number(recent.has(a.id)) || Number(b.resonant) - Number(a.resonant) || b.id - a.id);
    const tagIds = new Set<number>(), tagPositions: { x: number; y: number }[] = [];
    for (const b of priority) {
      if (b.id !== inspectedId && (!needTag || (!recent.has(b.id) && !b.resonant))) continue;
      const p = projectWorld(W(b.x) + r * .9, r * 2.2, Z(b.y) - r * .2);
      if (p.x < 10 || p.x > rect.width - 20 || p.y < 16 || p.y > rect.height - 12) continue;
      if (tagIds.size >= (rect.width < 600 ? 6 : 10) || tagPositions.some(q => Math.abs(p.x - q.x) < 24 && Math.abs(p.y - q.y) < 22)) continue;
      tagIds.add(b.id); tagPositions.push(p);
    }
    visibleTagCount = 0;
    for (const b of game.balls) {
      const item = balls.get(b.id) ?? addBall(b), x = W(b.x), z = Z(b.y);
      item.sphere.position.set(x, r, z); item.sphere.scale.setScalar(view.ballScale);
      item.ring.position.set(x, .025, z); item.ring.scale.setScalar(view.ballScale); item.ring.visible = b.resonant;
      item.label.hidden = legacyDensity ? !needTag : !tagIds.has(b.id);
      if (!item.label.hidden) { visibleTagCount++; const p = projectWorld(x + r * .9, r * 2.2, z - r * .2); item.label.style.transform = `translate(${p.x + 6}px,${p.y - 6}px) translate(-50%,-50%)`; }
    }
    for (const [id, item] of balls) if (!game.balls.some(b => b.id === id)) { scene.remove(item.sphere, item.ring); item.label.remove(); balls.delete(id); }
    // 毛線：球在爆發半徑內的最近兩顆之間牽線；有一端已共振就亮，相變期全亮。
    const reach = C.ball.radius * C.resonance.radiusInBalls, links: YarnLink[] = [], pairs = new Set<string>();
    for (const a of game.balls) {
      if (!legacyDensity && !a.resonant && a.id !== inspectedId) continue;
      const near = game.balls.filter(o => o !== a && Math.hypot(o.x - a.x, o.y - a.y) <= reach).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y)).slice(0, 2);
      for (const o of near) {
        const key = a.id < o.id ? `${a.id}:${o.id}` : `${o.id}:${a.id}`; if (pairs.has(key)) continue; pairs.add(key);
        if (!legacyDensity && links.length >= (rect.width < 600 ? 12 : 24)) continue;
        const lit = game.phase === 'active' ? 1 : a.resonant && o.resonant ? 1 : a.resonant || o.resonant ? .7 : 0;
        links.push({ ax: W(a.x), az: Z(a.y), bx: W(o.x), bz: Z(o.y), side: (a.id + o.id) % 2 ? 1 : -1, glow: lit });
      }
    }
    visibleLinkCount = links.length;
    yarn.set(links); yarn.animate(now, reduced, game.phase === 'active' ? 1.4 : 1); pulses.update(now, reduced);
    for (const [id, item] of monsters) if (!game.monsters.some(m => m.id === id)) {
      const cage = cages.get(id);
      // 被擊破的怪物先播籠內角色倒下的動作再收走；重來時（ready）和沒有籠子時立刻移除。
      if (cage && game.status !== 'ready') { cage.defeat(now); dying.set(id, cage); } else scene.remove(item);
      monsters.delete(id); cages.delete(id); lastHp.delete(id);
    }
    for (const [id, cage] of dying) { cage.update(now, reduced, 0); if (cage.gone(now)) { scene.remove(cage.group); dying.delete(id); } }
    for (const m of game.monsters) {
      if (!monsters.has(m.id)) {
        if (art.cage) { const cage = buildCage(art.cage, m.id, inside); cage.group.position.set(W(m.x), -.03, Z(m.y)); scene.add(cage.group); monsters.set(m.id, cage.group); cages.set(m.id, cage); }
        else monsters.set(m.id, mesh(monsterGeometry, monsterMaterial, W(m.x), .23, Z(m.y)));
      }
      const cage = cages.get(m.id), hp = m.maxHp > 0 ? m.hp / m.maxHp : 1;
      // 血量往下掉就是被打到：籠內角色晃一下（傷害浮字那條路也會觸發，同一刻重複呼叫無妨）。
      if (cage) { const before = lastHp.get(m.id); if (before !== undefined && m.hp < before) cage.jolt(now); lastHp.set(m.id, m.hp); }
      if (cage) cage.update(now, reduced, hp); else if (!reduced) monsters.get(m.id)!.rotation.y = now * .4 + m.id;
    }
    reveal?.update(now);
    for (const [key, ring] of effects) {
      const e = key as typeof game.effects[number], age = (game.tick - e.tick) / C.feedback.lifetimeTicks;
      if (age >= 1) { scene.remove(ring); (ring.material as THREE.Material).dispose(); effects.delete(key); continue; }
      ring.scale.setScalar(Math.min(3.4, e.radius * .01) * (reduced ? 1 : .3 + age * .7));
      (ring.material as THREE.MeshBasicMaterial).opacity = (1 - age) * (reduced ? .25 : .7);
    }
    // 浮字：傷害與層數往上飄並淡出；剛出現時彈大一下。
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i], age = now - f.born;
      f.el.textContent = f.content();
      if (age > f.life) { f.el.remove(); floaters.splice(i, 1); continue; }
      const p = projectWorld(f.x, f.y, f.z), rise = reduced ? 0 : age * 34, scale = reduced ? 1 : punchScale(age);
      f.el.style.transform = `translate(${p.x}px,${p.y - rise}px) translate(-50%,-50%) scale(${scale})`;
      f.el.style.opacity = String(Math.max(0, 1 - Math.max(0, age - f.life * .5) / (f.life * .5)));
    }
    // 累加數字：同一串連鎖的傷害一路往上跳，停下來時重重定格。
    if (juice.total > 0) {
      const before = juice.shown; juice.shown = reduced ? juice.total : tallyStep(juice.shown, juice.total, Math.min(.05, now - juice.lastTick));
      if (juice.shown !== before) { juice.ticks++; juice.punchAt = now; if (juice.ticks % 2 === 0) audio.tick(juice.ticks); }
      tally.hidden = false;
      (tally.firstElementChild as HTMLElement).textContent = juice.step > 0 ? t('chain', { v0: juice.step + 1 }) : t('damage');
      (tally.lastElementChild as HTMLElement).textContent = `−${juice.shown}`;
      const scale = reduced ? 1 : punchScale(now - juice.punchAt) * (juice.slammed ? 1 : 1 + Math.min(.4, juice.step * .05));
      tally.style.setProperty('--tally-scale', String(scale));
      if (!juice.slammed && now - juice.lastBurst > COMBO_WINDOW_SECONDS && juice.shown >= juice.total) {
        juice.slammed = true; juice.slams++; text('board-chain-live', t('chainLive', { chain: Math.max(1, juice.step + 1), damage: juice.total })); juice.hideAt = now + 1.1; juice.punchAt = now; audio.slam(juice.step + 1); tally.classList.add('tally-slam');
      }
      if (juice.slammed && now > juice.hideAt) { juice.total = juice.shown = 0; juice.ticks = 0; juice.step = -1; tally.hidden = true; tally.classList.remove('tally-slam'); }
    }
    juice.lastTick = now;
    boss.visible = knob.visible = game.boss.hp > 0;
    const shifting = game.phase === 'active', warning = game.phase === 'warning';
    coreLight.intensity = shifting ? 6 : warning ? 2.2 : .3; core.scale.setScalar(reduced ? 1 : 1 + .08 * Math.sin(now * 3));
    light.intensity = L.intensity * SPOT_GAIN * (shifting ? .8 : 1);
    aimLine.visible = shooting && !view.close;
    const lz = Z(C.launcher.y);
    aimLine.geometry.setFromPoints([new THREE.Vector3(0, .12, lz), new THREE.Vector3(Math.cos(angle) * 1.2, .12, lz + Math.sin(angle) * 1.2)]);
    fan.visible = shooting && view.close;
    if (fan.visible) {
      const attribute = fanGeometry.getAttribute('position');
      (attribute.array as Float32Array).set(aimFan(angle, C.launcher.coneHalfAngle, 0, lz));
      attribute.needsUpdate = true; fanGeometry.computeBoundingSphere();
    }
    aimHint.hidden = !shooting || !view.close;
    if (!aimHint.hidden) {
      const from = project(C.launcher.x, C.launcher.y), to = project(C.launcher.x + Math.cos(angle) * 100, C.launcher.y + Math.sin(angle) * 100);
      const arrow = to.x < from.x - 8 ? '↖' : to.x > from.x + 8 ? '↗' : '↑';
      aimHint.textContent = t('aimHint', { arrow, angle: Math.round(angle * 180 / Math.PI), crop: view.cropped ? t('cropped') : '' });
    }
    launcher.rotation.y = -angle;
    scene.background = new THREE.Color(shifting ? TOKENS.bgShift : TOKENS.bgIdle);
    composer.render();
    canvas.dataset.ready = 'true'; canvas.dataset.status = game.status; canvas.dataset.phase = board.phase; canvas.dataset.position = String(board.position);
  }
  // 驗收只讀取真實規則與投影；遊戲操作仍走 DOM 輸入。
  Object.assign(window, { boardEvidence: {
    snapshot: () => ({ game: game.snapshot(), frameCount, visual: { choice, art, inside, cardReveals, cages: cages.size, dyingCages: dying.size, ring: true, reduced, cards: tiles.map(t => ({ index: t.index, kind: t.kind, x: t.mesh.position.x, z: t.mesh.position.z, highlighted: t.top.emissiveIntensity > 0 })), pawn: { x: pawn.position.x, z: pawn.position.z }, die: lastDie, yarn: yarn.core.count, ballPx, ballTags: !!game.balls.length && ballPx < 22, camera: { fov: camera.fov, elevation: elevation * 180 / Math.PI } }, renderedBalls: balls.size, renderedMonsters: monsters.size, drawCalls: renderer.info.render.calls, audio: audio.context?.state ?? 'not-started', sounds: { played: audio.played, log: audio.log.slice(-60), kinds: [...audio.kinds].sort() }, juice: { bursts: juice.bursts, maxStep: juice.maxStep, floaters: juice.damageNumbers, slams: juice.slams } }),
    project,
  } });
  // ?lab=1：截圖腳本用。用固定角度、固定節奏推進同一個 seed，讓各版本的球位完全相同。只呼叫公開的規則操作。
  if (params.get('lab') === '1') Object.assign(window, { boardLab: {
    // 僅供同盤面呈現對照：保留原本「全紙籤／全毛線」邏輯，不改規則或時間。
    presentation(options: { legacyDensity?: boolean; camera?: 'table' | 'field' | 'fieldA' | 'fieldB' }) {
      if (options.legacyDensity !== undefined) legacyDensity = options.legacyDensity;
      if (options.camera) { shot = options.camera === 'table' ? null : options.camera; resize(); }
      render();
      return { visibleTagCount, visibleLinkCount, ballPx, camera: shot ?? 'table' };
    },
    fastForward(shots: number, seedValue = 20261111) {
      game.reset(seedValue); resetVisuals(); game.start(); get('board-setup').hidden = true;
      let guard = 0;
      while (game.status === 'playing' && game.shots < shots && guard++ < 200000) {
        if (game.board!.phase === 'roll') { game.rollBoard(); continue; }
        if (game.board!.phase === 'shooting') game.fire((-90 + Math.sin(game.shots * 2.3) * 55) * Math.PI / 180);
        game.step();
      }
      for (let i = 0; i < 2000 && game.status === 'playing'; i++) { if (game.board!.phase === 'roll') break; game.step(); }
      seen = new WeakSet(game.effects); lastCards = game.board!.cards.length; if (lastCards) reveal?.show(game.board!.cards.at(-1)!); juice.lastPos = game.board!.position; juice.hopFrom = juice.lastPos; juice.landed = game.board!.landed; juice.lastPhase = game.board!.phase; juice.lastLaps = game.board!.laps;
      return { shots: game.shots, balls: game.balls.length, phase: game.board!.phase, resonant: game.balls.filter(b => b.resonant).length, monsters: game.monsters.length };
    },
    /**
     * 僅供三版並排截圖：把累加數字或抽卡展示停在固定的一刻。只改呈現狀態，不改規則、RNG 或遊戲時鐘。
     * card.index 是 EVENT_CARDS 的順序；t 是抽卡時間表上的秒數。
     */
    preview(options: { tally?: { chain: number; value: number }; card?: { index: number; t: number; material?: number; target?: number } }) {
      if (options.tally) { Object.assign(juice, { total: options.tally.value, shown: options.tally.value, step: options.tally.chain - 1, slammed: true, hideAt: Infinity, punchAt: -99, lastBurst: -99 }); tally.classList.add('tally-slam'); }
      if (options.card && reveal) {
        const card = EVENT_CARDS[options.card.index], r = canvas.getBoundingClientRect(), tile = C.board.tiles.findIndex(t => t.kind === 'EVENT');
        const p = new THREE.Vector3(positions[tile][0], -.2, positions[tile][1]).project(camera);
        reveal.freeze({ id: card.id, name: cardText(card).name, material: options.card.material ?? 1, targetBallId: options.card.target }, options.card.t, { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 });
      }
      render(); return { tallyVisible: !tally.hidden, cardActive: reveal?.active ?? false };
    },
    /**
     * 僅供籠內反應對照截圖：把第 index 隻怪物的籠內反應停在某一刻，並可把鏡頭對準它。
     * 只改呈現（姿勢與鏡頭），不改規則的血量、RNG 或遊戲時鐘；pose 傳 null 解除。
     */
    cagePose(index: number, pose: CagePose | null, focus = false) {
      const m = game.monsters[index]; if (!m) return null;
      const cage = cages.get(m.id); cage?.pose(pose);
      if (focus) { cageFocus = new THREE.Vector3(W(m.x), .15, Z(m.y)); shot = 'cage'; resize(); }
      render(); return { id: m.id, hp: m.hp, maxHp: m.maxHp, x: m.x, y: m.y, hasInside: !!cage?.inside };
    },
    /** 卡面特寫：回傳某一版六張卡的 PNG data URL（程式繪製）。 */
    faces(variant: 'a' | 'b' | 'c') { return faceSheet(variant, EVENT_CARDS, C.board.events, materialName(1)).map(c => c.toDataURL('image/png')); },
  } });
  function frame(now: number) {
    if (stopped) return; requestAnimationFrame(frame);
    const elapsed = Math.max(0, (now - previous) / 1000); previous = now;
    if (document.hidden) return;
    accumulator += Math.min(elapsed, .25);
    while (accumulator >= C.dt) { game.step(); accumulator -= C.dt; }
    frameCount++; render();
  }
  function refreshLanguage() {
    refreshStaticLanguage();
    text('board-inspect-toggle', inspectMode ? t('inspectEnd') : t('inspect'));
    text('board-mute', sound.muted ? t('soundOff') : t('soundOn'));
    reveal?.refreshLanguage();
  }
  language.subscribe(refreshLanguage); refreshLanguage();
  render(); requestAnimationFrame(frame);
}
