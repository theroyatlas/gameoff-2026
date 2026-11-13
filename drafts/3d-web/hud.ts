import { t, materialName } from './i18n';
import { language } from './language';
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
    get('overlay-title').textContent=t('rtIntro');get('overlay-text').textContent=t('rtIntroText');
    get('seed-label').hidden=false;seed.value=String(game.seed);start.textContent=t('start');get('outcome').textContent='';start.focus();};
  language.subscribe(() => { lastReplay=-1; if(game.status==='won'||game.status==='lost') shown=''; });
  get('restart').addEventListener('click',reset);
  start.addEventListener('click',()=>{sound.unlock();if(game.status==='won'||game.status==='lost'){reset();return;}
    if(!seed.reportValidity())return;game.reset(Number(seed.value));resetScene();game.start();overlay.hidden=true;shown='playing';get('scene').focus();});
  const mute=get('mute');mute.addEventListener('click',()=>{sound.unlock();sound.toggle();mute.textContent=sound.muted?t('soundOff'):t('soundOn');mute.setAttribute('aria-pressed',String(sound.muted));});
  function text(id:string,value:string){const node=get(id);if(node.textContent!==value)node.textContent=value;}
  function update(project:(x:number,y:number,height?:number)=>{x:number,y:number},width:number,height:number) {
    text('mute', sound.muted ? t('soundOff') : t('soundOn'));
    if(game.status==='ready') { text('overlay-title',t('rtIntro')); text('overlay-text',t('rtIntroText')); text('start',t('start')); }
    const hp=get('boss-hp') as HTMLProgressElement;if(hp.max!==game.boss.maxHp)hp.max=game.boss.maxHp;if(hp.value!==game.boss.hp)hp.value=game.boss.hp;
    text('boss-value',`${game.boss.hp} / ${game.boss.maxHp}`);
    const remaining=Math.max(0,Math.ceil(C.difficulty.firstWaveSeconds+game.wave*C.difficulty.waveSeconds-game.tick*C.dt));
    text('wave',t('rtWave', { v0: game.wave, v1: remaining }));
    text('monsters',t('monsters', { v0: game.monsters.length, v1: C.monsters.loseAbove }));
    text('next',t('rtNext', { v0: materialName(game.nextMaterial) }));
    get('wave-banner').hidden=game.wave===0||game.tick-game.waveAt>240;
    text('wave-banner',game.upgraded?t('upgraded'):t('waveNumber', { v0: game.wave }));
    const phase=get('phase-banner');phase.hidden=game.phase==='idle';text('phase-banner',game.phase==='active'?t('shiftBanner'):t('shiftWarning'));
    const liveIds=new Set(game.monsters.map(m=>m.id));
    for(const [id,bar] of bars)if(!liveIds.has(id)){bar.remove();bars.delete(id);}
    for(const m of game.monsters){let bar=bars.get(m.id);if(!bar){bar=document.createElement('div');bar.className='target-bar';bar.innerHTML='<i></i>';layer.append(bar);bars.set(m.id,bar);}
      const p=project(m.x,m.y,.85);bar.style.transform=`translate(${p.x-18}px,${p.y}px)`;(bar.firstElementChild as HTMLElement).style.width=`${100*m.hp/m.maxHp}%`;}
    const liveEffects=new Set(game.effects.filter(e=>e.kind==='damage'||e.kind==='burst'&&e.value>=2));
    for(const [e,label] of damageLabels)if(!liveEffects.has(e)){label.remove();damageLabels.delete(e);}
    for(const e of liveEffects){let label=damageLabels.get(e);if(!label){label=document.createElement('span');label.className=e.kind==='damage'?'damage':'chain';layer.append(label);damageLabels.set(e,label);}
      const age=(game.tick-e.tick)*C.dt,p=project(e.x,e.y,.85),pos=damagePosition(p.x,p.y,width,height,age);
      const value=e.kind==='damage'?`−${e.value}`:t('depth', { v0: e.value });if(label.textContent!==value)label.textContent=value;label.style.transform=`translate(${pos.x}px,${pos.y}px) translate(-50%,-50%)`;label.style.opacity=String(Math.max(0,1-age/.6));}
    const card=game.replays.at(-1);replay.hidden=!card||game.tick-card.tick>600;
    if(card&&card.tick!==lastReplay){lastReplay=card.tick;replayCount++;replay.replaceChildren();
      const title=document.createElement('strong');title.textContent=`${card.shift?t('shiftReplay'):t('chainReplay')} · ${t('rtDepth', { depth: card.depth })}`;
      const ids=document.createElement('p');ids.textContent=card.ballIds.map(id=>`#${id}`).join(' → ');
      const summary=document.createElement('p');summary.textContent=t('replaySummary', { v0: card.kills, v1: card.bossDamage });replay.append(title,ids,summary);}
    if(game.status!==shown&&(game.status==='won'||game.status==='lost')){shown=game.status;overlay.hidden=false;get('seed-label').hidden=true;
      get('overlay-title').textContent=game.status==='won'?t('rtWin'):t('rtLost');
      get('overlay-text').textContent=t('rtResult', { v0: Math.round(game.tick*C.dt), v1: game.shots, v2: game.shifts.filter(s=>s.kind==='active').length });
      start.textContent=t('restart');get('outcome').textContent=get('overlay-title').textContent;start.focus();}
  }
  return {sound,update,reset,evidence:()=>({replays:replayCount,labels:damageLabels.size,bars:bars.size,audio:sound.context?.state??'not-started',notes:sound.played,muted:sound.muted})};
}
