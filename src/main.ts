import './style.css';
import { CONFIG as C } from './config';
import { Game, type Target, type Effect } from './game';
import { Sound } from './audio';

const canvas=document.querySelector<HTMLCanvasElement>('#game')!, ctx=canvas.getContext('2d')!;
const overlay=document.querySelector<HTMLElement>('#overlay')!, title=document.querySelector<HTMLElement>('#overlay-title')!;
const copy=document.querySelector<HTMLElement>('#overlay-text')!, seedInput=document.querySelector<HTMLInputElement>('#seed')!;
const seedLabel=document.querySelector<HTMLElement>('#seed-label')!, start=document.querySelector<HTMLButtonElement>('#start')!;
const hud=document.querySelector<HTMLElement>('#hud')!, hint=document.querySelector<HTMLElement>('#hint')!, next=document.querySelector<HTMLElement>('#next')!;
const replay=document.querySelector<HTMLElement>('#replay')!, phaseLabel=document.querySelector<HTMLElement>('#phase')!;
const game=new Game(), sound=new Sound(), reduced=matchMedia('(prefers-reduced-motion: reduce)');
const styles={
  glow:{bg:'#0b1421',ink:'#e4f4fa',muted:'#91afc0',line:'#385368',accent:'#79efd2',target:'#263c51',danger:'#ff9c91',phaseBg:'#263452',phase:'#ffe2a1'},
  paper:{bg:'#f4ecda',ink:'#302e29',muted:'#72634f',line:'#b2a58d',accent:'#99452b',target:'#d3c6ac',danger:'#9f2828',phaseBg:'#d8e5dc',phase:'#1f6251'},
  minimal:{bg:'#f6f6f3',ink:'#131923',muted:'#565b63',line:'#b6b8bc',accent:'#174ad5',target:'#dbdde1',danger:'#174ad5',phaseBg:'#131923',phase:'#91adff'},
};
type Style=keyof typeof styles; let style:Style='glow';
let aim:{x:number;y:number;pointer:number}|null=null, keyboardAngle=-Math.PI/2;
let accumulator=0, previous=performance.now(), shownStatus=game.status, visualTime=0;
let freeze=0, shake=0, recoil=0, flash=0, lastFlash=-10, nextFreezeAt=0;
let seen=new WeakSet<Effect>();
type Particle={x:number;y:number;vx:number;vy:number;life:number;max:number;size:number};
let particles:Particle[]=[]; const trails=new Map<number,{x:number;y:number}[]>();
const counts={impact:0,ignite:0,burst:0,shift:0,release:0,launch:0,replay:0}; let lastReplay=-1;
function palette(){return styles[style];}
function choose(value:Style){style=value; document.body.dataset.style=style;
  document.querySelectorAll<HTMLButtonElement>('[data-style-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.styleChoice===style)));
}
document.querySelectorAll<HTMLButtonElement>('[data-style-choice]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.styleChoice as Style)));
const mute=document.querySelector<HTMLButtonElement>('#mute')!;
mute.addEventListener('click',()=>{sound.unlock();sound.toggle();mute.textContent=sound.muted?'音效：關':'音效：開';mute.setAttribute('aria-pressed',String(sound.muted));});
function reset(){
  aim=null;game.reset();accumulator=0;previous=performance.now();particles=[];trails.clear();seen=new WeakSet();freeze=shake=recoil=flash=0;lastReplay=-1;
  for(const key of Object.keys(counts) as (keyof typeof counts)[])counts[key]=0;
  title.textContent='讓碰撞，連成爆發。';copy.innerHTML='從下方發射圈，朝場內拖拉後放開。<br>只選方向，力道固定；亮起的球會接上連鎖。';
  seedLabel.hidden=false;seedInput.value=String(game.seed);start.textContent='開始';overlay.hidden=false;shownStatus='ready';
  document.querySelector<HTMLElement>('#style-picker')!.hidden=false;
  hint.textContent='拖拉 → 放開，或方向鍵調整、空白鍵發射。';document.querySelector('#outcome')!.textContent='';start.focus();
}
document.querySelector('#restart')!.addEventListener('click',reset);
start.addEventListener('click',()=>{sound.unlock();if(game.status==='won'||game.status==='lost'){reset();return;}if(!seedInput.reportValidity())return;
  game.reset(Number(seedInput.value));game.start();overlay.hidden=true;accumulator=0;previous=performance.now();shownStatus='playing';canvas.focus();
});
function point(e:PointerEvent){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*C.width/r.width,y:(e.clientY-r.top)*C.height/r.height};}
function shoot(angle:number){sound.unlock();const ok=game.fire(angle);if(ok){keyboardAngle=angle;hint.textContent='亮圈在累積。球停下後，下一球仍能把它撞醒。';}return ok;}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0||game.status!=='playing')return;sound.unlock();const p=point(e);
  if(Math.hypot(p.x-C.launcher.x,p.y-C.launcher.y)>52){hint.textContent='從下方發射圈開始拖拉。';return;}aim={...p,pointer:e.pointerId};canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{if(aim?.pointer===e.pointerId)aim={...point(e),pointer:e.pointerId};});
