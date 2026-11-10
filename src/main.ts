import './style.css';
import { CONFIG as C } from './config';
import { Game, type Target } from './game';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;
const overlay = document.querySelector<HTMLElement>('#overlay')!;
const title = document.querySelector<HTMLElement>('#overlay-title')!;
const copy = document.querySelector<HTMLElement>('#overlay-text')!;
const seedInput = document.querySelector<HTMLInputElement>('#seed')!;
const seedLabel = document.querySelector<HTMLElement>('#seed-label')!;
const start = document.querySelector<HTMLButtonElement>('#start')!;
const hud = document.querySelector<HTMLElement>('#hud')!;
const hint = document.querySelector<HTMLElement>('#hint')!;
const next = document.querySelector<HTMLElement>('#next')!;
const game = new Game();
let aim: { x: number; y: number; pointer: number } | null = null;
let accumulator = 0, previous = performance.now(), shownStatus = game.status;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function reset() {
  aim = null; game.reset(); accumulator = 0; previous = performance.now();
  title.textContent = '讓碰撞，連成爆發。';
  copy.innerHTML = '按住下方發射圈，朝想射的方向拖拉 → 放開。<br>外圈越亮越接近共振；雙圈球再碰撞就會爆發。';
  seedLabel.hidden = false; seedInput.value = String(game.seed); start.textContent = '開始';
  overlay.hidden = false; shownStatus = 'ready'; hint.textContent = '拖拉 → 放開；扇形內隨機發射。';
  document.querySelector('#outcome')!.textContent = ''; start.focus();
}
document.querySelector('#restart')!.addEventListener('click', reset);
start.addEventListener('click', () => {
  if (game.status === 'won' || game.status === 'lost') { reset(); return; }
  if (!seedInput.reportValidity()) return;
  game.reset(Number(seedInput.value)); game.start(); overlay.hidden = true;
  accumulator = 0; previous = performance.now(); shownStatus = 'playing';
});
function point(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX-rect.left)*C.width/rect.width, y: (e.clientY-rect.top)*C.height/rect.height };
}
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || game.status !== 'playing') return;
  const p = point(e);
  if (Math.hypot(p.x-C.launcher.x, p.y-C.launcher.y) > 48) {
    hint.textContent = '請從下方的發射圈開始拖拉。'; return;
  }
  aim = { ...p, pointer: e.pointerId }; canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => { if (aim?.pointer === e.pointerId) aim = { ...point(e), pointer: e.pointerId }; });
