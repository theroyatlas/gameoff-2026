import { CONFIG as C } from './config';

export type Status = 'ready' | 'playing' | 'won' | 'lost';
export interface Ball {
  id: number; x: number; y: number; vx: number; vy: number; material: number;
  oscillation: number; resonant: boolean; cooldown: number; delayedUntil: number;
  igniteUntil: number; chainId: number | null; depth: number;
}
export interface Target { id: number; kind: 'boss' | 'monster'; x: number; y: number; radius: number; hp: number; maxHp: number; flashUntil: number }
export interface ChainEvent {
  id: number; tick: number; chainId: number; depth: number; ballId: number;
  kind: 'burst' | 'amplified'; radius: number; ignitedBallIds: number[];
  targetDamage: { targetId: number; amount: number; killed: boolean }[];
}
export interface Effect { kind: 'burst' | 'ignite' | 'interference' | 'damage' | 'impact' | 'resonate' | 'launch' | 'death' | 'warning' | 'shift' | 'release' | 'wave'; x: number; y: number; radius: number; value: number; tick: number; amplified?: boolean; fromX?: number; fromY?: number }
export interface Replay { tick: number; depth: number; ballIds: number[]; kills: number; bossDamage: number; shift: boolean }
export interface Shot { tick: number; angle: number; actualAngle: number; material: number }

export class Game {
  status: Status = 'ready';
  tick = 0; seed: number; randomState = 0; shots = 0; nextId = 1; nextChain = 1;
  lastShotTick = -C.launcher.intervalTicks;
  balls: Ball[] = []; monsters: Target[] = []; boss!: Target;
  events: ChainEvent[] = []; effects: Effect[] = []; inputs: Shot[] = [];
  contacts = new Set<string>();
  phase: 'idle' | 'warning' | 'active' = 'idle'; phaseUntil = 0; shiftReadyAt = 0; phaseMaterial = 0;
  shifts: { tick: number; kind: 'warning' | 'active' | 'release' }[] = [];
  wave = 0; upgraded = false; waveAt = 0;
  replays: Replay[] = []; replayCursor = 0; shiftEventStart = 0;

