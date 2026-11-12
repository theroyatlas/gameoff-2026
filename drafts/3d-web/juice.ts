/**
 * 回饋節奏的純函式：音階階梯、數字累加、撞擊分類。沒有 DOM、沒有 WebAudio，方便單元測試。
 * 數值只影響呈現，不回寫規則。
 */

/** 連鎖音階：大調五聲，逐層往上；超過一輪就升八度，最多兩個八度。 */
export const COMBO_SCALE = [0, 2, 4, 7, 9] as const;
export function comboSemitone(step: number) {
  const n = Math.max(0, Math.min(10, Math.floor(step)));
  return COMBO_SCALE[n % COMBO_SCALE.length] + 12 * Math.floor(n / COMBO_SCALE.length);
}

/** 連鎖視窗：最後一次爆發後 1.4 秒內再爆發，算同一串。 */
export const COMBO_WINDOW_SECONDS = 1.4;

/**
 * 累加數字往目標值追：差距越大跳越快，但每秒至少走 30，避免拖尾。
 * 回傳新的顯示值（整數），永不超過目標。
 */
export function tallyStep(shown: number, target: number, seconds: number) {
  if (shown >= target) return target;
  const gap = target - shown, rate = Math.max(30, gap * 9);
  return Math.min(target, shown + Math.max(1, Math.round(rate * Math.max(0, seconds))));
}

/** 撞擊速度（規則層 px/s）換成 0–1 力度；曲線前段較陡，輕碰也聽得到。 */
export function impactStrength(speed: number) {
  const v = Math.max(0, Math.min(1, speed / 1900));
  return Math.pow(v, .7);
}

export type ImpactKind = 'wall' | 'ball' | 'dome' | 'cage';
export interface Circle { x: number; y: number; radius: number }
/** 規則只記錄撞擊位置；呈現層依位置推回撞到什麼。邊界判斷留 1.5 px 容差。 */
export function classifyImpact(x: number, y: number, ballRadius: number, width: number, height: number, boss: Circle | null, monsters: readonly Circle[]): ImpactKind {
  const r = ballRadius + 1.5;
  if (x <= r || y <= r || x >= width - r || y >= height - r) return 'wall';
  if (boss && Math.hypot(x - boss.x, y - boss.y) <= ballRadius + boss.radius + 4) return 'dome';
  if (monsters.some(m => Math.hypot(x - m.x, y - m.y) <= ballRadius + m.radius + 4)) return 'cage';
  return 'ball';
}

/** 落格放大：0–1 的進度換成鏡頭推近比例。先快速推近，停住，再慢慢退回。 */
export function landingZoom(t: number) {
  if (t <= 0 || t >= 1) return 0;
  if (t < .18) return easeOut(t / .18);
  if (t < .55) return 1;
  return 1 - easeInOut((t - .55) / .45);
}
function easeOut(t: number) { return 1 - (1 - t) ** 3; }
function easeInOut(t: number) { return t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2; }

/** 數字跳動：新增的那一下放大到 1.35 再回到 1，0.22 秒。 */
export function punchScale(age: number) {
  if (age < 0 || age >= .22) return 1;
  const t = age / .22;
  return 1 + .35 * Math.sin(Math.PI * t) * (1 - t * .4);
}
