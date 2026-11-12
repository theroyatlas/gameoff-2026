/** 近景僅定義呈現尺寸；球心、規則半徑、射擊角度與 RNG 不在此層修改。 */
export function closeupView(camera: string | null) {
  return {
    close: camera === 'fieldA' || camera === 'fieldB',
    cropped: camera === 'fieldA',
    ballScale: camera === 'fieldB' ? 2.2 : 1,
    halfWidth: camera === 'fieldA' ? 2.25 : 4.15,
    halfDepth: camera === 'fieldA' ? 1.75 : 3.55,
  };
}

/** 扇形只表示發射角散射區間，不預測碰撞、反彈或落點。 */
export function aimFan(angle: number, halfAngle: number, x: number, z: number) {
  return [x, .03, z,
    x + Math.cos(angle - halfAngle) * 12, .03, z + Math.sin(angle - halfAngle) * 12,
    x + Math.cos(angle + halfAngle) * 12, .03, z + Math.sin(angle + halfAngle) * 12];
}
