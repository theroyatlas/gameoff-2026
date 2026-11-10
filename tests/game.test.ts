import { describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import { CONFIG as C } from '../src/config';

function active(seed?: number) { const g = new Game(seed); g.start(); return g; }
function ball(g: Game, x = 160, y = 160, material = 0) { const b = g.makeBall(x,y,material); g.balls.push(b); return b; }
function advance(g: Game, ticks: number) { for (let i = 0; i < ticks; i++) g.step(); }

describe('共振與連鎖', () => {
  it('初始為零，五次碰撞才共振，第六次爆發', () => {
    const g = active(), b = ball(g);
    expect(b.oscillation).toBe(0); expect(b.resonant).toBe(false);
    for (let i=0;i<4;i++) g.collide(b);
    expect(b.resonant).toBe(false); g.collide(b);
    expect(b.resonant).toBe(true); expect(g.events).toHaveLength(0);
    expect(g.simultaneousResonanceCount).toBe(1);
    g.collide(b); expect(b.resonant).toBe(false); expect(b.oscillation).toBe(0);
    expect(g.events).toHaveLength(1); expect(g.simultaneousResonanceCount).toBe(0);
  });
  it('冷卻內不累積，冷卻後能再共振', () => {
    const g = active(), b = ball(g); g.charge(b,5); g.collide(b); g.collide(b);
    expect(b.oscillation).toBe(0); advance(g,C.resonance.cooldownTicks); g.charge(b,5);
    expect(b.resonant).toBe(true);
  });
  it('點燃僅影響半徑內其他球並記錄球號與下一層', () => {
    const g = active(), a = ball(g), b = ball(g,188), c = ball(g,189);
    g.charge(a,5); g.charge(b,3); g.collide(a);
    expect(b.resonant).toBe(true); expect(c.oscillation).toBe(0);
    expect(g.events[0].ignitedBallIds).toEqual([b.id]);
    g.collide(b); expect(g.events[1].depth).toBe(2);
    expect(g.events[1].chainId).toBe(g.events[0].chainId);
  });
  it('同頻雙球放大範圍、點燃量與傷害，兩球都歸零', () => {
    const g = active(), a = ball(g,320,C.boss.y), b = ball(g,320,C.boss.y+28), c = ball(g,270,C.boss.y);
    g.charge(a,5); g.charge(b,5); g.collide(a,b);
    expect(g.events).toHaveLength(2); expect(g.events[0].radius).toBe(56);
    expect(g.events[0].kind).toBe('amplified'); expect(c.oscillation).toBe(4);
    expect(a.oscillation).toBe(0); expect(b.oscillation).toBe(0);
    expect(g.boss.hp).toBe(60); expect(g.events[0].chainId).toBe(g.events[1].chainId);
  });
  it('異頻減少動量且延後爆發，延後時間過後碰牆仍能爆發', () => {
    const g = active(), a = ball(g), b = ball(g,188,160,1);
    g.charge(a,5); g.charge(b,5); a.vx=100; b.vx=-100; g.collide(a,b);
    expect(a.vx).toBe(45); expect(b.vx).toBe(-45); expect(g.events).toHaveLength(0);
    g.collide(a); expect(g.events).toHaveLength(0); expect(a.resonant).toBe(true);
    g.tick = a.delayedUntil; g.collide(a); expect(g.events).toHaveLength(1);
  });
  it('固定步碰牆爆發點燃鄰球，鄰球下次碰牆形成第二層', () => {
    const g = active(), a = ball(g,14,100), b = ball(g,14,128);
    // 兩球原已貼合；這次新增的接觸只有牆壁。
    g.contacts.add(`b:${a.id}:${b.id}`);
    g.charge(a,5); g.charge(b,3); a.vx=-100; g.step();
    expect(g.events).toHaveLength(1); expect(b.resonant).toBe(true);
    b.vx=-100; g.step();
    expect(g.events).toHaveLength(2); expect(g.events[1].depth).toBe(2);
    expect(g.events[1].chainId).toBe(g.events[0].chainId);
  });
});

describe('傷害、靜止靶與勝負', () => {
  it('普通碰撞造成 1 傷害並反彈', () => {
    const g = active(), b = ball(g,400,C.boss.y-C.boss.radius-C.ball.radius+1); b.vy=100; g.step();
    expect(g.boss.hp).toBe(99); expect(b.vy).toBeLessThan(0); expect(b.oscillation).toBe(1);
  });
  it('共振接觸 5 加爆發 10，共 15 傷害', () => {
    const g = active(), b = ball(g,400,C.boss.y-C.boss.radius-C.ball.radius+1); b.vy=100; g.charge(b,5); g.step();
    expect(g.boss.hp).toBe(85); expect(g.events[0].targetDamage[0].amount).toBe(10);
  });
  it('爆發傷害命中範圍內所有靶，範圍外不扣血', () => {
    const g = active(), b = ball(g,335,C.boss.y); g.spawnMonster(); g.spawnMonster();
    Object.assign(g.monsters[0],{x:320,y:C.boss.y}); Object.assign(g.monsters[1],{x:100,y:100});
    g.charge(b,5); g.collide(b); g.checkOutcome();
    expect(g.boss.hp).toBe(90); expect(g.monsters).toHaveLength(1);
    expect(g.events[0].targetDamage.some(t=>t.killed)).toBe(true);
  });
  it('每五發生成一隻且不移動，種子可重現位置', () => {
    const g = active();
    for(let i=0;i<10;i++) { g.fire(-1); advance(g,28); }
    expect(g.shots).toBe(10); expect(g.monsters).toHaveLength(2);
    const positions = g.monsters.map(m=>[m.x,m.y]); advance(g,30);
    expect(g.monsters.map(m=>[m.x,m.y])).toEqual(positions);
    expect(g.monsters.every(m=>m.hp===3)).toBe(true);
  });
  it('場邊生成不重疊、不堵住發射點', () => {
    const g = active(); for(let i=0;i<11;i++)g.spawnMonster();
    expect(g.monsters).toHaveLength(11);
    for(const a of g.monsters) {
      expect(Math.min(a.x,C.width-a.x,a.y,C.height-a.y)).toBe(C.monsters.edgeInset);
      for(const b of g.monsters)if(a!==b)expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeGreaterThan(a.radius+b.radius);
    }
  });
  it('第 55 次發射生成第 11 隻會輸，第 50 次仍可玩', () => {
    const g = active();
    for(let i=0;i<55;i++) { g.tick=i*28; g.fire(-1); if(i===49)expect(g.status).toBe('playing'); }
    expect(g.status).toBe('lost'); expect(g.monsters).toHaveLength(11);
  });
  it('Boss 歸零勝利，終局不能發射或繼續模擬', () => {
    const g = active(); g.damage(g.boss,100); g.checkOutcome(); expect(g.status).toBe('won');
    const before = g.snapshot(); expect(g.fire(-1)).toBe(false); g.step(); expect(g.snapshot()).toEqual(before);
  });
  it('同一步 Boss 死亡和怪物超量時勝利優先', () => {
    const g = active(); for(let i=0;i<11;i++)g.spawnMonster(); g.boss.hp=0; g.checkOutcome(); expect(g.status).toBe('won');
  });
  it('長時間貼著目標只計一次接觸', () => {
    const g = active(), b = ball(g,400,C.boss.y-C.boss.radius-C.ball.radius); advance(g,100);
    expect(g.boss.hp).toBe(99); expect(b.oscillation).toBe(1);
  });
});

describe('物理、輸入與確定性', () => {
  it('扇形內偏移且不是每次精確角度，材質輪替', () => {
    const g = active(); for(let i=0;i<9;i++){g.tick=i*28;g.fire(-Math.PI/2);}
    expect(g.inputs.every(s=>Math.abs(s.actualAngle-s.angle)<=C.launcher.coneHalfAngle)).toBe(true);
    expect(new Set(g.inputs.map(s=>s.actualAngle)).size).toBe(9);
    expect(g.inputs.slice(0,3).map(s=>s.material)).toEqual([0,1,2]);
  });
  it('開始之前、發射冷卻時、無效角度不建立球', () => {
    const g = new Game(); expect(g.fire(-1)).toBe(false); g.start();
    expect(g.fire(NaN)).toBe(false); expect(g.fire(-1)).toBe(true); expect(g.fire(-1)).toBe(false);
    expect(g.balls).toHaveLength(1);
  });
  it('種子 0 有有效可重現的亂數序列', () => {
    const a=active(0),b=active(0); const values=Array.from({length:10},()=>a.random());
    expect(values).toEqual(Array.from({length:10},()=>b.random()));
    expect(new Set(values).size).toBe(10); expect(values.every(v=>v>=0&&v<1)).toBe(true);
  });
  it('等質量碰撞傳遞動量、分離且不重複計數', () => {
    const g = active(), a = ball(g), b = ball(g,188); a.vx=200; g.step();
    expect(b.vx).toBeGreaterThan(190); expect(a.vx).toBeLessThan(5);
    expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeCloseTo(28); expect(a.oscillation).toBe(1);
  });
  it('完全重疊的球不產生 NaN', () => {
    const g = active(); ball(g); ball(g); g.step();
    expect(g.balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.vx))).toBe(true);
  });
  it('牆壁反彈、摩擦減速且球永久保留', () => {
    const g = active(), b = ball(g,15,100); b.vx=-200; g.step();
    expect(b.vx).toBeGreaterThan(0); expect(b.oscillation).toBe(1); const speed=b.vx;
    advance(g,30); expect(b.vx).toBeLessThan(speed); advance(g,8000);
    expect(g.balls).toHaveLength(1); expect(b.x).toBeGreaterThanOrEqual(14);
  });
  it('同種子、同時步操作得到完全相同狀態、事件及傷害', () => {
    const simulate = (seed: number) => {
      const g=active(seed); for(let i=0;i<3600;i++){if(i%150===0)g.fire(-Math.PI/2+Math.sin(i)*0.7);g.step();} return g.snapshot();
    };
    const first=simulate(123); expect(first.events.length).toBeGreaterThan(0);
    expect(simulate(123)).toEqual(first); expect(simulate(124)).not.toEqual(first);
  });
  it.each(['won','lost','playing'] as const)('從 %s 重來，包含 RNG、接觸、視覺與記錄全部重置', status => {
    const g=active(321); g.fire(-1); advance(g,100); g.spawnMonster();
    g.charge(g.balls[0],5); g.collide(g.balls[0]); g.status=status; g.reset();
    expect(g.snapshot()).toEqual(new Game(321).snapshot());
    g.start(); g.fire(-1); const fresh=active(321); fresh.fire(-1); expect(g.snapshot()).toEqual(fresh.snapshot());
  });
});
