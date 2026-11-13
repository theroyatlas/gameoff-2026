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
