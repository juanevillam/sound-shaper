import { Platform } from 'react-native';

import type {
  SettingsAboutConfig,
  SettingsInfoRow,
  SettingsRadioSection,
} from './SettingsScreen';

type Translate = (key: string) => string;

/**
 * The published @expo/ui docs, per platform — the standard "About" row links
 * here. Same across every portfolio app, so it lives with the builder.
 */
const EXPO_UI_DOCS_URL = Platform.select({
  ios: 'https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/',
  default: 'https://docs.expo.dev/versions/latest/sdk/ui/jetpack-compose/',
}) as string;

/**
 * Live preference state for the standard "General" section. Generic over the
 * app's `Locale` / `Theme` string-literal unions so the host passes its typed
 * store setters straight through — the value→union narrowing happens here.
 */
export type GeneralSettingsState<L extends string, Th extends string> = {
  locale: L;
  setLocale: (value: L) => void;
  supportedLocales: readonly L[];
  theme: Th;
  setTheme: (value: Th) => void;
  supportedThemes: readonly Th[];
};

/**
 * The "General" preferences every portfolio app shares: a language picker and a
 * theme picker. Option labels are derived from a fixed key convention
 * (`settings.language.<code>` / `settings.theme.<value>`), so apps only supply
 * the translator and their supported lists — no per-app label maps.
 */
export const buildGeneralSettingsSections = <
  L extends string,
  Th extends string,
>(
  t: Translate,
  state: GeneralSettingsState<L, Th>,
): SettingsRadioSection[] => [
  {
    title: t('settings.language.label'),
    options: state.supportedLocales.map(code => ({
      value: code,
      label: t(`settings.language.${code}`),
    })),
    selected: state.locale,
    onSelect: value => state.setLocale(value as L),
  },
  {
    title: t('settings.theme.label'),
    options: state.supportedThemes.map(value => ({
      value,
      label: t(`settings.theme.${value}`),
    })),
    selected: state.theme,
    onSelect: value => state.setTheme(value as Th),
  },
];

/**
 * The standard "About" block: the installed app version first (read from the
 * native binary, so it reflects what's actually on the device), then the
 * bundled @expo/ui version linking to that platform's @expo/ui docs.
 */
export const buildAboutSettingsSection = (
  t: Translate,
  appVersion: string,
  expoUiVersion: string,
  /** App-specific trailing rows, e.g. Topper's legal-page links (stores
   *  require the privacy policy reachable from inside the app). */
  extraRows: SettingsInfoRow[] = [],
): SettingsAboutConfig => ({
  title: t('settings.about.title'),
  rows: [
    {
      label: t('settings.about.appVersion'),
      value: appVersion,
    },
    {
      label: t('settings.about.expoUiVersion'),
      value: expoUiVersion,
      url: EXPO_UI_DOCS_URL,
    },
    ...extraRows,
  ],
});
