import { describe, expect, it } from 'vitest';
import { readArt, cardFace, revealCount, revealMoments } from '../drafts/3d-web/art-round2';
import { CONFIG as C } from '../src/config';
import { EVENT_CARDS } from '../src/event-cards';

describe('美術第二輪的版本參數與卡面文字', () => {
  it('不加參數時三組都是 null（維持改版前畫面），只接受 a／b／c', () => {
    expect(readArt('')).toEqual({ ui: null, cage: null, card: null });
    expect(readArt('?ui=b&cage=c&card=a&ball=a')).toEqual({ ui: 'b', cage: 'c', card: 'a' });
    expect(readArt('?ui=d&cage=&card=A')).toEqual({ ui: null, cage: null, card: null });
  });
  it('卡面數字取自規則設定，六張卡都有大字', () => {
    const v = C.board.events;
    expect(cardFace('extra-shot', v).headline).toBe(`+${v.bonusShots} 發`);
    expect(cardFace('chip-boss', v).count).toBe(v.bossDamage);
    expect(cardFace('double-burst', v, undefined, 7).short).toContain('#7');
    expect(cardFace('change-material', v, '環紋').headline).toBe('→ 環紋');
    for (const card of EVENT_CARDS) expect(cardFace(card.id, v).headline.length).toBeGreaterThan(0);
  });
  it('數字跳動從 0 單調走到目標值，蓋章前為 0', () => {
    const m = revealMoments(); let last = 0;
    expect(revealCount(m.stampAt - .01, 60)).toBe(0);
    for (let t = m.stampAt; t <= m.countEnd + .1; t += .02) { const n = revealCount(t, 60); expect(n).toBeGreaterThanOrEqual(last); last = n; }
    expect(last).toBe(60);
  });
});
