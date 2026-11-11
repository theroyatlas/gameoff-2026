import * as THREE from 'three';
import { Game, type Ball } from '../../src/game';
import { CONFIG as C } from '../../src/config';
import { Sound } from '../../src/audio';
import type { BoardPhase } from '../../src/board';
import './board-ring.css';

const phaseNames: Record<BoardPhase, string> = {
  roll: '等待擲骰', rolling: '擲骰中', moving: '自動走格', effect: '格子效果', shooting: '瞄準與射擊', settling: '等待球停下',
};
// 從左下角沿左側往上，再沿上、右、下緣順時針走。
const positions = [
  [-5.2, 4.7], [-5.2, 1.55], [-5.2, -1.55], [-5.2, -4.7],
  [-2.6, -4.7], [0, -4.7], [2.6, -4.7], [5.2, -4.7],
  [5.2, -1.55], [5.2, 1.55], [5.2, 4.7], [2.6, 4.7], [0, 4.7], [-2.6, 4.7],
];
const colors = { background: 0xe4e5e7, table: 0xbec2c7, edge: 0x777e88,
  START: 0xc8d6c8, SURGE: 0xa8c4d8, TUNE: 0xd5c9b0, EVENT: 0xc5c6cb,
  landed: 0xffe28b, pawn: 0x254a70, boss: 0x59616c, monster: 0x86594f,
  materials: [0xf4f5f6, 0x778a9e, 0xc49c61], resonance: 0x226288 };

