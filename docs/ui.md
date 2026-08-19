# Mobile UI

`@portfolio/mobile-ui` — the shared React Native UI for the monorepo's Expo
apps: design tokens, a typed icon set, the shared Welcome / Settings /
Manage-account screens, the iOS sheet + bar chrome, dialogs, and splash /
animation helpers. Built on [`@expo/ui`](https://docs.expo.dev/versions/latest/sdk/ui/jetpack-compose/)
— Jetpack Compose on Android, SwiftUI on iOS — via Metro's `.ios.tsx`
resolution; the base `.tsx` file is Android and the type source, and both sides
share one prop API.

**Both platforms are first-class now.** The package began Android-first, but iOS
is the active workstream and its surfaces are simulator-verified, not
doc-driven. Two naming conventions follow from that (see the root `AGENTS.md`):
a component with an Android twin takes the `.ios.tsx` suffix, while one that
exists ONLY on iOS carries `Ios` in its NAME (`SheetFormIos`,
`HeaderGlyphButtonIos`) — the type checker never applies the `.ios` suffix, so a
suffixed file with no twin needs a stub beside it.

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
  SkeletonBone,
  SheetFormBodyIos,
  sheetCommitBarOptionsIos,
  spacing,
} from '@portfolio/mobile-ui';
```

## Exports

| Export                                                                                             | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spacing`, `radius`, `opacity`, `duration`, `springs`, `podium`, `layout`, `staggerDelay`          | Design tokens — the single source for spacing, radii, opacities, and animation timings.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `Screen`                                                                                           | `flex: 1` screen container with an optional `backgroundColor`; forwards all `ViewProps`.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `AppIcon` / `AppIconProps`                                                                         | Typed icon: Android renders the bundled vector drawable through `@expo/ui` `Icon`; iOS maps the same `IconName` to an SF Symbol.                                                                                                                                                                                                                                                                                                                                                                                             |
| `iconSource` / `IconName` / `preloadIcons`                                                         | Resolve a typed icon name to its drawable; warm the drawable cache once at startup.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `AnimatedEntrance`                                                                                 | Reanimated fade + slide-in wrapper. Pass a stable `id` so items in recycling lists don't replay.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `WelcomeScreen` (+ `AuthAction`, `AuthActionProvider`, `WelcomeScreenProps`, `WelcomeFeatureItem`) | Drop-in welcome/auth screen — brand hero, feature rows, and Google / Apple / custom auth actions. Pass the app's glyph via `logo={({ size, color }) => <BrandMark size={size} color={color} />}`; it renders on `BrandTile` (the one deliberate non-Material-You spot) — `#222222` mark on `#F5F5F5` in light, inverted in dark. iOS draws the Home Screen's icon rendering (n=4.5 superellipse, measured vertical shine, contact shadow); Android stays flat with a hairline. Falls back to the app's initial when omitted. |
| `GoogleSignInButton`                                                                               | Branded Google button (the one deliberate non-dynamic-color exception).                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `SettingsScreen` (+ config/row/section types)                                                      | Drop-in M3 grouped-card settings screen — optional account block, N radio sections, optional trailing About block (`SettingsInfoRow`s take `url` or `onPress`).                                                                                                                                                                                                                                                                                                                                                              |
| `SettingsAccountSection` / `UsernameDialog` (+ types incl. `SettingsNavRow`)                       | Account block: profile row with inline username editing, optional nav rows (icon + chevron), sign-out with confirm. Standalone or inside `SettingsScreen`.                                                                                                                                                                                                                                                                                                                                                                   |
| `buildGeneralSettingsSections` / `buildAboutSettingsSection`                                       | The standard Language/Theme sections and the standard About block (app version row first — pass `nativeApplicationVersion` — then the `@expo/ui` version, plus any trailing rows the app supplies — Topper's Credits row is the one caller today).                                                                                                                                                                                                                                                                           |
| `DestructiveConfirmDialog`                                                                         | THE confirmation dialog for destructive actions (sign out, deletes, block); danger-colored confirm, `busy` gating. Mount in its own `Host`.                                                                                                                                                                                                                                                                                                                                                                                  |
| `ErrorScreen`                                                                                      | Pure-RN full-screen fallback for expo-router `ErrorBoundary`s (no `@expo/ui` hosts — the crash screen must not depend on what may have crashed).                                                                                                                                                                                                                                                                                                                                                                             |
| `AUTHOR_CREDIT` / `AUTHOR_URL`                                                                     | The "by @juanevillam" byline shown on every welcome screen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `GROUP_ROW_GAP`, `GROUP_SIDE_PADDING`, `groupRowShape`                                             | The M3 grouped-card row metrics/shapes shared by settings-style screens.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `setSplashHidden` / `useSplashHidden`                                                              | Tiny global store for "has the splash screen hidden" — set once, subscribe anywhere.                                                                                                                                                                                                                                                                                                                                                                                                                                         |

| `CreditsScreen` (+ `CreditsRole`, `CREDITS_GROUND`, `CREDITS_INK`) | THE credit roll, for an app that has TROPHIES to finish (Topper today; the roll is the platinum's reward, so an app with no completion to reach gets none) — a receding-perspective crawl on the brand's fixed `#222222`/`#F5F5F5`, never the theme's. An homage, not a replica: the grammar is borrowed, nothing identifying the film is. Reduce-motion hands the same content over as a plain scrollable list. Pass the app's glyph via `logo`, the same contract `WelcomeScreen` takes; the route owns the close glyph (`HeaderGlyphButtonIos`'s `ink`). No audio, ever — see the file. |
| `buildCreditsRoles` / `ASSISTANCE_CREDIT` / `offerCreditsIos` | Who is credited for what (one person, five roles, plus Claude — no model, deliberately), and the one-time native alert that offers the roll when an app is finished. |
| `AcknowledgementsListIos` / `LicenseDetailIos` / `licenseText` (+ `LicenseManifest`, `LicensePackage`) | Settings → Legal → Acknowledgements: a native inset-grouped `List` of every open-source package, and one package's licence in full. Data comes from each app's committed `src/generated/licenses.json` (`npm run licenses`). The list is SwiftUI; the licence body is RN text, because an unbounded `Text` in a `Host` hits the `matchContents` trap. |
| `iosOnlyRoute` | Guard for a route whose UI is SwiftUI-native, or whose feature Android does not have yet — redirects off-platform to the app's home. Each app keeps a one-line adapter supplying that route. |
| `ManageAccountScreen` | Drop-in account screen — identity rows, nav rows, and the delete-account entry. Same prop-driven contract as `SettingsScreen`; an app without a feature omits its prop. |
| `SkeletonBone` | THE loading placeholder for every app. Static `surfaceVariant` fill under a highlight that sweeps diagonally, driven by ONE app-wide clock and positioned from each bone's on-screen location — so bones light at different moments instead of throbbing in unison. Reduce-motion drops the band and leaves the static shape (which is Apple's own answer — see the file for why `.redacted` was rejected). Each app keeps only its content-shaped bones. |
| `SheetFormIos` / `SheetFormBodyIos` | The iOS form-sheet body. `SheetFormBodyIos` is for a TITLED route (UIKit bar carries the title, ✕/✓ ride the header slots — the only arrangement with genuine Liquid Glass); `SheetFormIos` draws its own authored header for sheets that are not titled routes. Two components rather than one flag, because a flag left five props dead at every titled call site. |
| `sheetCommitBarOptionsIos` | Apple's commit-modal pair as `Stack.Screen` options — title + ✕ `headerLeft` + ✓ `headerRight`. One statement of an editor sheet's bar for the whole portfolio; a route passes only its own words and its own validity. |
| `SheetFormFieldIos` / `SheetFormMediaIos` / `SheetFormDestructiveIos` / `SheetCommitGlyphIos` | The form's rows: an uncontrolled native `TextField` row, Contacts' centred media-over-caption row, the full-width destructive `Section` row, and the ✓ bar glyph with its busy spinner. |
| `ActionButtonIos` / `actionButtonModifiersIos` | THE portfolio button on iOS — a system `Button`, `prominent` (primary) or `bordered` (settled), sized `small`/`regular`/`large` by its container. The modifier stack is exported separately for the one caller that cannot nest a `Host` (`EmptyState.ios`'s CTA), so it still gets the identical control. |
| `HeaderGlyphButtonIos` / `HeaderGlyphGroupIos` (+ `HEADER_GLYPH_SIZE`, `HEADER_CLOSE_GLYPH_SIZE`) | SF Symbol bar-button items, label-coloured on the system's glass (iOS 26 marks tappability with the capsule, not with tint). Use the GROUP when a bar needs two adjacent items — a screen-level `headerRight` REPLACES the one a sheet's options supply, so rendering one glyph silently drops the other. |
| `SwiftUIHost` | `Host` wrapper with the safe-area handling bar items need (`ignoreSafeArea`) — a bar item framed by the safe area shifts when the keyboard opens. |
| `SquashPressable` / `PRESS_SCALE` / `PRESS_SPRING` / `usePressSquash` | The portfolio's ONE press spring for tiles and cards (0.97, damping 22 / mass 0.4 / stiffness 360). Never hand-roll a scale. |
| `PRESSED_OPACITY` / `BRAND_PRESSED_OPACITY` / `ICON_PRESS_OPACITY` / `ICON_PRESS_SCALE` | The fade treatment for INLINE rows and text actions — the other half of the press-language split (tiles squash, inline fades, native containers keep the system's own feedback). One constant because it was once declared in seven files at three values. |
| `createText` / `TEXT_VARIANTS` | The shared type scale. Bones read line heights off it rather than copying numbers, since the scale is platform-split. |
| `SnackbarProvider` / `useSnackbar` / `SnackbarContext` | App-level snackbar overlay (Android idiom; iOS uses it only for failures that have nowhere else to land). No SwiftUI equivalent — see the component matrix. |
| `StateLab` | The DEV state picker — pins any surface to any one of its states so they can be stepped side by side. `__DEV__`-gated; each app supplies its own state groups and fixtures. |
| `SheetBar` / `useSheetKeyboardInset` | Sheet chrome, and the keyboard inset for anything PINNED to a sheet's bottom — keyboard avoidance is a property of the container, not of the control (a `Form` handles its own). |
| `CollapsingHeaderBar` / `CollapsingHeaderTitle` / `useCollapsingHeader` | The hand-built collapsing header, still used on Android and by Sound Shaper. iOS prefers the system large title (`headerLargeTitle`), which does the same job natively. |
| `InitialArt` | The initial-letter placeholder every art-less surface falls back to. |
| `useNavigationTheme` | React Navigation theme wired to the app palette — the fix for the dark-mode nav flicker caused by RN Navigation's `DefaultTheme`. |

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

> The shared screens render through `@expo/ui` — Jetpack Compose on Android,
> SwiftUI on iOS. The iOS side is simulator-verified on iPhone 17 / iOS 26.5;
> every measured constant in this package names the device and OS it was
> band-scanned on. See the root [README](../../README.md) for monorepo tooling
> and conventions, and [`docs/expo-ui-customizations.md`](../../docs/expo-ui-customizations.md)
> for the SwiftUI gotchas these components work around.
