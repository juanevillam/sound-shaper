import { useMemo } from 'react';

import { I18n, type TranslateOptions } from 'i18n-js';

export type Translator<K extends string = string> = (
  key: K,
  options?: TranslateOptions,
) => string;

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
 * Builds the `useI18n` hook — i18n-js wiring with fallback on and a memoized
 * translator keyed by locale — from the `translations` and locale type it is
 * handed (`src/i18n/index.tsx`).
 *
 * `useLocaleState` is a hook the app supplies that reads the current locale and
 * its setter from wherever the app keeps them (e.g. a zustand store) — this keeps
 * `src/core` decoupled from any specific store.
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
  /**
   * ONE TRANSLATOR PER LOCALE, AT CLOSURE SCOPE — never per component.
   *
   * `new I18n(translations)` deep-merges the app's ENTIRE translation tree
   * (lodash `merge`) into a fresh instance. Built inside the hook's `useMemo`,
   * that ran once per COMPONENT INSTANCE: every `useI18n` caller and every
   * mounted `Text` paid a full-tree merge on mount, and paid it all again on a
   * locale change — dozens to hundreds of identical merges per screen push,
   * for an answer that only varies with (tree, locale). The instances are
   * config-identical and stateless past construction, so all components on one
   * locale share one.
   */
  const byLocale = new Map<L, Translator<K>>();

  const translatorFor = (locale: L): Translator<K> => {
    const hit = byLocale.get(locale);
    if (hit) return hit;

    const i18n = new I18n(translations);
    i18n.enableFallback = true;
    i18n.defaultLocale = defaultLocale;
    i18n.locale = locale;
    const t: Translator<K> = (key: K, options?: TranslateOptions) =>
      i18n.t(key, options);
    byLocale.set(locale, t);
    return t;
  };

  return function useI18n() {
    const { locale, setLocale } = useLocaleState();

    // Stable per locale (the map), so consumers' memo deps still work.
    const t = useMemo<Translator<K>>(() => translatorFor(locale), [locale]);

    return { locale, setLocale, t };
  };
}
