/**
 * 怪物籠裡關的東西（?inside=a|b|c）。純資料，不碰 DOM 或 three.js，方便單元測試。
 * 不加參數時是 null：沿用籠內的暖白小光球。
 * a：紅漆木偶怪；b：毛線團怪；c：紙摺怪。三版都只換呈現，怪物的位置、數量、血量照規則。
 */
import type { ArtVariant } from './art-round2';

export function readInside(search: string): ArtVariant | null {
  const v = new URLSearchParams(search).get('inside');
  return v === 'a' || v === 'b' || v === 'c' ? v : null;
}

/** 反應時間表（秒）。受傷是短暫的晃動或縮起；擊破後籠子留在場上一下，播完倒下的動作才收走。 */
export const INSIDE_TIMING = { hit: .6, flinch: .35, defeat: .9 } as const;

/**
 * 血量對姿勢的影響：hp 是 0–1 的血量比例。回傳 0（滿血）到 1（快被打倒）的「害怕程度」。
 * 只依規則的血量算，不用亂數；減少動態時也照這個值直接換姿勢。
 */
export function cower(hp: number) {
  const h = Math.min(1, Math.max(0, hp));
  return Math.round((1 - h) * 100) / 100;
}
