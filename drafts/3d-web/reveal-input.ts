/** 展示的跳過手勢由捕捉階段接住，不能同時發射、擲骰或捲動。 */
export function bindRevealSkip(target: EventTarget, active: () => boolean, finish: () => void, bypass: (event: Event) => boolean = () => false) {
  let pointer: number | null = null, swallowClick = false;
  const held = new Set<string>();
  const consume = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); };
  const down = (event: Event) => {
    if (bypass(event)) return;
    const e = event as PointerEvent;
    if (e.button !== 0 || e.isPrimary === false) return;
    swallowClick = false;
    if (!active()) return;
    pointer = e.pointerId; swallowClick = true; consume(e); finish();
  };
  const up = (event: Event) => {
    const e = event as PointerEvent;
    if (e.pointerId !== pointer) return;
    consume(e); pointer = null;
  };
  const click = (e: Event) => {
    if (bypass(e)) return;
    if (swallowClick) { swallowClick = false; consume(e); }
    else if (active()) { consume(e); finish(); }
  };
  const keydown = (event: Event) => {
    if (bypass(event)) return;
    const e = event as KeyboardEvent;
    if (!['Space', 'Enter', 'NumpadEnter'].includes(e.code)) return;
    if (held.has(e.code)) { consume(e); return; }
    if (!active()) return;
    consume(e); held.add(e.code); finish();
  };
  const keyup = (event: Event) => {
    const e = event as KeyboardEvent;
    if (held.delete(e.code)) consume(e);
  };
  const handlers: Record<string, EventListener> = { pointerdown: down, pointerup: up, pointercancel: up, click, keydown, keyup };
  for (const [name, fn] of Object.entries(handlers)) target.addEventListener(name, fn, true);
  return () => { for (const [name, fn] of Object.entries(handlers)) target.removeEventListener(name, fn, true); };
}
