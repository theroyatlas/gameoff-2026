import { describe, expect, it } from 'vitest';
import { createLanguage, LANGUAGE_KEY } from '../drafts/3d-web/language';
import { en, zhTW, cardText, t } from '../drafts/3d-web/i18n';
import { EVENT_CARDS } from '../src/event-cards';
import { Game } from '../src/game';

describe('language B', () => {
  const memory = () => { const values = new Map<string, string>(); return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } }; };
  it('defaults to English and rejects unknown stored values', () => {
    const storage = memory(); expect(createLanguage(() => storage).current).toBe('en');
    storage.setItem(LANGUAGE_KEY, 'bad'); expect(createLanguage(() => storage).current).toBe('en');
  });
  it('remembers both choices across instances', () => {
    const storage = memory(), state = createLanguage(() => storage);
    state.set('zh-TW'); expect(createLanguage(() => storage).current).toBe('zh-TW');
    state.set('en'); expect(createLanguage(() => storage).current).toBe('en');
  });
  it('falls back to English if storage access or reading throws, and survives failed writes', () => {
    expect(createLanguage(() => { throw Error('denied'); }).current).toBe('en');
    const state = createLanguage(() => ({ getItem() { throw Error('denied'); }, setItem() { throw Error('full'); } }));
    expect(state.current).toBe('en'); expect(() => state.set('zh-TW')).not.toThrow(); expect(state.current).toBe('zh-TW');
  });
  it('has identical keys and interpolation slots in both dictionaries', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zhTW).sort());
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(zhTW[key].length).toBeGreaterThan(0);
      expect(zhTW[key].match(/\{\w+\}/g)?.sort()).toEqual(en[key].match(/\{\w+\}/g)?.sort());
    }
  });
  it('uses singular English words when a count is exactly 1', () => {
    expect(t('shots', { v0: 1 }, 'en')).toBe('1 shot left');
    expect(t('shots', { v0: 0 }, 'en')).toBe('0 shots left');
    expect(t('shots', { v0: 3 }, 'en')).toBe('3 shots left');
    expect(t('bonus', { v0: 1, v1: 1 }, 'en')).toBe('Next turn: +1 shot · 1 lap');
    expect(t('bonus', { v0: 2, v1: 0 }, 'en')).toBe('Next turn: +2 shots · 0 laps');
    expect(t('next', { v0: 'Solid', v1: 1 }, 'en')).toBe('Next: Solid · 1 ball');
    expect(t('wave', { v0: 2, v1: 1 }, 'en')).toBe('Wave 2 · Next in 1 turn');
    expect(t('rtResult', { v0: 1, v1: 1, v2: 2 }, 'en')).toBe('1 second · 1 shot · 2 SHIFTs');
    expect(t('result', { outcome: 'Won.', turns: 1, shots: 2 }, 'en')).toMatch(/^Won\. 1 turn · 2 shots ·/);
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      for (const n of [0, 1, 2]) expect(t(key, { v0: n, v1: n, v2: n, n, shots: n, turns: n, id: n }, 'en')).not.toMatch(/\{\w+\|/);
    }
  });
  it('leaves Chinese count text unchanged', () => {
    expect(t('shots', { v0: 1 }, 'zh-TW')).toBe(zhTW.shots.replace('{v0}', '1'));
  });
  it('has names and descriptions for every event, including empty-field variants', () => {
    for (const card of EVENT_CARDS) for (const locale of ['en', 'zh-TW'] as const) for (const targetBallId of [undefined, 12]) {
      const text = cardText({ ...card, material: 1, targetBallId }, locale);
      expect(text.name).toBeTruthy(); expect(text.effect).toBeTruthy(); expect(text.effect).not.toMatch(/\{\w+\}/);
      if (locale === 'en') expect(text.name + text.effect).not.toMatch(/\p{Script=Han}/u);
    }
  });
  it('does not change a running game, including its seed and RNG stream', () => {
    const game = new Game(42, 'board'), control = new Game(42, 'board'); game.start(); control.start();
    const before = JSON.stringify(game.snapshot()), state = createLanguage(() => memory());
    state.set('zh-TW'); cardText({id:'rewind'}, state.current); state.set('en'); t('title');
    expect(JSON.stringify(game.snapshot())).toBe(before);
    game.rollBoard(); control.rollBoard(); for (let i=0;i<120;i++) { game.step(); control.step(); }
    expect(game.snapshot()).toEqual(control.snapshot());
  });
});
