# Core

`src/core` (imported as `@/core`) — the app's **non-visual foundation**: theme
resolution, the persisted theme and locale stores, and the i18n wiring. The UI
kit in `src/ui` (see [`ui.md`](ui.md)) sits on top of it.

## Exports

| Export                                                                                 | Purpose                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAppTheme` / `ResolvedScheme`                                                       | Resolves the active scheme (from `useThemeStore`) into the palette: `IOS_COLORS` on iOS, the live Material 3 palette via `getMaterialColors` on Android, `FALLBACK_COLORS` anywhere else. |
| `AppColors`, `materialToAppColors`, `FALLBACK_COLORS`, `IOS_COLORS`, `withAlpha`       | Semantic colour roles, the Material → roles mapper, the per-platform baselines, and an `#RRGGBBAA` alpha helper.                                                                          |
| `Theme`, `SUPPORTED_THEMES`, `DEFAULT_THEME`                                           | Theme-preference type and option list (`system` / `light` / `dark`).                                                                                                                      |
| `SCREEN_PADDING`, `SECTION_GAP`, `TILE_GAP`, `ROW_INSET`, `opticalTextInset`           | Layout metrics, and the nudge TEXT takes under a rounded shape (shapes do not).                                                                                                           |
| `useThemeStore`                                                                        | Persisted theme preference (`theme`, `setTheme`, `hasHydrated`).                                                                                                                          |
| `createLayoutStore`                                                                    | Builds the persisted locale store (device default, AsyncStorage, `hasHydrated` gate) from `SUPPORTED_LOCALES`; `src/store/layout.ts` is its one call.                                     |
| `createI18n(translations, useLocaleState, defaultLocale?)` / `Translator` / `DotPaths` | Builds the `useI18n` hook (i18n-js + fallback + memoization) from the translations, locale type and locale store it is handed.                                                            |

There is no brand seed and no per-app theme config: the palette is the
platform's own (wallpaper-derived Material You on Android). The rule for when
the Android palette fails to separate two roles is in
[`standards.md`](standards.md) → "An OEM palette may collapse roles".

## Usage

`src/i18n/index.tsx` binds the factory to this app's translations and locale
store:

```tsx
import { createI18n, type DotPaths } from '@/core';
import { useLayoutStore } from '@/store/layout';
import { translations, type Locale } from './translations';

const useLocaleState = () => ({
  locale: useLayoutStore(s => s.locale),
  setLocale: useLayoutStore(s => s.setLocale),
});

export type TranslationKey = DotPaths<typeof translations.en>;
export const useI18n = createI18n<Locale, TranslationKey>(
  translations,
  useLocaleState,
);
```

Everything else imports `useAppTheme` and the metrics from `@/core` directly.