canvas.addEventListener('pointerup', e => {
  if (!aim || aim.pointer !== e.pointerId) return;
  const p = point(e), dx = p.x-C.launcher.x, dy = p.y-C.launcher.y;
  if (Math.hypot(dx,dy) >= C.launcher.minDrag) {
    hint.textContent = game.fire(Math.atan2(dy,dx)) ? '球會一直留在場上；讓下一球接上連鎖。' : '稍等發射圈恢復，再拖拉一次。';
  }
  aim = null; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
});
for (const event of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(event, () => { aim = null; });
window.addEventListener('blur', () => { aim = null; });
document.addEventListener('visibilitychange', () => { aim = null; accumulator = 0; previous = performance.now(); });

function circle(x: number, y: number, radius: number) { ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); }
function target(t: Target) {
  if (t.hp <= 0) return;
  ctx.fillStyle = game.tick < t.flashUntil ? '#eeeeee' : '#555555';
  circle(t.x,t.y,t.radius); ctx.fill(); ctx.strokeStyle = '#aaaaaa'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = game.tick < t.flashUntil ? '#181818' : '#ffffff';
  ctx.font = t.kind === 'boss' ? 'bold 18px system-ui' : '12px system-ui';
  ctx.fillText(t.kind === 'boss' ? 'BOSS' : '怪',t.x,t.y+5);
  const w = t.radius*2;
  ctx.fillStyle = '#111'; ctx.fillRect(t.x-w/2,t.y-t.radius-13,w,6);
  ctx.fillStyle = '#ddd'; ctx.fillRect(t.x-w/2,t.y-t.radius-13,w*t.hp/t.maxHp,6);
}
function draw() {
  ctx.clearRect(0,0,C.width,C.height); ctx.fillStyle = '#252525'; ctx.fillRect(0,0,C.width,C.height);
  ctx.textAlign = 'center'; target(game.boss); game.monsters.forEach(target);
  if (aim && Math.hypot(aim.x-C.launcher.x, aim.y-C.launcher.y) >= C.launcher.minDrag) {
    const angle = Math.atan2(aim.y-C.launcher.y, aim.x-C.launcher.x);
    ctx.beginPath(); ctx.moveTo(C.launcher.x,C.launcher.y);
    ctx.arc(C.launcher.x,C.launcher.y,130,angle-C.launcher.coneHalfAngle,angle+C.launcher.coneHalfAngle);
    ctx.closePath(); ctx.fillStyle = '#ffffff25'; ctx.fill(); ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.stroke();
  }
  for (const b of game.balls) {
    const progress = b.oscillation/C.resonance.threshold;
    const jiggle = reducedMotion.matches ? 0 : Math.sin(game.tick*0.7+b.id)*progress*1.2;
    const x = b.x+jiggle, y = b.y;
    const shade = Math.min(245,C.materials[b.material].shade+progress*65);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`; circle(x,y,C.ball.radius); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.2+progress*0.8})`; ctx.lineWidth = 1+progress*3;
    circle(x,y,C.ball.radius+3); ctx.stroke();
    if (b.resonant) {
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff';
      circle(x,y,C.ball.radius+8+(reducedMotion.matches ? 0 : Math.sin(game.tick*0.1)*1.5)); ctx.stroke();
    }
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
    if (b.material >= 1) { circle(x,y,C.ball.radius-3); ctx.stroke(); }
    if (b.material >= 2) { circle(x,y,C.ball.radius-5); ctx.stroke(); }
    ctx.fillStyle = '#111'; ctx.font = 'bold 11px system-ui'; ctx.fillText(String(b.id),x,y+4);
  }
  for (const e of game.effects) {
    const age = game.tick-e.tick;
    const duration = e.kind === 'burst' ? C.feedback.burstTicks : C.feedback.lifetimeTicks;
    if (age >= duration) continue;
    const p = age/duration; ctx.globalAlpha = 1-p;
    if (e.kind === 'damage') {
      ctx.font = 'bold 22px system-ui'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
      const y = e.y-(reducedMotion.matches ? 12 : p*35);
      ctx.strokeText(`−${e.value}`,e.x,y); ctx.fillText(`−${e.value}`,e.x,y);
    } else {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = e.kind === 'burst' ? (e.amplified ? 6 : 3) : 2;
      ctx.setLineDash(e.kind === 'interference' ? [5,5] : []);
      circle(e.x,e.y,e.radius*(reducedMotion.matches ? 1 : 0.6+p*0.4)); ctx.stroke();
      if (e.kind === 'burst') {
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = (1-p)*0.15; ctx.fill(); ctx.globalAlpha = 1-p;
        ctx.font = 'bold 14px system-ui'; ctx.fillText(`${e.amplified ? '同頻放大' : '爆發'} · ${e.value} 層`, e.x,e.y-e.radius-8);
      } else if (e.kind === 'interference') {
        ctx.font = '13px system-ui'; ctx.fillStyle = '#ddd'; ctx.fillText('干擾',e.x,e.y-24);
      } else if (e.kind === 'ignite') {
        ctx.font = '13px system-ui'; ctx.fillStyle = '#fff'; ctx.fillText('點燃',e.x,e.y-24);
      }
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = game.tick-game.lastShotTick >= C.launcher.intervalTicks ? '#eee' : '#666';
  ctx.lineWidth = 2; circle(C.launcher.x,C.launcher.y,24); ctx.stroke();
  ctx.font = '14px system-ui'; ctx.fillStyle = '#ddd'; ctx.fillText('從這裡拖拉', C.launcher.x, C.launcher.y+42);
  hud.textContent = `Boss ${game.boss.hp} / ${C.boss.hp}　怪物 ${game.monsters.length} / ${C.monsters.loseAbove}　已發射 ${game.shots}`;
  next.textContent = `下一球：${C.materials[game.nextMaterial].name}　｜　實心、環紋、雙紋代表不同頻率`;
  canvas.dataset.shots = String(game.shots); canvas.dataset.status = game.status;
  if (game.status !== shownStatus && (game.status === 'won' || game.status === 'lost')) {
    aim = null; overlay.hidden = false; seedLabel.hidden = true;
    title.textContent = game.status === 'won' ? 'Boss 擊破！' : '怪物塞滿了球場';
    copy.textContent = `發射 ${game.shots} 次，觸發 ${game.events.length} 次爆發。`;
    start.textContent = '重來'; shownStatus = game.status;
    document.querySelector('#outcome')!.textContent = title.textContent; start.focus();
  }
}
function frame(now: number) {
  if (!document.hidden && game.status === 'playing') {
    accumulator += Math.min((now-previous)/1000,0.25);
    while (accumulator >= C.dt) { game.step(); accumulator -= C.dt; }
  }
  previous = now; draw(); requestAnimationFrame(frame);
}
// 僅限本機開發時的唯讀驗證介面，正式靜態成品不暴露遊戲物件。
if (import.meta.env.DEV) Object.assign(window, { resonanceDebug: { snapshot: () => game.snapshot() } });
requestAnimationFrame(frame);
