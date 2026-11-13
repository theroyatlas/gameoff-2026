import { t } from './i18n';
import type { Language } from './language';
/**
 * 美術第二輪的三組可挑選版本（介面、怪物籠、事件卡卡面）。純資料，不碰 DOM 或 three.js，方便單元測試。
 * 不加參數時使用紙卡介面、毛線木樁籠與手繪紙卡。
 */
export type ArtVariant = 'a' | 'b' | 'c';
export interface ArtChoice { ui: ArtVariant | null; cage: ArtVariant | null; card: ArtVariant | null }

export function readArt(search: string): ArtChoice {
  const q = new URLSearchParams(search);
  const pick = (key: string, fallback: ArtVariant) => { const v = q.get(key); return v === 'a' || v === 'b' || v === 'c' ? v : fallback; };
  return { ui: pick('ui', 'a'), cage: pick('cage', 'b'), card: pick('card', 'a') };
}

export interface EventCardValues { bonusShots: number; rewind: number; burstMultiplier: number; bossDamage: number }
export interface CardFace {
  /** 卡面大字；count 有值時翻開後從 0 跳到這個數。 */
  headline: string; prefix: string; count: number | null; suffix: string;
  /** 卡面下方的短句，完整效果文字仍留在操作區。 */
  short: string;
}

/** 卡面上的大字與短句，數值一律取自規則設定（CONFIG.board.events），呈現層不另訂數值。 */
export function cardFace(id: string, values: EventCardValues, materialName?: string, targetBallId?: number, locale: Language = 'zh-TW'): CardFace {
  const tr = (key: Parameters<typeof t>[0], values = {}) => t(key, values, locale);
  const face = (prefix: string, count: number | null, suffix: string, short: string): CardFace =>
    ({ headline: `${prefix}${count ?? ''}${suffix}`, prefix, count, suffix, short });
  switch (id) {
    case 'extra-shot': return face('+', values.bonusShots, tr('shotsSuffix'), tr('extraShort'));
    case 'change-material': return face('→ ', null, materialName ?? tr('materialSwap'), tr('materialShort'));
    case 'rewind': return face(tr('clockPrefix'), values.rewind, '', tr('rewindShort'));
    case 'double-burst': return face('×', values.burstMultiplier, '', targetBallId !== undefined ? tr('doubleTarget', { id: targetBallId }) : tr('doubleShort'));
    case 'burst-now': return face('', null, tr('burst'), targetBallId !== undefined ? tr('burstTarget', { id: targetBallId }) : tr('burstShort'));
    case 'chip-boss': return face('−', values.bossDamage, '', tr('chipShort'));
    default: return face('', null, '?', '');
  }
}

/**
 * 抽卡展示的時間表（秒）。翻卡、蓋章、數字跳動、收進操作區都依這張表走；
 * 減少動態時不走時間表，只顯示靜態卡面。
 */
export const REVEAL = { rise: .22, shake: .2, flip: .2, stamp: .12, count: .45, hold: .75, fly: .35 } as const;
export function revealMoments() {
  const flipAt = REVEAL.rise + REVEAL.shake, stampAt = flipAt + REVEAL.flip, countEnd = stampAt + REVEAL.count;
  const flyAt = countEnd + REVEAL.hold, end = flyAt + REVEAL.fly;
  return { flipAt, stampAt, countEnd, flyAt, end };
}
/** 數字跳動：翻開後 0 → 目標值，前段快、後段慢；回傳整數。 */
export function revealCount(t: number, target: number) {
  const { stampAt, countEnd } = revealMoments();
  if (t <= stampAt) return 0;
  if (t >= countEnd) return target;
  const k = (t - stampAt) / (countEnd - stampAt);
  return Math.min(target, Math.round(target * (1 - (1 - k) ** 3)));
}
