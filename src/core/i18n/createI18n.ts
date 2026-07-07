import { useMemo } from 'react';

import { I18n } from 'i18n-js';

export type Translator<K extends string = string> = (key: K) => string;

/**
 * Dot-separated key paths of a translation tree — derive an app's key union
 * from its canonical locale (`DotPaths<typeof translations.en>`) and pass it
 * as `createI18n`'s second type parameter so a typo'd key fails at compile
 * time instead of rendering `[missing ...]` at runtime.
 */
export type DotPaths<T> = T extends object
  ? {
      [K in Extract<keyof T, string>]: T[K] extends object
        ? `${K}.${DotPaths<T[K]>}`
        : K;
    }[Extract<keyof T, string>]
  : never;

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
export function createI18n<L extends string, K extends string = string>(
  translations: Record<string, object>,
  useLocaleState: () => LocaleState<L>,
  defaultLocale = 'en',
) {
  return function useI18n() {
    const { locale, setLocale } = useLocaleState();

    const t = useMemo<Translator<K>>(() => {
      const i18n = new I18n(translations);
      i18n.enableFallback = true;
      i18n.defaultLocale = defaultLocale;
      i18n.locale = locale;
      return (key: K) => i18n.t(key);
    }, [locale]);

    return { locale, setLocale, t };
  };
}
