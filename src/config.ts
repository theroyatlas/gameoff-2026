export const CONFIG = {
  width: 800, height: 680, dt: 1 / 120, seed: 20261110,
  ball: { radius: 14, speed: 1280, restitution: 0.88, friction: 0.65, stopSpeed: 12, resonanceBoost: 1.32, maxSpeed: 1850 },
  launcher: { x: 400, y: 622, coneHalfAngle: Math.PI / 15, minDrag: 12, intervalTicks: 28 },
  resonance: {
    threshold: 2, radiusInBalls: 17, ignite: 3, cooldownTicks: 2400,
    // wallCharge：0 不累積、0.5 半量、1 全量；已共振時撞牆仍自動爆發。
    wallCharge: 1,
    // 1 關閉衰減；第 d 層的點燃量乘上此值的 (d-1) 次方，傷害維持整數。
    igniteDepthDecay: 0.8,
    sameFrequencyMultiplier: 2, interferenceMomentum: 0.45, interferenceTicks: 48,
  },
  materials: [
    { name: '實心', frequency: 1, shade: 110 },
    { name: '環紋', frequency: 2, shade: 145 },
    { name: '雙紋', frequency: 3, shade: 175 },
  ],
  boss: { x: 400, y: 340, radius: 48, hp: 12000 },
  monsters: { everyShots: 4, hp: 60, radius: 21, loseAbove: 10, edgeInset: 42 },
  difficulty: { waveSeconds: 30, firstWaveSeconds: 15, graceSeconds: 60, hpGrowth: 180, upgradeAt: 0.5 },
  shift: { threshold: 3, warningTicks: 84, durationTicks: 600, cooldownTicks: 14400, friction: 0.055, wakeSpeed: 430 },
  damage: { normal: 3, resonant: 5, burstExtra: 20 },
  feedback: { lifetimeTicks: 72, burstTicks: 40, igniteTicks: 30, targetFlashTicks: 18, damageMergeTicks: 24 },
  board: {
    shotsPerTurn: 3, lapBonusShots: 1, dieSides: 6,
    rollTicks: 36, moveTicks: 18, effectTicks: 60, settleMaxTicks: 720,
    surgeCharge: 1, tuneThresholdReduction: 1, tuneMultiplier: 1.5,
    waveEveryTurns: 3, waveBaseCount: 2, waveCountGrowth: 1,
    wavesPerCountGrowth: 2, waveMaxCount: 8, waveHpGrowth: 300,
    events: { bonusShots: 1, rewind: 1, burstMultiplier: 2, bossDamage: 60 },
    tiles: [
      { kind: 'START' }, { kind: 'SURGE' }, { kind: 'TUNE', material: 0 },
      { kind: 'EVENT' }, { kind: 'SURGE' }, { kind: 'TUNE', material: 1 },
      { kind: 'SURGE' }, { kind: 'EVENT' }, { kind: 'TUNE', material: 2 },
      { kind: 'SURGE' }, { kind: 'TUNE', material: 0 }, { kind: 'EVENT' },
      { kind: 'SURGE' }, { kind: 'TUNE', material: 1 },
    ],
  },
} as const;
