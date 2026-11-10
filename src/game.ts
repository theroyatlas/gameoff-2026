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
export interface Effect { kind: 'burst' | 'ignite' | 'interference' | 'damage'; x: number; y: number; radius: number; value: number; tick: number; amplified?: boolean }
export interface Shot { tick: number; angle: number; actualAngle: number; material: number }

export class Game {
  status: Status = 'ready';
  tick = 0; seed: number; randomState = 0; shots = 0; nextId = 1; nextChain = 1;
  lastShotTick = -C.launcher.intervalTicks;
  balls: Ball[] = []; monsters: Target[] = []; boss!: Target;
  events: ChainEvent[] = []; effects: Effect[] = []; inputs: Shot[] = [];
  contacts = new Set<string>();

  constructor(seed: number = C.seed) { this.seed = seed >>> 0; this.reset(); }
  reset(seed = this.seed) {
    this.seed = seed >>> 0; this.randomState = this.seed;
    this.status = 'ready'; this.tick = 0; this.shots = 0; this.nextId = 1; this.nextChain = 1;
    this.lastShotTick = -C.launcher.intervalTicks;
    this.balls = []; this.monsters = []; this.events = []; this.effects = []; this.inputs = [];
    this.contacts = new Set();
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
    if (this.shots % C.monsters.everyShots === 0) this.spawnMonster();
    this.checkOutcome(); return true;
  }
  spawnMonster() {
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
        hp: C.monsters.hp, maxHp: C.monsters.hp, flashUntil: 0 });
      return;
    }
  }
  charge(b: Ball, amount: number, chainId: number | null = null, depth = 0) {
    if (this.tick < b.cooldown) return;
    b.oscillation = Math.min(C.resonance.threshold, b.oscillation + amount);
    b.resonant = b.oscillation >= C.resonance.threshold;
    if (chainId !== null) { b.chainId = chainId; b.depth = depth; }
  }
  collide(a: Ball, b?: Ball, chargeAmount = 1) {
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
        const chainId = a.chainId ?? b.chainId ?? this.nextChain++;
        // 先鎖定兩球，避免第一個爆發重新點燃正在釋放的另一球。
        a.cooldown = b.cooldown = this.tick + C.resonance.cooldownTicks;
        this.burst(a, C.resonance.sameFrequencyMultiplier, chainId);
        this.burst(b, C.resonance.sameFrequencyMultiplier, chainId);
        return;
      }
    }
    // 用碰撞前的共振狀態決定是否爆發；剛到閾值不會在同次碰撞爆發。
    if (aReady) this.burst(a); else this.charge(a, chargeAmount);
    if (b) { if (bReady) this.burst(b); else this.charge(b, 1); }
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
      this.effects.push({ kind: 'ignite', x: other.x, y: other.y, radius: C.ball.radius + 8, value: 0, tick: this.tick });
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
  step() {
    if (this.status !== 'playing') return;
    this.tick++;
    const current = new Set<string>();
    const contact = (key: string, fn: () => void) => { current.add(key); if (!this.contacts.has(key)) fn(); };
    const r = C.ball.radius;
    for (const b of this.balls) {
      const drag = Math.exp(-C.ball.friction * C.dt);
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
    this.effects = this.effects.filter(e => this.tick-e.tick < C.feedback.lifetimeTicks);
    this.checkOutcome();
  }
  snapshot() {
    return JSON.parse(JSON.stringify({ seed: this.seed, randomState: this.randomState, tick: this.tick, status: this.status,
      shots: this.shots, nextId: this.nextId, nextChain: this.nextChain, lastShotTick: this.lastShotTick,
      balls: this.balls, boss: this.boss, monsters: this.monsters, events: this.events, effects: this.effects,
      inputs: this.inputs, contacts: [...this.contacts].sort() }));
  }
}