  constructor(seed: number = C.seed) { this.seed = seed >>> 0; this.reset(); }
  reset(seed = this.seed) {
    this.seed = seed >>> 0; this.randomState = this.seed;
    this.status = 'ready'; this.tick = 0; this.shots = 0; this.nextId = 1; this.nextChain = 1;
    this.lastShotTick = -C.launcher.intervalTicks;
    this.balls = []; this.monsters = []; this.events = []; this.effects = []; this.inputs = [];
    this.contacts = new Set();
    this.phase = 'idle'; this.phaseUntil = this.shiftReadyAt = this.phaseMaterial = 0;
    this.shifts = []; this.wave = 0; this.waveAt = 0; this.upgraded = false;
    this.replays = []; this.replayCursor = this.shiftEventStart = 0;
    this.boss = { id: 0, kind: 'boss', ...C.boss, maxHp: C.boss.hp, flashUntil: 0 };
  }
  start() { if (this.status === 'ready') this.status = 'playing'; }
  random() {
    this.randomState = (this.randomState + 0x6D2B79F5) >>> 0;
    let t = this.randomState;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  get simultaneousResonanceCount() { return this.balls.filter(b => b.resonant).length; }
  get nextMaterial() { return this.shots % C.materials.length; }
  makeBall(x: number, y: number, material = 0): Ball {
    return { id: this.nextId++, x, y, vx: 0, vy: 0, material, oscillation: 0, resonant: false,
      cooldown: 0, delayedUntil: 0, igniteUntil: 0, chainId: null, depth: 0 };
  }
  fire(angle: number) {
    if (this.status !== 'playing' || !Number.isFinite(angle) || this.tick - this.lastShotTick < C.launcher.intervalTicks) return false;
    const actualAngle = angle + (this.random() * 2 - 1) * C.launcher.coneHalfAngle;
    const b = this.makeBall(C.launcher.x, C.launcher.y, this.nextMaterial);
    b.vx = Math.cos(actualAngle) * C.ball.speed; b.vy = Math.sin(actualAngle) * C.ball.speed;
    this.balls.push(b); this.inputs.push({ tick: this.tick, angle, actualAngle, material: b.material });
    this.shots++; this.lastShotTick = this.tick;
    this.effects.push({ kind: 'launch', x: b.x, y: b.y, radius: 80, value: actualAngle, tick: this.tick });
    if (this.phase === 'active') { b.resonant = true; b.oscillation = C.resonance.threshold; }
    this.checkOutcome(); return true;
  }
  spawnMonster(hp: number = C.monsters.hp) {
    const inset = C.monsters.edgeInset;
    // 固定場邊候選點，從種子選起點後掃描，避免靜止靶互相重疊。
    const slots: { x: number; y: number }[] = [];
    for (let x = 80; x <= 720; x += 64) slots.push({ x, y: inset }, { x, y: C.height - inset });
    for (let y = 110; y <= 570; y += 64) slots.push({ x: inset, y }, { x: C.width - inset, y });
    const start = Math.floor(this.random() * slots.length);
    for (let i = 0; i < slots.length; i++) {
      const p = slots[(i + start) % slots.length];
      if (Math.hypot(p.x - C.launcher.x, p.y - C.launcher.y) < 60) continue;
      if (this.monsters.some(m => Math.hypot(m.x - p.x, m.y - p.y) < m.radius * 2 + 4)) continue;
      this.monsters.push({ ...p, id: this.nextId++, kind: 'monster', radius: C.monsters.radius,
        hp, maxHp: hp, flashUntil: 0 });
      return;
    }
  }
  charge(b: Ball, amount: number, chainId: number | null = null, depth = 0) {
    if (this.tick < b.cooldown) return;
    b.oscillation = Math.min(C.resonance.threshold, b.oscillation + amount);
    const wasResonant = b.resonant;
    b.resonant = b.oscillation >= C.resonance.threshold;
    if (b.resonant && !wasResonant) this.effects.push({ kind: 'resonate', x: b.x, y: b.y, radius: 30, value: depth, tick: this.tick });
    if (chainId !== null) { b.chainId = chainId; b.depth = depth; }
  }
  collide(a: Ball, b?: Ball, chargeAmount = 1) {
    const impact = b ? Math.hypot(a.vx-b.vx,a.vy-b.vy) : Math.hypot(a.vx,a.vy);
    this.effects.push({ kind: 'impact', x: a.x, y: a.y, radius: 30, value: impact, tick: this.tick });
    // 換相期間暫存能量，最後同時釋放；材質身份仍保留。
    if (this.phase !== 'idle') {
      for (const ball of b ? [a,b] : [a]) { this.boost(ball); this.charge(ball,chargeAmount); }
      return;
    }
    const aReady = a.resonant && this.tick >= a.delayedUntil && this.tick >= a.cooldown;
    const bReady = b && b.resonant && this.tick >= b.delayedUntil && this.tick >= b.cooldown;
    if (b && a.resonant && b.resonant) {
      if (C.materials[a.material].frequency !== C.materials[b.material].frequency) {
        for (const ball of [a, b]) {
          ball.vx *= C.resonance.interferenceMomentum; ball.vy *= C.resonance.interferenceMomentum;
          ball.delayedUntil = this.tick + C.resonance.interferenceTicks;
        }
        this.effects.push({ kind: 'interference', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, radius: C.ball.radius * 3, value: 0, tick: this.tick });
        return;
      }
      if (aReady && bReady) {
        this.boost(a); this.boost(b);
        const chainId = a.chainId ?? b.chainId ?? this.nextChain++;
        // 先鎖定兩球，避免第一個爆發重新點燃正在釋放的另一球。
        a.cooldown = b.cooldown = this.tick + C.resonance.cooldownTicks;
        this.burst(a, C.resonance.sameFrequencyMultiplier, chainId);
        this.burst(b, C.resonance.sameFrequencyMultiplier, chainId);
        return;
      }
    }
    // 用碰撞前的共振狀態決定是否爆發；剛到閾值不會在同次碰撞爆發。
    if (aReady) { this.boost(a); this.burst(a); } else this.charge(a, chargeAmount);
    if (b) { if (bReady) { this.boost(b); this.burst(b); } else this.charge(b, 1); }
  }
  boost(b: Ball) {
    const speed = Math.hypot(b.vx,b.vy);
    if (speed > 0) { const factor = Math.min(C.ball.maxSpeed,speed*C.ball.resonanceBoost+90)/speed; b.vx*=factor; b.vy*=factor; }
  }
  burst(b: Ball, multiplier = 1, sharedChain?: number) {
    const chainId = sharedChain ?? b.chainId ?? this.nextChain++;
    const depth = b.depth + 1;
    const radius = C.ball.radius * C.resonance.radiusInBalls * multiplier;
    b.resonant = false; b.oscillation = 0; b.cooldown = this.tick + C.resonance.cooldownTicks;
    b.delayedUntil = 0; b.chainId = null; b.depth = 0;
    const event: ChainEvent = { id: this.events.length + 1, tick: this.tick, chainId, depth,
      ballId: b.id, kind: multiplier > 1 ? 'amplified' : 'burst', radius, ignitedBallIds: [], targetDamage: [] };
    for (const other of this.balls) {
      if (other === b || this.tick < other.cooldown || Math.hypot(other.x - b.x, other.y - b.y) > radius + 0.01) continue;
      const amount = C.resonance.ignite * multiplier * C.resonance.igniteDepthDecay ** (depth - 1);
      if (amount <= 0) continue;
      this.charge(other, amount, chainId, depth);
      other.igniteUntil = this.tick + C.feedback.igniteTicks;
      event.ignitedBallIds.push(other.id);
      this.effects.push({ kind: 'ignite', x: other.x, y: other.y, fromX: b.x, fromY: b.y, radius: C.ball.radius + 8, value: depth, tick: this.tick });
    }
    for (const target of [this.boss, ...this.monsters]) {
      if (target.hp > 0 && Math.hypot(target.x - b.x, target.y - b.y) <= radius + target.radius) {
        const amount = this.damage(target, C.damage.burstExtra * multiplier);
        event.targetDamage.push({ targetId: target.id, amount, killed: target.hp === 0 });
      }
    }
    this.events.push(event);
    this.effects.push({ kind: 'burst', x: b.x, y: b.y, radius, value: depth, tick: this.tick, amplified: multiplier > 1 });
  }
  damage(target: Target, amount: number) {
    const actual = Math.min(target.hp, amount); if (actual <= 0) return 0;
    target.hp -= actual; target.flashUntil = this.tick + C.feedback.targetFlashTicks;
    if (target.hp === 0) this.effects.push({ kind: 'death', x: target.x, y: target.y, radius: target.radius, value: 0, tick: this.tick });
    // 同一位置短時間的傷害只保留一個總數，事件仍記錄各次實際傷害。
    const recent = this.effects.find(e => e.kind === 'damage' && e.x === target.x
      && e.y === target.y - target.radius && this.tick - e.tick <= C.feedback.damageMergeTicks);
    if (recent) { recent.value += actual; recent.tick = this.tick; }
    else this.effects.push({ kind: 'damage', x: target.x, y: target.y - target.radius, radius: 0, value: actual, tick: this.tick });
    return actual;
  }
  checkOutcome() {
    this.monsters = this.monsters.filter(m => m.hp > 0);
    if (this.status !== 'playing') return;
    if (this.boss.hp <= 0) this.status = 'won';
    else if (this.monsters.length > C.monsters.loseAbove) this.status = 'lost';
  }
  wavePlan(wave: number) {
    return { count: wave <= 2 ? 2 : Math.min(8,2+Math.floor((wave-1)/2)), hp: C.monsters.hp+Math.max(0,wave-2)*C.difficulty.hpGrowth };
  }
  updateDifficulty() {
    const seconds = this.tick*C.dt;
    const due = seconds < C.difficulty.firstWaveSeconds ? 0 : 1+Math.floor((seconds-C.difficulty.firstWaveSeconds)/C.difficulty.waveSeconds);
    if (due > this.wave) {
      this.wave = due; this.waveAt = this.tick;
      const plan = this.wavePlan(due);
      for (let i=0;i<plan.count;i++) this.spawnMonster(plan.hp);
      this.effects.push({ kind: 'wave', x: C.width/2, y: 80, radius: 0, value: due, tick: this.tick });
    }
    if (!this.upgraded && seconds >= C.difficulty.graceSeconds && this.boss.hp <= this.boss.maxHp*C.difficulty.upgradeAt) {
      this.upgraded = true; this.waveAt = this.tick;
      for (let i=0;i<3;i++) this.spawnMonster(this.wavePlan(this.wave).hp);
      this.effects.push({ kind: 'wave', x: C.width/2, y: 80, radius: 0, value: -1, tick: this.tick });
    }
  }
  updatePhase() {
    if (this.phase === 'idle' && this.tick >= this.shiftReadyAt && this.simultaneousResonanceCount >= C.shift.threshold) {
      this.phase = 'warning'; this.phaseUntil = this.tick+C.shift.warningTicks;
      this.phaseMaterial = this.balls.find(b=>b.resonant)!.material;
      this.shifts.push({ tick: this.tick, kind: 'warning' });
      this.effects.push({ kind: 'warning', x: 400, y: 340, radius: 400, value: 0, tick: this.tick });
    } else if (this.phase === 'warning' && this.tick >= this.phaseUntil) {
      this.phase = 'active'; this.phaseUntil = this.tick+C.shift.durationTicks; this.shiftEventStart = this.events.length;
      this.shifts.push({ tick: this.tick, kind: 'active' });
      this.effects.push({ kind: 'shift', x: 400, y: 340, radius: 500, value: 0, tick: this.tick });
      for (const b of this.balls) {
        b.resonant = true; b.oscillation = C.resonance.threshold; b.cooldown = 0;
        if (Math.hypot(b.vx,b.vy)<C.shift.wakeSpeed) { const a=this.random()*Math.PI*2; b.vx=Math.cos(a)*C.shift.wakeSpeed; b.vy=Math.sin(a)*C.shift.wakeSpeed; }
      }
    } else if (this.phase === 'active' && this.tick >= this.phaseUntil) {
      const chain = this.nextChain++;
      // 同步鎖定，避免同次釋放重新點燃尚未處理的球。
      for (const b of this.balls) b.cooldown=this.tick+C.resonance.cooldownTicks;
      for (const b of this.balls) this.burst(b,C.resonance.sameFrequencyMultiplier,chain);
      this.phase = 'idle'; this.shiftReadyAt = this.tick+C.shift.cooldownTicks;
      this.shifts.push({ tick: this.tick, kind: 'release' });
      this.effects.push({ kind: 'release', x: 400, y: 340, radius: 500, value: 0, tick: this.tick });
      this.makeReplay(this.shiftEventStart,true); this.replayCursor=this.events.length;
    }
  }
  makeReplay(start: number, shift = false) {
    const events=this.events.slice(start); if (!events.length) return;
    const ids=new Set<number>(), kills=new Set<number>(); let depth=0,bossDamage=0;
    for (const e of events) { depth=Math.max(depth,e.depth); ids.add(e.ballId); for(const id of e.ignitedBallIds)ids.add(id);
      for(const d of e.targetDamage) { if(d.targetId===0)bossDamage+=d.amount; else if(d.killed)kills.add(d.targetId); }
    }
    if (shift || depth>=2 || events.length>=3) this.replays.push({tick:this.tick,depth,ballIds:[...ids],kills:kills.size,bossDamage,shift});
  }
  step() {
    if (this.status !== 'playing') return;
    this.tick++;
    this.updateDifficulty(); this.updatePhase();
    const current = new Set<string>();
    const contact = (key: string, fn: () => void) => { current.add(key); if (!this.contacts.has(key)) fn(); };
    const r = C.ball.radius;
    for (const b of this.balls) {
      const drag = Math.exp(-(this.phase === 'active' ? C.shift.friction : C.ball.friction) * C.dt);
      b.vx *= drag; b.vy *= drag;
      if (Math.hypot(b.vx, b.vy) < C.ball.stopSpeed) b.vx = b.vy = 0;
      b.x += b.vx * C.dt; b.y += b.vy * C.dt;
      for (const [axis, low, high, velocity] of [['x', r, C.width-r, 'vx'], ['y', r, C.height-r, 'vy']] as const) {
        if (b[axis] <= low) {
          b[axis] = low; if (b[velocity] < 0) { b[velocity] *= -C.ball.restitution; contact(`${b.id}:${axis}-`, () => this.collide(b, undefined, C.resonance.wallCharge)); }
        } else if (b[axis] >= high) {
          b[axis] = high; if (b[velocity] > 0) { b[velocity] *= -C.ball.restitution; contact(`${b.id}:${axis}+`, () => this.collide(b, undefined, C.resonance.wallCharge)); }
        }
      }
    }
    for (let i = 0; i < this.balls.length; i++) {
      const a = this.balls[i];
      for (let j = i + 1; j < this.balls.length; j++) {
        const b = this.balls[j]; const dx = b.x-a.x, dy = b.y-a.y;
        const distance = Math.hypot(dx, dy); if (distance > 2*r + 0.01) continue;
        const nx = distance > 1e-8 ? dx/distance : 1, ny = distance > 1e-8 ? dy/distance : 0;
        const overlap = Math.max(0, 2*r-distance) / 2;
        a.x -= nx*overlap; a.y -= ny*overlap; b.x += nx*overlap; b.y += ny*overlap;
        const relative = (b.vx-a.vx)*nx + (b.vy-a.vy)*ny;
        if (relative < 0) {
          const impulse = -(1+C.ball.restitution)*relative/2;
          a.vx -= impulse*nx; a.vy -= impulse*ny; b.vx += impulse*nx; b.vy += impulse*ny;
        }
        contact(`b:${a.id}:${b.id}`, () => this.collide(a,b));
      }
      for (const t of [this.boss, ...this.monsters]) {
        if (t.hp <= 0) continue;
        const dx = a.x-t.x, dy = a.y-t.y, distance = Math.hypot(dx,dy);
        if (distance > r+t.radius+0.01) continue;
        const nx = distance > 1e-8 ? dx/distance : 1, ny = distance > 1e-8 ? dy/distance : 0;
        a.x = t.x+nx*(r+t.radius); a.y = t.y+ny*(r+t.radius);
        const vn = a.vx*nx+a.vy*ny;
        if (vn < 0) { a.vx -= (1+C.ball.restitution)*vn*nx; a.vy -= (1+C.ball.restitution)*vn*ny; }
        contact(`t:${a.id}:${t.id}`, () => {
          this.damage(t, a.resonant ? C.damage.resonant : C.damage.normal); this.collide(a);
        });
      }
      a.x = Math.max(r, Math.min(C.width-r, a.x)); a.y = Math.max(r, Math.min(C.height-r, a.y));
    }
    this.contacts = current;
    this.updatePhase();
    if (this.phase==='idle' && this.events.length>this.replayCursor && this.tick-this.events.at(-1)!.tick>=120) {
      this.makeReplay(this.replayCursor); this.replayCursor=this.events.length;
    }
    this.effects = this.effects.filter(e => this.tick-e.tick < C.feedback.lifetimeTicks);
    this.checkOutcome();
  }
  snapshot() {
    return JSON.parse(JSON.stringify({ seed: this.seed, randomState: this.randomState, tick: this.tick, status: this.status,
      shots: this.shots, nextId: this.nextId, nextChain: this.nextChain, lastShotTick: this.lastShotTick,
      balls: this.balls, boss: this.boss, monsters: this.monsters, events: this.events, effects: this.effects,
      inputs: this.inputs, contacts: [...this.contacts].sort(), phase: this.phase, phaseUntil: this.phaseUntil,
      shiftReadyAt: this.shiftReadyAt, phaseMaterial: this.phaseMaterial, shifts: this.shifts, wave: this.wave, waveAt: this.waveAt,
      upgraded: this.upgraded, replays: this.replays, replayCursor: this.replayCursor, shiftEventStart: this.shiftEventStart }));
  }
}
