import { describe, expect, it } from 'vitest';
import { readInside, cower } from '../drafts/3d-web/inside';
import { readArt } from '../drafts/3d-web/art-round2';
import { readChoice } from '../drafts/3d-web/style1';

describe('籠子裡關的東西（?inside=）', () => {
  it('不加參數時是預設值（暖白小光球），加參數可以覆蓋', () => {
    expect(readInside('')).toBeNull();
    for (const v of ['a', 'b', 'c'] as const) expect(readInside(`?inside=${v}`)).toBe(v);
    expect(readInside('?cage=a&inside=c&card=b')).toBe('c');
  });
  it('空值或無效值回到預設，且不影響已選的六項預設', () => {
    for (const q of ['?inside=', '?inside=d', '?inside=A', '?inside=ab']) expect(readInside(q)).toBeNull();
    expect(readArt('?inside=a')).toEqual({ ui: 'a', cage: 'b', card: 'a' });
    const { ring: _ring, ...style } = readChoice('?inside=b');
    expect(style).toEqual({ ball: 'a', icon: 'b', light: 'c' });
  });
  it('害怕程度只依規則血量：滿血 0、見底 1，單調遞增', () => {
    expect(cower(1)).toBe(0); expect(cower(0)).toBe(1); expect(cower(2)).toBe(0); expect(cower(-1)).toBe(1);
    let last = -1; for (let hp = 1; hp >= 0; hp -= .05) { const f = cower(hp); expect(f).toBeGreaterThanOrEqual(last); last = f; }
  });
});
