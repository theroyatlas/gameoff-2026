import { describe, expect, it } from 'vitest';
import { readInside, cower, DEFAULT_INSIDE } from '../drafts/3d-web/inside';
import { readArt } from '../drafts/3d-web/art-round2';

describe('籠子裡關的東西（?inside=）', () => {
  it('不加參數時是預設的 c 紙摺怪，加參數可以換成 a 或 b', () => {
    expect(DEFAULT_INSIDE).toBe('c');
    expect(readInside('')).toBe('c');
    expect(readInside('?cage=a&card=b')).toBe('c');
    for (const v of ['a', 'b', 'c'] as const) expect(readInside(`?inside=${v}`)).toBe(v);
    expect(readInside('?cage=a&inside=a&card=b')).toBe('a');
  });
  it('空值或無效值回到預設，且不影響已選的六項預設', () => {
    for (const q of ['?inside=', '?inside=d', '?inside=A', '?inside=ab', '?inside=none']) expect(readInside(q)).toBe('c');
    expect(readArt('?inside=a')).toEqual({ ui: 'a', cage: 'b', card: 'a' });
    // ball／icon／light 的部分在 user-defaults.test.js 檢查（style1 會載入 three.js，型別檢查只涵蓋純資料模組）。
  });
  it('害怕程度只依規則血量：滿血 0、見底 1，單調遞增', () => {
    expect(cower(1)).toBe(0); expect(cower(0)).toBe(1); expect(cower(2)).toBe(0); expect(cower(-1)).toBe(1);
    let last = -1; for (let hp = 1; hp >= 0; hp -= .05) { const f = cower(hp); expect(f).toBeGreaterThanOrEqual(last); last = f; }
  });
});
