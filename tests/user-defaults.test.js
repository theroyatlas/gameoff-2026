import { describe, expect, it } from 'vitest';
import { readChoice } from '../drafts/3d-web/style1';
import { readArt } from '../drafts/3d-web/art-round2';

const defaults = { ball: 'a', icon: 'b', light: 'c', ui: 'a', cage: 'b', card: 'a' };
const choices = (search) => {
  const { ring: _ring, ...style } = readChoice(search);
  return { ...style, ...readArt(search) };
};

describe('選定的六項外觀預設', () => {
  it('不加參數使用選定組合，每個參數都可獨立覆蓋且不改其他預設', () => {
    expect(choices('')).toEqual(defaults);
    for (const key of Object.keys(defaults)) {
      for (const variant of ['a', 'b', 'c']) {
        expect(choices(`?${key}=${variant}`)).toEqual({ ...defaults, [key]: variant });
      }
    }
    expect(choices('?ball=b&icon=c&light=a&ui=c&cage=a&card=b')).toEqual({
      ball: 'b', icon: 'c', light: 'a', ui: 'c', cage: 'a', card: 'b',
    });
  });
  it('切換籠內角色（?inside=）不影響六項預設', () => {
    for (const q of ['?inside=a', '?inside=b', '?inside=c', '?inside=']) expect(choices(q)).toEqual(defaults);
  });
  it('空值或無效值回到各自的預設', () => {
    expect(choices('?ball=&icon=d&light=C&ui=d&cage=&card=A')).toEqual(defaults);
  });
});
