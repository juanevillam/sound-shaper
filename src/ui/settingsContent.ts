import type {
  SettingsAboutConfig,
  SettingsRadioSection,
} from './SettingsScreen';

type Translate = (key: string) => string;

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
 * The "General" preferences: a language picker and a theme picker. Option
 * labels are derived from a fixed key convention (`settings.language.<code>` /
 * `settings.theme.<value>`), so the caller only supplies the translator and the
 * supported lists — no label maps.
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
 * The standard "About" block: the installed app version (read from the native
 * binary, so it reflects what's actually on the device).
 */
/**
 * NO FRAMEWORK VERSION. This used to carry an "Expo UI Version" row linking to
 * the Expo docs, and it is gone deliberately (Juan, 2026-08-20):
 * a shipped product should not announce what it is built with. Anyone reading
 * that row learns the app is React Native, which is an invitation to go looking.
 *
 * It is worth being straight about what this buys. A determined reader gets the
 * same answer out of the IPA in seconds — Hermes and the Expo frameworks are
 * right there in the bundle — so this is not a security control. What it is: a
 * framework version has NO user-facing purpose in a product, so it was dev
 * chrome that had no business shipping, and removing it costs nothing.
 *
 * The APP version stays. It is the one thing here a person might genuinely need
 * ("what version are you on?"), it is where Apple puts it, and it gives nothing
 * away.
 */
export const buildAboutSettingsSection = (
  t: Translate,
  appVersion: string,
): SettingsAboutConfig => ({
  title: t('settings.about.title'),
  rows: [
    {
      label: t('settings.about.appVersion'),
      value: appVersion,
    },
  ],
});
