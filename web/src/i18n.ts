import { useSyncExternalStore } from 'react';

import {
  SUPPORTED_LOCALES,
  translations,
  type Locale,
} from '@app/i18n/translations';

/**
 * The app's own strings (src/i18n/translations.ts), never a copy: the web
 * says exactly what the iOS app says. The language is the browser's, as the
 * app's is the phone's, falling back to English.
 */
const LOCALE_KEY = 'soundshaper.locale';

const chosenLocale = (): Locale | null => {
  try {
    const saved = localStorage.getItem(LOCALE_KEY) as Locale | null;
    return saved && SUPPORTED_LOCALES.includes(saved) ? saved : null;
  } catch {
    return null;
  }
};

const pickLocale = (): Locale => {
  const chosen = chosenLocale();
  if (chosen) return chosen;

  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split('-')[0] as Locale;

    if (SUPPORTED_LOCALES.includes(base)) return base;
  }

  return 'en';
};

/** A live binding: importers read the current language, not the first. */
export let locale = pickLocale();

const listeners = new Set<() => void>();

/**
 * The app root subscribes, so a new language re-renders the whole tree in
 * place — nothing reloads, and the sound keeps playing.
 */
export const useLocale = (): Locale =>
  useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => locale,
  );

export { SUPPORTED_LOCALES };

/**
 * Settings' Language row, as in the app: the choice outranks the browser's
 * and is kept on this device. It applies at once, without a reload (Juan,
 * 2026-11-04: a full refresh was the jarring part).
 */
export const setLocale = (next: Locale) => {
  try {
    localStorage.setItem(LOCALE_KEY, next);
  } catch {
    // Private mode: the choice lasts this visit.
  }
  locale = next;
  document.documentElement.lang = next;
  listeners.forEach(listener => listener());
};

document.documentElement.lang = locale;

type Tree = { readonly [key: string]: string | Tree };

/** `t('welcome.button.google.label')`, with `{name}` placeholders filled. */
export const t = (key: string, values?: Record<string, string>): string => {
  const found = key
    .split('.')
    .reduce<
      string | Tree | undefined
    >((node, part) => (typeof node === 'object' ? node[part] : undefined), translations[locale] as Tree);
  const text = typeof found === 'string' ? found : key;

  return values
    ? text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match)
    : text;
};
