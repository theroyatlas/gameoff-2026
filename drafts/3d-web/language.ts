export type Language = 'en' | 'zh-TW';
export const LANGUAGE_KEY = 'resonance.language';
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;

/** Storage may be denied, including when the offline HTML is opened directly. */
export function createLanguage(access: StorageAccess = () => localStorage) {
  let current: Language = 'en';
  const listeners = new Set<() => void>();
  try { if (access().getItem(LANGUAGE_KEY) === 'zh-TW') current = 'zh-TW'; } catch { /* English fallback. */ }
  return {
    get current() { return current; },
    set(value: Language) {
      current = value;
      try { access().setItem(LANGUAGE_KEY, value); } catch { /* The current session still works. */ }
      listeners.forEach(listener => listener());
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
export const language = createLanguage();

export function mountLanguageButton(parent: HTMLElement) {
  const button = document.createElement('button'); button.id = 'language-toggle'; button.type = 'button';
  const update = () => {
    document.documentElement.lang = language.current;
    button.textContent = language.current === 'en' ? '中文' : 'English';
    button.lang = language.current === 'en' ? 'zh-TW' : 'en';
    button.setAttribute('aria-label', language.current === 'en' ? 'Switch to Chinese' : '切換為英文');
  };
  button.addEventListener('click', () => language.set(language.current === 'en' ? 'zh-TW' : 'en'));
  language.subscribe(update); update(); parent.append(button);
  return button;
}