export function startBoard() {
  document.body.classList.add('board-mode');
  document.title = '共振桌 · 灰盒棋盤';
  const root = document.querySelector('main')!;
  root.className = 'board-app';
  root.innerHTML = `
    <header class="board-header"><div><h1>共振桌 · 棋盤</h1><p>14 格順時針 · 灰盒試玩</p></div><a id="board-realtime">即時版</a></header>
    <div class="board-topline"><label class="board-boss">Boss <progress id="board-hp" max="12000" value="12000"></progress><span id="board-hp-value"></span></label><span id="board-monsters"></span></div>
    <form id="board-setup"><label>種子 <input id="board-seed" type="number" min="0" max="4294967295" step="1" required value="${C.seed}"></label><button id="board-start" type="submit">開始</button></form>
    <div class="board-readout"><strong id="board-phase" role="status"></strong><span id="board-turn"></span><span id="board-shots"></span><strong id="board-clock"></strong></div>
    <p id="board-banner" role="status">擲骰後自動走格，落格效果會改變這一回合。</p>
    <div class="board-layout">
      <section id="board-stage" aria-label="14 格棋盤與中央球場"><canvas id="board-scene" tabindex="0" aria-label="棋盤球場：點擊或拖拉後放開發射，左右鍵瞄準，空白鍵擲骰或發射"></canvas><div id="board-labels" aria-hidden="true"></div><p id="board-failure" role="alert" hidden>無法啟動 3D 畫面。請重新開啟此檔案，或使用已啟用 WebGL 的瀏覽器。</p></section>
      <aside class="board-controls" aria-label="回合操作">
        <div class="board-die-line"><strong id="board-die">骰子 —</strong><span id="board-position">00 START</span></div>
        <button id="board-roll" disabled>擲骰 · 空白鍵</button>
        <label class="board-angle">發射方向 <output id="board-angle-value">−90°</output><input id="board-angle" type="range" min="-165" max="-15" step="1" value="-90" aria-label="發射方向，角度" disabled></label>
        <button id="board-fire" disabled>發射</button>
        <p id="board-next"></p><p id="board-wave"></p><p id="board-bonus"></p>
        <div class="board-utilities"><button id="board-mute" aria-pressed="false">音效：開</button><button id="board-restart">重來</button></div>
      </aside>
    </div>
    <p id="board-result" role="status" hidden></p>
    <footer class="board-help"><p>擲骰 → 走格 → 射 3 發 → 等球停下（最多 6 秒）→ Boss 鐘 +1。</p><p>點球場或拖拉後放開發射；← → 瞄準、空白鍵擲骰／發射。Boss 歸零獲勝，怪物超過 10 隻失敗。</p></footer>`;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
  get<HTMLAnchorElement>('board-realtime').href = location.pathname;
  const canvas = get<HTMLCanvasElement>('board-scene'), stage = get('board-stage'), labels = get('board-labels');
  const roll = get<HTMLButtonElement>('board-roll'), fire = get<HTMLButtonElement>('board-fire');
  const aim = get<HTMLInputElement>('board-angle'), seed = get<HTMLInputElement>('board-seed');
  const game = new Game(C.seed, 'board'), sound = new Sound();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
  catch { get('board-failure').hidden = false; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene(); scene.background = new THREE.Color(colors.background);
  const camera = new THREE.OrthographicCamera(-7, 7, 6.4, -6.4, .1, 80);
  camera.position.set(0, 15, 6.5); camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9299a1, 2.2));
  const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(-4, 8, 5); scene.add(light);
  const mat = (color: number) => new THREE.MeshLambertMaterial({ color });
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z); scene.add(object); return object;
  }
  function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
    return mesh(new THREE.BoxGeometry(w, h, d), mat(color), x, y, z);
  }
  box(8, .18, 6.8, colors.table, 0, -.12);
  for (const x of [-4.07, 4.07]) box(.14, .22, 6.94, colors.edge, x);
  for (const z of [-3.47, 3.47]) box(8.28, .22, .14, colors.edge, 0, 0, z);
  const tiles = C.board.tiles.map((tile, i) => {
    const [x, z] = positions[i];
    const object = box(1.82, .20, 1.5, colors[tile.kind], x, -.04, z);
    const label = document.createElement('div'); label.className = 'board-tile-label';
    label.innerHTML = `<b>${String(i).padStart(2, '0')}</b> ${tile.kind}${tile.kind === 'TUNE' ? `<small>${C.materials[tile.material].name}</small>` : ''}`;
    labels.append(label); return { object, label };
  });
  const pathPoints = positions.map(([x, z]) => new THREE.Vector3(x, -.17, z)); pathPoints.push(pathPoints[0]);
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pathPoints), new THREE.LineBasicMaterial({ color: colors.edge })));
  const pawn = mesh(new THREE.CylinderGeometry(.22, .22, .48, 20), mat(colors.pawn));
  const boss = mesh(new THREE.CylinderGeometry(C.boss.radius * .01, C.boss.radius * .01, .55, 24), mat(colors.boss), 0, .27, 0);
  const launcher = mesh(new THREE.CylinderGeometry(.23, .23, .15, 20), mat(colors.pawn), 0, .08, (C.launcher.y - 340) * .01);
  const aimLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: colors.pawn })); scene.add(aimLine);
  const diceMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const dice = mesh(new THREE.BoxGeometry(.72, .72, .72), diceMaterial, -3.15, .38, 2.62);
  const diceTextures = Array.from({ length: 6 }, (_, i) => {
    const surface = document.createElement('canvas'); surface.width = surface.height = 128;
    const ctx = surface.getContext('2d')!; ctx.fillStyle = '#f7f7f8'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#626975'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, 124, 124);
    const pips = [[[64, 64]], [[32, 32], [96, 96]], [[32, 32], [64, 64], [96, 96]],
      [[32, 32], [96, 32], [32, 96], [96, 96]], [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]],
      [[32, 28], [96, 28], [32, 64], [96, 64], [32, 100], [96, 100]]][i];
    ctx.fillStyle = '#19212b';
    for (const [x, y] of pips) { ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); }
    const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  });
  diceMaterial.map = diceTextures[0]; dice.rotation.y = .25;
  const ballGeometry = new THREE.SphereGeometry(C.ball.radius * .01, 16, 12);
  const ballMaterials = colors.materials.map(color => mat(color));
  const ringGeometry = new THREE.TorusGeometry(.20, .023, 6, 24);
  const resonanceMaterial = new THREE.MeshBasicMaterial({ color: colors.resonance });
  const balls = new Map<number, { sphere: THREE.Mesh; ring: THREE.Mesh; label: HTMLElement }>();
  const monsters = new Map<number, THREE.Mesh>();
  const monsterGeometry = new THREE.BoxGeometry(.42, .46, .42), monsterMaterial = mat(colors.monster);
  const effectGeometry = new THREE.TorusGeometry(1, .012, 5, 48);
  const effects = new Map<object, THREE.Mesh>();
  let seen = new WeakSet<object>(), previous = performance.now(), accumulator = 0, angle = -Math.PI / 2;
  let drag: number | null = null, stopped = false, frameCount = 0, lastDie = 0;
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
  roll.addEventListener('click', () => { unlock(); game.rollBoard(); canvas.focus({ preventScroll: true }); });
  fire.addEventListener('click', () => { unlock(); game.fire(angle); });
  aim.addEventListener('input', () => setAngle(Number(aim.value) * Math.PI / 180));
  get('board-mute').addEventListener('click', () => { unlock(); sound.toggle(); text('board-mute', sound.muted ? '音效：關' : '音效：開'); get('board-mute').setAttribute('aria-pressed', String(sound.muted)); });
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || game.board!.phase !== 'shooting' || game.status !== 'playing') return;
    const p = world(e.clientX, e.clientY); if (!p || p.x < 0 || p.x > C.width || p.y < 0 || p.y > C.height) return;
    unlock(); drag = e.pointerId; canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true }); aimAt(e);
  });
  canvas.addEventListener('pointermove', e => { if (drag === e.pointerId) aimAt(e); });
  canvas.addEventListener('pointerup', e => {
    if (drag !== e.pointerId) return;
    aimAt(e); game.fire(angle); drag = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  });
  for (const event of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(event, () => { drag = null; });
  window.addEventListener('blur', () => { drag = null; });
  document.addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement || game.status !== 'playing') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { setAngle(angle + (e.key === 'ArrowLeft' ? -.08 : .08)); e.preventDefault(); }
    if (e.code === 'Space') { e.preventDefault(); if (e.repeat) return; unlock(); if (game.board!.phase === 'roll') game.rollBoard(); else game.fire(angle); }
  });
  function resetVisuals() {
    for (const item of balls.values()) { scene.remove(item.sphere, item.ring); item.label.remove(); } balls.clear();
    for (const item of monsters.values()) scene.remove(item); monsters.clear();
    for (const item of effects.values()) { scene.remove(item); (item.material as THREE.Material).dispose(); } effects.clear();
    seen = new WeakSet(); drag = null; accumulator = 0; previous = performance.now(); setAngle(-Math.PI / 2);
    lastDie = 0; diceMaterial.map = diceTextures[0]; dice.rotation.set(0, .25, 0);
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
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight, aspect = w / h;
    const height = Math.max(11.4, 13 / aspect);
    camera.left = -height * aspect / 2; camera.right = height * aspect / 2;
    camera.top = height / 2; camera.bottom = -height / 2;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(); renderer.setSize(w, h, false);
  }
  new ResizeObserver(resize).observe(stage); resize();
  document.addEventListener('visibilitychange', () => { previous = performance.now(); accumulator = 0; drag = null; });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); stopped = true; get('board-failure').hidden = false; roll.disabled = fire.disabled = true; });
  function banner() {
    const board = game.board!, tile = C.board.tiles[board.position];
    if (game.status === 'ready') return '擲骰後自動走格，落格效果會改變這一回合。';
    if (board.phase === 'rolling') return '擲 1 顆六面骰…';
    if (board.phase === 'moving') return `順時針前進 · 還有 ${board.stepsLeft} 格`;
    if (board.phase === 'roll') return `回合結束 · Boss 鐘 ${board.bossClock} · 請擲骰`;
    if (tile.kind === 'SURGE') return 'SURGE · 全場球喚醒，震盪各 +1';
    if (tile.kind === 'TUNE') return `TUNE · ${C.materials[tile.material].name}：本回合門檻 −1，同頻倍率 ×1.5`;
    if (tile.kind === 'EVENT') return '事件（之後加）';
    return `START · 繞圈完成，下一回合 +${C.board.lapBonusShots} 發`;
  }
  function addBall(b: Ball) {
    const sphere = mesh(ballGeometry, ballMaterials[b.material]);
    const ring = mesh(ringGeometry, resonanceMaterial); ring.rotation.x = -Math.PI / 2;
    const label = document.createElement('span'); label.className = 'board-ball-label'; label.textContent = String(b.id); labels.append(label);
    const item = { sphere, ring, label }; balls.set(b.id, item); return item;
  }
  function render() {
    const board = game.board!, running = game.status === 'playing', shooting = running && board.phase === 'shooting';
    text('board-phase', game.status === 'ready' ? '準備開始' : game.status === 'won' ? '勝利' : game.status === 'lost' ? '失敗' : phaseNames[board.phase]);
    text('board-turn', `回合 ${board.turn}`); text('board-shots', `剩餘 ${board.shotsLeft} 發`); text('board-clock', `Boss 鐘 ${board.bossClock}`);
    text('board-banner', banner()); text('board-die', `骰子 ${board.die || '—'}`);
    text('board-position', `${String(board.position).padStart(2, '0')} ${C.board.tiles[board.position].kind}`);
    text('board-next', `下一球：${C.materials[game.nextMaterial].name} · 留場 ${game.balls.length} 顆`);
    text('board-wave', `第 ${game.wave} 波 · ${C.board.waveEveryTurns - board.bossClock % C.board.waveEveryTurns} 回合後下一波`);
    text('board-bonus', `下一回合額外 ${board.nextTurnBonus} 發 · 已繞 ${board.laps} 圈`);
    text('board-monsters', `怪物 ${game.monsters.length} / ${C.monsters.loseAbove}`);
    text('board-hp-value', `${game.boss.hp} / ${game.boss.maxHp}`); get<HTMLProgressElement>('board-hp').value = game.boss.hp;
    roll.disabled = !running || board.phase !== 'roll'; fire.disabled = !shooting || game.tick - game.lastShotTick < C.launcher.intervalTicks; aim.disabled = !shooting;
    get('board-result').hidden = game.status !== 'won' && game.status !== 'lost';
    if (game.status === 'won' || game.status === 'lost') text('board-result', `${game.status === 'won' ? 'Boss 擊破，獲勝！' : '怪物超過 10 隻，這局結束。'} ${board.turn} 回合 · ${game.shots} 發 · 按「重來」可用同一種子再玩。`);
    if (board.die && board.die !== lastDie) { lastDie = board.die; diceMaterial.map = diceTextures[board.die - 1]; }
    if (board.phase === 'rolling' && !reduced) dice.rotation.set(game.tick * .13, game.tick * .09, game.tick * .06);
    else dice.rotation.set(0, .25, 0);
    const rect = canvas.getBoundingClientRect();
    function labelAt(label: HTMLElement, x: number, z: number, y: number) {
      const p = new THREE.Vector3(x, y, z).project(camera);
      label.style.transform = `translate(${(p.x + 1) * rect.width / 2}px,${(1 - p.y) * rect.height / 2}px) translate(-50%,-50%)`;
    }
    tiles.forEach(({ object, label }, i) => {
      const selected = i === board.position, landed = selected && board.landed;
      (object.material as THREE.MeshLambertMaterial).color.setHex(landed ? colors.landed : colors[C.board.tiles[i].kind]);
      label.dataset.active = String(selected); labelAt(label, positions[i][0], positions[i][1] - .22, .13);
    });
    pawn.position.set(positions[board.position][0] + .58, .38, positions[board.position][1] + .46);
    for (const b of game.balls) {
      const item = balls.get(b.id) ?? addBall(b), x = (b.x - 400) * .01, z = (b.y - 340) * .01;
      item.sphere.position.set(x, .14, z); item.ring.position.set(x, .025, z); item.ring.visible = b.resonant;
      labelAt(item.label, x, z, .32);
    }
    for (const [id, item] of monsters) if (!game.monsters.some(m => m.id === id)) { scene.remove(item); monsters.delete(id); }
    for (const m of game.monsters) {
      if (!monsters.has(m.id)) monsters.set(m.id, mesh(monsterGeometry, monsterMaterial, (m.x - 400) * .01, .23, (m.y - 340) * .01));
    }
    for (const e of game.effects) {
      if (seen.has(e)) continue; seen.add(e); sound.play(e, game.phase === 'active');
      if ((e.kind === 'burst' || e.kind === 'resonate' || e.kind === 'release') && effects.size < 32) {
        const ring = mesh(effectGeometry, new THREE.MeshBasicMaterial({ color: colors.resonance, transparent: true, opacity: .6 }), (e.x - 400) * .01, .04, (e.y - 340) * .01);
        ring.rotation.x = -Math.PI / 2; effects.set(e, ring);
      }
    }
    for (const [key, ring] of effects) {
      const e = key as typeof game.effects[number], age = (game.tick - e.tick) / C.feedback.lifetimeTicks;
      if (age >= 1) { scene.remove(ring); (ring.material as THREE.Material).dispose(); effects.delete(key); continue; }
      ring.scale.setScalar(Math.min(3.4, e.radius * .01) * (reduced ? 1 : .3 + age * .7));
      (ring.material as THREE.MeshBasicMaterial).opacity = (1 - age) * (reduced ? .25 : .6);
    }
    boss.visible = game.boss.hp > 0;
    aimLine.visible = shooting;
    const z = (C.launcher.y - 340) * .01;
    aimLine.geometry.setFromPoints([new THREE.Vector3(0, .08, z), new THREE.Vector3(Math.cos(angle) * 1.2, .08, z + Math.sin(angle) * 1.2)]);
    launcher.rotation.y = -angle;
    renderer.render(scene, camera);
    canvas.dataset.ready = 'true'; canvas.dataset.status = game.status; canvas.dataset.phase = board.phase; canvas.dataset.position = String(board.position);
  }
  // 驗收只讀取真實規則與投影；遊戲操作仍走 DOM 輸入。
  Object.assign(window, { boardEvidence: {
    snapshot: () => ({ game: game.snapshot(), frameCount, renderedBalls: balls.size, renderedMonsters: monsters.size, drawCalls: renderer.info.render.calls, audio: sound.context?.state ?? 'not-started' }),
    project,
  } });
  function frame(now: number) {
    if (stopped) return; requestAnimationFrame(frame);
    const elapsed = Math.max(0, (now - previous) / 1000); previous = now;
    if (document.hidden) return;
    accumulator += Math.min(elapsed, .25);
    while (accumulator >= C.dt) { game.step(); accumulator -= C.dt; }
    frameCount++; render();
  }
  render(); requestAnimationFrame(frame);
}
