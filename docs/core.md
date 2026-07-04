# Core

`@portfolio/core` — shared **app foundation** for the monorepo's Expo apps:
theme resolution, persisted state stores, and i18n wiring. UI components live in
[`@portfolio/mobile-ui`](../mobile-ui); this package is the non-visual layer
underneath them, so every app handles theming, auth, and translations the same way.

Private and workspace-only. Consumed as **TypeScript source** — `main` / `types`
point at `src/index.ts`, so there is **no build step**; apps transpile it through
their own Metro / Babel.

## Exports

| Export                                                                           | Purpose                                                                                                                                 |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `useAppTheme` / `ResolvedScheme`                                                 | Resolves the active scheme (from `useThemeStore`) into the live Material 3 palette via `getMaterialColors`; falls back off-Android.     |
| `AppColors`, `materialToAppColors`, `FALLBACK_COLORS`, `IOS_COLORS`, `withAlpha` | Semantic color roles, the Material → roles mapper, the off-Android baselines, and an `#RRGGBBAA` alpha helper.                          |
| `configureAppTheme` / `getAppThemeConfig` / `AppThemeConfig`                     | Optional per-app theme config hook-up (all portfolio apps currently ride the platform-default palette — no brand seed).                 |
| `Theme`, `SUPPORTED_THEMES`, `DEFAULT_THEME`                                     | Theme-preference type and option list (`system` / `light` / `dark`).                                                                    |
| `useThemeStore`                                                                  | Persisted theme preference (`theme`, `setTheme`, `hasHydrated`).                                                                        |
| `useAuthStore`                                                                   | Persisted auth flag (`isAuthenticated`, `signIn`, `signOut`, `hasHydrated`). Wire `signIn`/`signOut` to a real provider per app.        |
| `createI18n(translations, useLocaleState, defaultLocale?)` / `Translator`        | Builds the shared `useI18n` hook (i18n-js + fallback + memoization). The app injects its `translations`, locale type, and locale store. |

## Usage

```tsx
// theming — app re-exports for a stable internal path
export { useAppTheme } from '@portfolio/core';

// i18n — app binds core's factory to its own translations + locale store
import { createI18n } from '@portfolio/core';
import { translations, type Locale } from './translations';
import { useLayoutStore } from '@/store/layout';

const useLocaleState = () => ({
  locale: useLayoutStore(s => s.locale),
  setLocale: useLayoutStore(s => s.setLocale),
});

export const useI18n = createI18n<Locale>(translations, useLocaleState);
```

## Peer dependencies

Provided by the host app: `@expo/ui`, `@react-native-async-storage/async-storage`,
`i18n-js`, `react`, `react-native`, `zustand`.

> Theme resolution reads the native Material 3 palette through `@expo/ui`
> (Jetpack Compose) on Android and falls back to the Material 3 baseline elsewhere.
> See the root [README](../../README.md) for monorepo tooling and conventions.
