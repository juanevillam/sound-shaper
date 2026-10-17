import { createI18n, type DotPaths } from '@/core';

import { useLayoutStore } from '@/store/layout';

import { translations, type Locale } from './translations';

// Read the current locale + setter from the app's layout store. Passed to core's
// `createI18n` so the shared i18n-js wiring stays decoupled from the store.
const useLocaleState = () => ({
  locale: useLayoutStore(s => s.locale),
  setLocale: useLayoutStore(s => s.setLocale),
});

/**
 * Every valid translation key, derived from the English tree (the canonical
 * locale — the others mirror its shape). A typo'd key is a compile error
 * instead of a runtime `[missing ...]` render.
 */
export type TranslationKey = DotPaths<typeof translations.en>;

export const useI18n = createI18n<Locale, TranslationKey>(
  translations,
  useLocaleState,
);

export type { Locale };
