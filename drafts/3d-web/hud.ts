import type { Game, Effect } from '../../src/game';
import { CONFIG as C } from './adapter';
import { Sound } from '../../src/audio';
import { damagePosition } from './presentation';

export function createHUD(game:Game,resetScene:()=>void) {
  const get=(id:string)=>document.getElementById(id)!;
  const sound=new Sound(), overlay=get('overlay'), start=get('start') as HTMLButtonElement;
  const seed=get('seed') as HTMLInputElement, replay=get('replay'), layer=get('labels');
  const damageLabels=new Map<Effect,HTMLElement>(), bars=new Map<number,HTMLElement>();
  let lastReplay=-1,shown='ready',replayCount=0;
  const reset=()=>{game.reset();resetScene();sound.voices=Math.max(0,sound.voices);lastReplay=-1;replayCount=0;shown='ready';
    damageLabels.clear();bars.clear();layer.replaceChildren();replay.hidden=true;overlay.hidden=false;
    get('overlay-title').textContent='讓碰撞，連成爆發。';get('overlay-text').textContent='從下方發射座朝場內拖拉後放開。亮圈累積成共振，多球同步就會相變。';
    get('seed-label').hidden=false;seed.value=String(game.seed);start.textContent='開始';get('outcome').textContent='';start.focus();};
  get('restart').addEventListener('click',reset);
  start.addEventListener('click',()=>{sound.unlock();if(game.status==='won'||game.status==='lost'){reset();return;}
    if(!seed.reportValidity())return;game.reset(Number(seed.value));resetScene();game.start();overlay.hidden=true;shown='playing';get('scene').focus();});
  const mute=get('mute');mute.addEventListener('click',()=>{sound.unlock();sound.toggle();mute.textContent=sound.muted?'音效：關':'音效：開';mute.setAttribute('aria-pressed',String(sound.muted));});
  function update(project:(x:number,y:number,height?:number)=>{x:number,y:number},width:number,height:number) {
    const hp=get('boss-hp') as HTMLProgressElement;hp.max=game.boss.maxHp;hp.value=game.boss.hp;
    get('boss-value').textContent=`${game.boss.hp} / ${game.boss.maxHp}`;
    const remaining=Math.max(0,Math.ceil(C.difficulty.firstWaveSeconds+game.wave*C.difficulty.waveSeconds-game.tick*C.dt));
    get('wave').textContent=`第 ${game.wave} 波 · ${remaining} 秒後下一波`;
    get('monsters').textContent=`怪物 ${game.monsters.length} / ${C.monsters.loseAbove}`;
    get('next').textContent=`下一球：${C.materials[game.nextMaterial].name}`;
    get('wave-banner').hidden=game.wave===0||game.tick-game.waveAt>240;
    get('wave-banner').textContent=game.upgraded?'壓力升級':`第 ${game.wave} 波`;
    const phase=get('phase-banner');phase.hidden=game.phase==='idle';phase.textContent=game.phase==='active'?'SHIFT · 全場同頻，準備一起釋放':'正在同步 · 即將相變';
    const liveIds=new Set(game.monsters.map(m=>m.id));
    for(const [id,bar] of bars)if(!liveIds.has(id)){bar.remove();bars.delete(id);}
    for(const m of game.monsters){let bar=bars.get(m.id);if(!bar){bar=document.createElement('div');bar.className='target-bar';bar.innerHTML='<i></i>';layer.append(bar);bars.set(m.id,bar);}
      const p=project(m.x,m.y,.85);bar.style.transform=`translate(${p.x-18}px,${p.y}px)`;(bar.firstElementChild as HTMLElement).style.width=`${100*m.hp/m.maxHp}%`;}
    const liveEffects=new Set(game.effects.filter(e=>e.kind==='damage'||e.kind==='burst'&&e.value>=2));
    for(const [e,label] of damageLabels)if(!liveEffects.has(e)){label.remove();damageLabels.delete(e);}
    for(const e of liveEffects){let label=damageLabels.get(e);if(!label){label=document.createElement('span');label.className=e.kind==='damage'?'damage':'chain';layer.append(label);damageLabels.set(e,label);}
      const age=(game.tick-e.tick)*C.dt,p=project(e.x,e.y,.85),pos=damagePosition(p.x,p.y,width,height,age);
      label.textContent=e.kind==='damage'?`−${e.value}`:`${e.value} 層`;label.style.transform=`translate(${pos.x}px,${pos.y}px) translate(-50%,-50%)`;label.style.opacity=String(Math.max(0,1-age/.6));}
    const card=game.replays.at(-1);replay.hidden=!card||game.tick-card.tick>600;
    if(card&&card.tick!==lastReplay){lastReplay=card.tick;replayCount++;replay.replaceChildren();
      const title=document.createElement('strong');title.textContent=`${card.shift?'SHIFT 釋放':'連鎖回放'} · ${card.depth} 層`;
      const ids=document.createElement('p');ids.textContent=card.ballIds.map(id=>`#${id}`).join(' → ');
      const summary=document.createElement('p');summary.textContent=`擊殺 ${card.kills}　Boss −${card.bossDamage}`;replay.append(title,ids,summary);}
    if(game.status!==shown&&(game.status==='won'||game.status==='lost')){shown=game.status;overlay.hidden=false;get('seed-label').hidden=true;
      get('overlay-title').textContent=game.status==='won'?'Boss 擊破！':'怪物塞滿了球場';
      get('overlay-text').textContent=`${Math.round(game.tick*C.dt)} 秒 · ${game.shots} 次發射 · ${game.shifts.filter(s=>s.kind==='active').length} 次相變`;
      start.textContent='重來';get('outcome').textContent=get('overlay-title').textContent;start.focus();}
  }
  return {sound,update,reset,evidence:()=>({replays:replayCount,labels:damageLabels.size,bars:bars.size,audio:sound.context?.state??'not-started',notes:sound.played,muted:sound.muted})};
}
