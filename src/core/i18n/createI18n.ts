import { useMemo } from 'react';

import { I18n } from 'i18n-js';

export type Translator = (key: string) => string;

type LocaleState<L extends string> = {
  locale: L;
  setLocale: (locale: L) => void;
};

/**
 * Builds the shared `useI18n` hook so every app gets identical i18n-js wiring
 * (fallback on, memoized translator keyed by locale) while owning its own
 * `translations` and locale type.
 *
 * `useLocaleState` is a hook the app supplies that reads the current locale and
 * its setter from wherever the app keeps them (e.g. a zustand store) — this keeps
 * `@portfolio/core` decoupled from any specific store.
 *
 * @example
 * const useLocaleState = () => ({
 *   locale: useLayoutStore(s => s.locale),
 *   setLocale: useLayoutStore(s => s.setLocale),
 * });
 * export const useI18n = createI18n<Locale>(translations, useLocaleState);
 */
export function createI18n<L extends string>(
  translations: Record<string, object>,
  useLocaleState: () => LocaleState<L>,
  defaultLocale = 'en',
) {
  return function useI18n() {
    const { locale, setLocale } = useLocaleState();

    const t = useMemo<Translator>(() => {
      const i18n = new I18n(translations);
      i18n.enableFallback = true;
      i18n.defaultLocale = defaultLocale;
      i18n.locale = locale;
      return (key: string) => i18n.t(key);
    }, [locale]);

    return { locale, setLocale, t };
  };
}
