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
const pickLocale = (): Locale => {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split('-')[0] as Locale;

    if (SUPPORTED_LOCALES.includes(base)) return base;
  }

  return 'en';
};

export const locale = pickLocale();

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
