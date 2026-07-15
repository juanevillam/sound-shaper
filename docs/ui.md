# Mobile UI

`@portfolio/mobile-ui` — shared, Android-first React Native UI for the monorepo's
Expo apps: design tokens, a typed icon set, the shared Welcome and Settings
screens, dialogs, and splash / animation helpers. Built on
[`@expo/ui`](https://docs.expo.dev/versions/latest/sdk/ui/jetpack-compose/)
(Jetpack Compose), with SwiftUI counterparts via Metro's `.ios.tsx` resolution —
the base `.tsx` file is Android and the type source; same prop API on both.

Private and workspace-only. Consumed as **TypeScript source** — `main` / `types`
point at `src/index.ts`, so there is **no build step**; apps transpile it through
their own Metro / Babel.

## Quick start

Already wired as a workspace dependency (`"@portfolio/mobile-ui": "*"`). Import
from the package root:

```tsx
import {
  AppIcon,
  iconSource,
  Screen,
  WelcomeScreen,
  SettingsScreen,
  buildAboutSettingsSection,
  DestructiveConfirmDialog,
  spacing,
} from '@portfolio/mobile-ui';
```

## Exports

| Export                                                                                             | Purpose                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spacing`, `radius`, `opacity`, `duration`, `springs`, `podium`, `layout`, `staggerDelay`          | Design tokens — the single source for spacing, radii, opacities, and animation timings.                                                                                                                                                                                                                                                                     |
| `Screen`                                                                                           | `flex: 1` screen container with an optional `backgroundColor`; forwards all `ViewProps`.                                                                                                                                                                                                                                                                    |
| `AppIcon` / `AppIconProps`                                                                         | Typed icon: Android renders the bundled vector drawable through `@expo/ui` `Icon`; iOS maps the same `IconName` to an SF Symbol.                                                                                                                                                                                                                            |
| `iconSource` / `IconName` / `preloadIcons`                                                         | Resolve a typed icon name to its drawable; warm the drawable cache once at startup.                                                                                                                                                                                                                                                                         |
| `AnimatedEntrance`                                                                                 | Reanimated fade + slide-in wrapper. Pass a stable `id` so items in recycling lists don't replay.                                                                                                                                                                                                                                                            |
| `WelcomeScreen` (+ `AuthAction`, `AuthActionProvider`, `WelcomeScreenProps`, `WelcomeFeatureItem`) | Drop-in welcome/auth screen — brand hero, feature rows, and Google / Apple / custom auth actions. Pass the app's glyph via `logo={({ size, color }) => <BrandMark size={size} color={color} />}`; it renders on the **fixed brand tile** (`#0D0D0D` + `#F5F5F5`, the one deliberate non-Material-You spot), falling back to the app's initial when omitted. |
| `GoogleSignInButton`                                                                               | Branded Google button (the one deliberate non-dynamic-color exception).                                                                                                                                                                                                                                                                                     |
| `SettingsScreen` (+ config/row/section types)                                                      | Drop-in M3 grouped-card settings screen — optional account block, N radio sections, optional trailing About block (`SettingsInfoRow`s take `url` or `onPress`).                                                                                                                                                                                             |
| `SettingsAccountSection` / `UsernameDialog` (+ types incl. `SettingsNavRow`)                       | Account block: profile row with inline username editing, optional nav rows (icon + chevron), sign-out with confirm. Standalone or inside `SettingsScreen`.                                                                                                                                                                                                  |
| `buildGeneralSettingsSections` / `buildAboutSettingsSection`                                       | The standard Language/Theme sections and the standard About block (app version row first — pass `nativeApplicationVersion` — then the `@expo/ui` version, plus an optional easter-egg `onPress`).                                                                                                                                                           |
| `DestructiveConfirmDialog`                                                                         | THE confirmation dialog for destructive actions (sign out, deletes, block); danger-colored confirm, `busy` gating. Mount in its own `Host`.                                                                                                                                                                                                                 |
| `ErrorScreen`                                                                                      | Pure-RN full-screen fallback for expo-router `ErrorBoundary`s (no `@expo/ui` hosts — the crash screen must not depend on what may have crashed).                                                                                                                                                                                                            |
| `EmojiRainOverlay`                                                                                 | One-shot full-screen emoji downpour (the version-row easter egg). `emoji` prop per app; pointer-transparent; honors reduce-motion.                                                                                                                                                                                                                          |
| `AUTHOR_CREDIT` / `AUTHOR_URL`                                                                     | The "by @juanevillam" byline shown on every welcome screen.                                                                                                                                                                                                                                                                                                 |
| `GROUP_ROW_GAP`, `GROUP_SIDE_PADDING`, `groupRowShape`                                             | The M3 grouped-card row metrics/shapes shared by settings-style screens.                                                                                                                                                                                                                                                                                    |
| `setSplashHidden` / `useSplashHidden`                                                              | Tiny global store for "has the splash screen hidden" — set once, subscribe anywhere.                                                                                                                                                                                                                                                                        |

## Adding an icon

Icons come from Google's [`@expo/material-symbols`](https://www.npmjs.com/package/@expo/material-symbols)
(outlined set, imported per-name so Metro bundles only what's used); filled
variants are local drawables in `src/assets/icons/` generated with its CLI.

1. In `src/icons.ts`: `import Foo from '@expo/material-symbols/foo.xml';` and add
   `foo: Foo,` to the `icons` map (or `require('./assets/icons/foo-filled.xml')`
   for a filled variant).
2. In `src/AppIcon.ios.tsx`: add the matching SF Symbol to the `SF_SYMBOLS` map —
   **every `IconName` needs both entries** (the map is exhaustively typed, so
   `tsc` reminds you).
3. `IconName` updates automatically — use `iconSource('foo')` or
   `<AppIcon name="foo" />`.

## Peer dependencies

Provided by the host app: `@expo/ui`, `expo-asset`, `expo-image`, `react`,
`react-native`, `react-native-reanimated`, `react-native-safe-area-context`,
`react-native-svg`. (Direct dependency: `@expo/material-symbols`.)

> Android-first: the shared screens render through `@expo/ui` Jetpack Compose;
> `.ios.tsx` variants cover SwiftUI (doc-driven, device-unverified). See the root
> [README](../../README.md) for monorepo tooling and conventions.
