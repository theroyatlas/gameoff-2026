import { describe, expect, it } from 'vitest';
import { bindRevealSkip } from '../drafts/3d-web/reveal-input';
import { revealMoments } from '../drafts/3d-web/art-round2';

describe('抽卡展示跳過', () => {
  it('點擊、空白鍵與 Enter 跳到結束且不穿透遊戲操作', () => {
    const target = new EventTarget(); let active = true, completed = 0, gameplay = 0;
    const dispose = bindRevealSkip(target, () => active, () => { active = false; completed++; });
    target.addEventListener('click', () => gameplay++);
    target.addEventListener('keydown', () => gameplay++);
    const emit = (type: string, props = {}) => {
      const e = Object.assign(new Event(type, { cancelable: true }), props);
      target.dispatchEvent(e); return e.defaultPrevented;
    };
    expect(emit('pointerdown', { button: 0, pointerId: 1, isPrimary: true })).toBe(true);
    expect(emit('pointerup', { pointerId: 1 })).toBe(true);
    expect(emit('click')).toBe(true);
    for (const code of ['Space', 'Enter', 'NumpadEnter']) {
      active = true;
      expect(emit('keydown', { code, repeat: false })).toBe(true);
      expect(active).toBe(false);
      expect(emit('keydown', { code, repeat: true })).toBe(true);
      expect(emit('keyup', { code })).toBe(true);
    }
    expect(completed).toBe(4); expect(gameplay).toBe(0);
    expect(emit('click')).toBe(false); expect(gameplay).toBe(1);
    dispose();
    expect(revealMoments().end).toBeCloseTo(2.17);
  });
});


describe('language selection during a reveal', () => {
  it('lets the language control act without skipping the card or swallowing its click', () => {
    const target = new EventTarget(); let finished = 0, clicks = 0;
    const dispose = bindRevealSkip(target, () => true, () => finished++, e => (e as Event & { languageControl?: boolean }).languageControl === true);
    target.addEventListener('click', () => clicks++);
    for (const type of ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup']) {
      const event = Object.assign(new Event(type, { cancelable: true }), { languageControl: true, button: 0, pointerId: 7, code: 'Enter' });
      target.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
    }
    expect(finished).toBe(0); expect(clicks).toBe(1); dispose();
  });
});
