import { useSyncExternalStore } from 'react';

import {
  DEFAULT_THEME,
  SUPPORTED_THEMES,
  type Theme,
} from '@app/core/theme/themes';

/**
 * Settings' Appearance row, as in the app (src/core/theme/themes.ts):
 * Automatic follows the browser's light or dark, Light and Dark force it.
 * The choice is kept on this device, like the language.
 *
 * The page draws from CSS tokens (styles.css), so the whole job here is one
 * attribute: `data-theme` on <html> names the scheme in force. index.html
 * sets it before the first paint from the same key, so a light page never
 * flashes dark on load; this module keeps it current afterwards.
 */
const THEME_KEY = 'soundshaper.theme';

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

const readTheme = (): Theme => {
  try {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    return saved && SUPPORTED_THEMES.includes(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

/** A live binding: importers read the current choice, not the first. */
export let theme = readTheme();

/** The scheme in force — what Automatic resolved to, or the forced one. */
export let scheme: 'light' | 'dark' = 'dark';

const listeners = new Set<() => void>();

const apply = () => {
  scheme = theme === 'system' ? (darkQuery.matches ? 'dark' : 'light') : theme;
  const root = document.documentElement;
  root.dataset.theme = scheme;
  // The browser's own chrome — form controls, scrollbars, the address bar.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', scheme === 'dark' ? '#0d0d0d' : '#f2f2f7');
  listeners.forEach(listener => listener());
};

apply();
darkQuery.addEventListener('change', () => {
  if (theme === 'system') apply();
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useTheme = (): Theme =>
  useSyncExternalStore(subscribe, () => theme);

/** For what CSS cannot reach — a canvas draws in literal colours. */
export const useScheme = () => useSyncExternalStore(subscribe, () => scheme);

export { SUPPORTED_THEMES };

export const setTheme = (next: Theme) => {
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Private mode: the choice lasts this visit.
  }
  theme = next;
  apply();
};
