export const CONFIG = {
  width: 800, height: 680, dt: 1 / 120, seed: 20261110,
  ball: { radius: 14, speed: 620, restitution: 0.8, friction: 0.35, stopSpeed: 8 },
  launcher: { x: 400, y: 622, coneHalfAngle: Math.PI / 15, minDrag: 12, intervalTicks: 28 },
  resonance: {
    threshold: 10, radiusInBalls: 8, ignite: 5, cooldownTicks: 2400,
    // wallCharge：0 不累積、0.5 半量、1 全量；已共振時撞牆仍自動爆發。
    wallCharge: 0,
    // 1 關閉衰減；第 d 層的點燃量乘上此值的 (d-1) 次方，傷害維持整數。
    igniteDepthDecay: 0.8,
    sameFrequencyMultiplier: 2, interferenceMomentum: 0.45, interferenceTicks: 48,
  },
  materials: [
    { name: '實心', frequency: 1, shade: 110 },
    { name: '環紋', frequency: 2, shade: 145 },
    { name: '雙紋', frequency: 3, shade: 175 },
  ],
  boss: { x: 400, y: 340, radius: 48, hp: 300 },
  monsters: { everyShots: 4, hp: 60, radius: 21, loseAbove: 10, edgeInset: 42 },
  damage: { normal: 3, resonant: 5, burstExtra: 20 },
  feedback: { lifetimeTicks: 72, burstTicks: 40, igniteTicks: 30, targetFlashTicks: 18, damageMergeTicks: 24 },
} as const;
