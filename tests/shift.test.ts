import { describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import { CONFIG as C } from '../src/config';
function prepared(){const g=new Game(11);g.start();for(let i=0;i<3;i++){const b=g.makeBall(180+i*70,180,i);g.balls.push(b);g.charge(b,C.resonance.threshold);}return g;}
describe('SHIFT',()=>{
 it('同時三球自動預兆，等待後全場同頻且靜止球重新流動',()=>{const g=prepared();const original=g.balls.map(b=>b.material);g.step();expect(g.phase).toBe('warning');expect(g.events).toHaveLength(0);g.tick=g.phaseUntil-1;g.step();expect(g.phase).toBe('active');expect(g.balls.every(b=>b.resonant&&Math.hypot(b.vx,b.vy)>100)).toBe(true);expect(g.balls.map(b=>b.material)).toEqual(original);});
 it('相變內異頻碰撞不干擾，結束所有球同 tick 放大釋放，只結算一次',()=>{const g=prepared();g.step();g.tick=g.phaseUntil-1;g.step();const [a,b]=g.balls;a.vx=100;b.vx=-100;g.collide(a,b);expect(a.vx).toBeGreaterThan(100);expect(a.delayedUntil).toBe(0);expect(g.events).toHaveLength(0);g.tick=g.phaseUntil-1;g.step();expect(g.phase).toBe('idle');expect(g.events).toHaveLength(3);expect(new Set(g.events.map(e=>e.tick)).size).toBe(1);expect(g.events.every(e=>e.kind==='amplified')).toBe(true);expect(g.replays.at(-1)?.shift).toBe(true);g.step();expect(g.events).toHaveLength(3);});
 it('冷卻阻止重入，重來清掉預兆、相變、波次與回放',()=>{const g=prepared();g.shiftReadyAt=500;g.step();expect(g.phase).toBe('idle');g.reset();expect(g.snapshot()).toEqual(new Game(11).snapshot());});
 it('低摩擦只作用於相變，普通球停止後仍留場',()=>{const g=new Game();g.start();const b=g.makeBall(100,100);g.balls.push(b);b.vx=100;g.phase='active';g.phaseUntil=1000;g.step();expect(b.vx).toBeCloseTo(100*Math.exp(-C.shift.friction*C.dt));});
 it('同種子與相同輸入可重現相變及回放',()=>{const run=()=>{const g=new Game(20261110);g.start();for(let i=0;i<4800;i++){if(i%120===0)g.fire(-Math.PI/2+Math.sin(i/120)*.6);g.step();}return g.snapshot();};const a=run();expect(a.shifts.some((s:{kind:string})=>s.kind==='release')).toBe(true);expect(a.replays.length).toBeGreaterThan(0);expect(run()).toEqual(a);});
});
describe('難度與回放',()=>{
 it('完全不發射，前六十秒仍不會輸且只有四隻怪物',()=>{const g=new Game();g.start();for(let i=0;i<7200;i++)g.step();expect(g.status).toBe('playing');expect(g.monsters).toHaveLength(4);});
 it('後波更硬且更多，波間保留三十秒喘息',()=>{const g=new Game();g.start();expect(g.wavePlan(6).count).toBeGreaterThan(g.wavePlan(2).count);expect(g.wavePlan(6).hp).toBeGreaterThan(g.wavePlan(2).hp);g.tick=1800;g.updateDifficulty();const n=g.monsters.length;g.tick=5399;g.updateDifficulty();expect(g.monsters.length).toBe(n);g.tick=5400;g.updateDifficulty();expect(g.monsters.length).toBe(n+2);});
 it('半血只升級一次且不在保護時段湧出',()=>{const g=new Game();g.start();g.boss.hp=g.boss.maxHp*.4;g.tick=7000;g.updateDifficulty();expect(g.upgraded).toBe(false);g.tick=7200;g.updateDifficulty();expect(g.upgraded).toBe(true);const n=g.monsters.length;g.updateDifficulty();expect(g.monsters.length).toBe(n);});
 it('共振碰撞後速度增加，普通碰撞仍消耗能量',()=>{const g=new Game();g.start();const b=g.makeBall(14,100);g.balls.push(b);b.vx=-500;g.charge(b,C.resonance.threshold);g.step();expect(b.vx).toBeGreaterThan(500);});
 it('回放依事件統計不同球號、擊殺與 Boss 實扣傷害',()=>{const g=new Game();g.events=[{id:1,tick:1,chainId:1,depth:2,ballId:3,kind:'burst',radius:100,ignitedBallIds:[7,12],targetDamage:[{targetId:0,amount:20,killed:false},{targetId:10,amount:3,killed:true}]}];g.makeReplay(0);expect(g.replays[0]).toMatchObject({depth:2,ballIds:[3,7,12],kills:1,bossDamage:20});});
});
