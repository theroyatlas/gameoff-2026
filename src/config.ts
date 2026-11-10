export const CONFIG = {
  width: 800, height: 680, dt: 1 / 120, seed: 20261110,
  ball: { radius: 14, speed: 620, restitution: 0.96, friction: 0.12, stopSpeed: 2 },
  launcher: { x: 400, y: 622, coneHalfAngle: Math.PI / 15, minDrag: 12, intervalTicks: 28 },
  resonance: {
    threshold: 5, radiusInBalls: 6, ignite: 2, cooldownTicks: 18,
    sameFrequencyMultiplier: 2, interferenceMomentum: 0.45, interferenceTicks: 48,
  },
  materials: [
    { name: '實心', frequency: 1, shade: 110 },
    { name: '環紋', frequency: 2, shade: 145 },
    { name: '雙紋', frequency: 3, shade: 175 },
  ],
  boss: { x: 400, y: 340, radius: 48, hp: 3000 },
  monsters: { everyShots: 5, hp: 900, radius: 21, loseAbove: 10, edgeInset: 42 },
  damage: { normal: 10, resonant: 25, burstExtra: 10 },
  feedback: { lifetimeTicks: 72, burstTicks: 40, igniteTicks: 30, targetFlashTicks: 18, damageMergeTicks: 24 },
} as const;