canvas.addEventListener('pointerup',e=>{if(!aim||aim.pointer!==e.pointerId)return;const p=point(e),dx=p.x-C.launcher.x,dy=p.y-C.launcher.y;
  if(Math.hypot(dx,dy)>=C.launcher.minDrag)shoot(Math.atan2(Math.min(-20,dy),dx));aim=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener('keydown',e=>{if(game.status!=='playing')return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){keyboardAngle=Math.max(-Math.PI+.2,Math.min(-.2,keyboardAngle+(e.key==='ArrowLeft'?-.12:.12)));e.preventDefault();}
  if(e.code==='Space'&&!e.repeat){e.preventDefault();shoot(keyboardAngle);}
});
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>aim=null);
window.addEventListener('blur',()=>aim=null);document.addEventListener('visibilitychange',()=>{aim=null;accumulator=0;previous=performance.now();});
function circle(x:number,y:number,r:number,fill?:string,stroke?:string,width=1){ctx.beginPath();ctx.arc(x,y,Math.max(.01,r),0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function line(x:number,y:number,xx:number,yy:number,color:string,width=1){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function scatter(e:Effect,n:number,power:number){for(let i=0;i<n;i++){const a=(i*2.399+e.tick*.31),v=(.4+(i%7)/7)*power;particles.push({x:e.x,y:e.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.3+(i%5)*.075,max:.6,size:1.5+i%3});}if(particles.length>600)particles.splice(0,particles.length-600);}
function feedback(){for(const e of game.effects){if(seen.has(e))continue;seen.add(e);sound.play(e,game.phase==='active');
  if(e.kind in counts)counts[e.kind as keyof typeof counts]++;
  if(e.kind==='impact'){const power=Math.min(1,e.value/1300);if(visualTime>=nextFreezeAt){freeze=.009+power*.024;nextFreezeAt=visualTime+.09;}shake=Math.max(shake,1+power*4);scatter(e,7,80+power*220);}
  if(e.kind==='launch'){recoil=22;shake=5;scatter(e,24,400);}
  if(e.kind==='burst'||e.kind==='death'){scatter(e,e.kind==='death'?32:22,360);shake=Math.max(shake,e.kind==='death'?6:4);}
  if(e.kind==='shift'||e.kind==='release'){shake=9;freeze=.065;nextFreezeAt=visualTime+.15;if(visualTime-lastFlash>1){flash=.13;lastFlash=visualTime;}}
}}
function target(t:Target){if(t.hp<=0)return;const p=palette(),hit=game.tick<t.flashUntil;ctx.save();ctx.translate(t.x+(hit&&!reduced.matches?Math.sin(visualTime*90)*3:0),t.y);
  if(t.kind==='boss'){ctx.save();ctx.rotate(Math.PI/4);ctx.strokeStyle=p.line;ctx.lineWidth=2;ctx.strokeRect(-43,-43,86,86);ctx.restore();}
  circle(0,0,t.radius,hit?'#ffffff':p.target,p.ink,style==='paper'?2.2:1.5);
  if(style==='paper')circle(1,-1,t.radius+2,undefined,p.line,.8);
  ctx.fillStyle=hit?'#131923':p.ink;ctx.font=t.kind==='boss'?'700 17px system-ui':'600 12px system-ui';ctx.fillText(t.kind==='boss'?'BOSS':'怪',0,5);
  ctx.fillStyle=p.line;ctx.fillRect(-t.radius,-t.radius-14,t.radius*2,4);ctx.fillStyle=p.accent;ctx.fillRect(-t.radius,-t.radius-14,t.radius*2*t.hp/t.maxHp,4);ctx.restore();
}
function draw(){const p=palette(),active=game.phase==='active',accent=active?p.phase:p.accent,ink=active&&style==='minimal'?'#f6f6f3':p.ink;
  ctx.fillStyle=active?p.phaseBg:p.bg;ctx.fillRect(0,0,800,680);ctx.save();
  if(!reduced.matches)ctx.translate(Math.sin(visualTime*97)*shake,Math.cos(visualTime*113)*shake-recoil*.15);
  ctx.strokeStyle=game.monsters.length>=7?p.danger:p.line;ctx.lineWidth=game.monsters.length>=7?4:1;ctx.strokeRect(8,8,784,664);
  if(style==='paper'){ctx.fillStyle=p.line;for(let i=0;i<130;i++){ctx.globalAlpha=.25;ctx.fillRect(16+(i*137)%770,16+(i*79)%645,1,1);}ctx.globalAlpha=1;}
  if(active){ctx.globalAlpha=.2;for(let i=0;i<8;i++){const y=65+i*80;line(10,y,790,y,accent,1);}ctx.globalAlpha=1;}
  ctx.textAlign='center';target(game.boss);game.monsters.forEach(target);
  if(active){ctx.globalAlpha=.55;for(let i=0;i<game.balls.length;i++){const a=game.balls[i];for(const b of game.balls.slice(i+1)){if(Math.hypot(a.x-b.x,a.y-b.y)<260)line(a.x,a.y,b.x,b.y,accent,1.3);}}ctx.globalAlpha=1;}
  for(const b of game.balls){const progress=b.oscillation/C.resonance.threshold;const j=reduced.matches?0:Math.sin(visualTime*52+b.id)*progress*1.5,x=b.x+j;
    const trail=trails.get(b.id)??[];if(!reduced.matches&&Math.hypot(b.vx,b.vy)>150){for(let i=1;i<trail.length;i++){ctx.globalAlpha=i/trail.length*.35;line(trail[i-1].x,trail[i-1].y,trail[i].x,trail[i].y,accent,2+i*.8);}ctx.globalAlpha=1;}
    if(style==='glow'){ctx.shadowColor=accent;ctx.shadowBlur=progress*18;}
    circle(x,b.y,14,progress>.65?accent:p.target,progress>.1?accent:ink,1.5+progress*2);ctx.shadowBlur=0;
    ctx.globalAlpha=.25+.75*progress;circle(x,b.y,19,undefined,accent,1+progress*2);ctx.globalAlpha=1;
    if(b.resonant)circle(x,b.y,24+(reduced.matches?0:Math.sin(visualTime*8)*1.5),undefined,accent,2);
    const material=active?game.phaseMaterial:b.material;for(let i=0;i<material;i++)circle(x,b.y,11-i*3,undefined,progress>.65?(active&&style==='minimal'?p.phaseBg:p.bg):ink,.8);
    ctx.font='700 10px system-ui';ctx.fillStyle=progress>.65?(active&&style==='minimal'?p.phaseBg:p.bg):ink;ctx.fillText(String(b.id),x,b.y+3.5);
  }
  const labels:{x:number;y:number;text:string;size:number;alpha:number}[]=[];
  for(const e of game.effects){const age=(game.tick-e.tick)/120,duration=e.kind==='ignite'?.62:e.kind==='burst'?.58:.6;if(age>duration)continue;const q=age/duration;ctx.globalAlpha=1-q;
    if(e.kind==='ignite'){line(e.fromX!,e.fromY!,e.x,e.y,accent,4*(1-q)+1);circle(e.x,e.y,18+q*20,undefined,accent,2);}
    if(e.kind==='burst'||e.kind==='release'){circle(e.x,e.y,12+e.radius*(1-(1-q)**3),undefined,accent,e.amplified?4:2);ctx.globalAlpha=(1-q)*.12;circle(e.x,e.y,20+q*35,accent);if(e.kind==='burst'&&e.value>=2)labels.push({x:e.x,y:e.y-30,text:`${e.value} 層`,size:32,alpha:1-q});}
    if(e.kind==='launch'){circle(e.x,e.y,22+q*55,undefined,accent,3*(1-q));if(q<.45){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.value);ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(10,-8);ctx.lineTo(60*(1-q),0);ctx.lineTo(10,8);ctx.fill();ctx.restore();}}
    if(e.kind==='interference'){ctx.setLineDash([5,5]);circle(e.x,e.y,e.radius+q*12,undefined,p.muted,2);ctx.setLineDash([]);}
    if(e.kind==='damage')labels.push({x:e.x,y:e.y-q*34,text:`−${e.value}`,size:22,alpha:1-q});ctx.globalAlpha=1;
  }
  for(const s of particles){ctx.globalAlpha=Math.min(1,s.life/.25);if(style==='minimal'){ctx.fillStyle=accent;ctx.fillRect(s.x,s.y,s.size*1.5,s.size*1.5);}else if(style==='paper')circle(s.x,s.y,s.size,ink);else line(s.x,s.y,s.x-s.vx*.015,s.y-s.vy*.015,accent,s.size*.6);}ctx.globalAlpha=1;
  for(const l of labels.slice(-18)){ctx.font=`700 ${l.size}px system-ui`;ctx.globalAlpha=l.alpha;ctx.lineWidth=4;ctx.strokeStyle=active?p.phaseBg:p.bg;ctx.fillStyle=ink;const x=Math.max(50,Math.min(750,l.x)),y=Math.max(32,l.y);ctx.strokeText(l.text,x,y);ctx.fillText(l.text,x,y);}ctx.globalAlpha=1;
  const lx=C.launcher.x,ly=C.launcher.y+recoil;
  if(aim||document.activeElement===canvas){const angle=aim?Math.atan2(Math.min(-20,aim.y-C.launcher.y),aim.x-C.launcher.x):keyboardAngle;
    ctx.beginPath();ctx.moveTo(lx,ly);ctx.arc(lx,ly,130,angle-C.launcher.coneHalfAngle,angle+C.launcher.coneHalfAngle);ctx.closePath();ctx.fillStyle=accent;ctx.globalAlpha=aim?.16:.06;ctx.fill();ctx.globalAlpha=.5;ctx.strokeStyle=accent;ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;}
  if(aim){const q=(visualTime*2)%1;ctx.globalAlpha=1-q;circle(lx,ly,26+q*23,undefined,accent,2);ctx.globalAlpha=1;}
  circle(lx,ly,24,p.bg,accent,2.5);circle(lx,ly,8,accent);ctx.fillStyle=ink;ctx.font='13px system-ui';ctx.fillText(aim?'力道固定 · 放開發射':'從這裡拖拉',lx,Math.min(668,ly+40));
  if(game.phase==='warning'){ctx.fillStyle=accent;ctx.globalAlpha=.1;ctx.fillRect(8,8,784,664);ctx.globalAlpha=1;ctx.font='700 30px system-ui';ctx.fillText('正在同步',400,118);}
  if(active){ctx.fillStyle=accent;ctx.font='800 44px system-ui';ctx.fillText('SHIFT',400,92);ctx.font='14px system-ui';ctx.fillText('同頻流動 · 即將一起釋放',400,120);}
  if(game.tick-game.waveAt<240&&game.wave>0){ctx.fillStyle=ink;ctx.font='700 22px system-ui';ctx.fillText(game.upgraded&&game.boss.hp<=game.boss.maxHp*.5?'壓力升級':`第 ${game.wave} 波`,400,165);}
  ctx.restore();if(flash>0&&!reduced.matches){ctx.globalAlpha=flash;ctx.fillStyle=accent;ctx.fillRect(0,0,800,680);ctx.globalAlpha=1;}
  hud.textContent=`Boss ${game.boss.hp} / ${C.boss.hp}　怪物 ${game.monsters.length} / 10`;
  const until=Math.max(0,Math.ceil((C.difficulty.firstWaveSeconds+game.wave*C.difficulty.waveSeconds)-game.tick*C.dt));
  next.textContent=`第 ${game.wave} 波 · ${until} 秒後下一波　｜　下一球：${C.materials[game.nextMaterial].name}`;
  phaseLabel.textContent=game.phase==='active'?'SHIFT · 全場同頻':game.phase==='warning'?'即將相變':game.monsters.length>=7?'危險 · 場邊正在擠滿':'累積 → 共振 → 連鎖';
  const card=game.replays.at(-1);replay.hidden=!card||game.tick-card.tick>600;
  if(card&&card.tick!==lastReplay){lastReplay=card.tick;counts.replay++;replay.replaceChildren();const heading=document.createElement('strong');heading.textContent=`${card.shift?'SHIFT 釋放':'連鎖回放'} · ${card.depth} 層`;
    const ids=document.createElement('p');ids.textContent=card.ballIds.map(id=>`#${id}`).join(' → ');const result=document.createElement('p');result.textContent=`擊殺 ${card.kills}　Boss −${card.bossDamage}`;replay.append(heading,ids,result);}
  canvas.dataset.shots=String(game.shots);canvas.dataset.status=game.status;canvas.dataset.phase=game.phase;
  if(game.status!==shownStatus&&(game.status==='won'||game.status==='lost')){aim=null;overlay.hidden=false;seedLabel.hidden=true;document.querySelector<HTMLElement>('#style-picker')!.hidden=true;
    title.textContent=game.status==='won'?'Boss 擊破！':'怪物塞滿了球場';copy.textContent=`${Math.round(game.tick*C.dt)} 秒 · 發射 ${game.shots} 次 · ${game.shifts.filter(s=>s.kind==='active').length} 次 SHIFT`;
    start.textContent='重來';shownStatus=game.status;document.querySelector('#outcome')!.textContent=title.textContent;start.focus();}
}
function frame(now:number){const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;visualTime+=dt;
  if(!document.hidden&&game.status==='playing'){
    // 停格只延遲顯示，物理仍以固定步長推進；輸入 tick 可重現，不讓高碰撞量拖慢局長。
    accumulator+=dt;while(accumulator>=C.dt){game.step();accumulator-=C.dt;}
    feedback();
  }
  for(const s of particles){s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.vx*=Math.exp(-3*dt);s.vy*=Math.exp(-3*dt);}particles=particles.filter(s=>s.life>0);
  shake*=Math.exp(-18*dt);recoil*=Math.exp(-17*dt);flash*=Math.exp(-10*dt);
  if(freeze>0&&!reduced.matches){freeze-=dt;}else{for(const b of game.balls){const list=trails.get(b.id)??[];list.push({x:b.x,y:b.y});if(list.length>8)list.shift();trails.set(b.id,list);}draw();}
  requestAnimationFrame(frame);
}
if(import.meta.env.DEV)Object.assign(window,{resonanceDebug:{snapshot:()=>game.snapshot(),feedback:()=>({...counts,audioState:sound.context?.state??'not-started',notes:sound.played,style})}});
choose('glow');requestAnimationFrame(frame);
