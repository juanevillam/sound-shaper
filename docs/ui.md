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
| `GoogleSignInButton` / `GoogleLogo`                                                                | Branded Google button (the one deliberate non-dynamic-color exception). `GoogleLogo` holds the three published mark variants, transcribed from Google's branding guidelines — the values are mandated, so they must NOT follow the app theme.                                                                                                                                                                                                                                                                                |
| `SettingsScreen` (+ config/row/section types)                                                      | Drop-in M3 grouped-card settings screen — optional account block, N radio sections, optional trailing About block (`SettingsInfoRow`s take `url` or `onPress`).                                                                                                                                                                                                                                                                                                                                                              |
| `SettingsAccountSection` / `UsernameDialog` (+ types incl. `SettingsNavRow`)                       | Account block: profile row with inline username editing, optional nav rows (icon + chevron), sign-out with confirm. Standalone or inside `SettingsScreen`.                                                                                                                                                                                                                                                                                                                                                                   |
| `buildGeneralSettingsSections` / `buildAboutSettingsSection`                                       | The standard Language/Theme sections and the standard About block (app version row first — pass `nativeApplicationVersion` — then the `@expo/ui` version, plus any trailing rows the app supplies — no app passes one today).                                                                                                                                                                                                                                                                                                |
| `DestructiveConfirmDialog`                                                                         | THE confirmation dialog for destructive actions (sign out, deletes, block); danger-colored confirm, `busy` gating. Mount in its own `Host`.                                                                                                                                                                                                                                                                                                                                                                                  |
| `ErrorScreen`                                                                                      | Pure-RN full-screen fallback for expo-router `ErrorBoundary`s (no `@expo/ui` hosts — the crash screen must not depend on what may have crashed).                                                                                                                                                                                                                                                                                                                                                                             |
| `AUTHOR_CREDIT` / `AUTHOR_URL`                                                                     | The "by @juanevillam" byline shown on every welcome screen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `GROUP_ROW_GAP`, `GROUP_SIDE_PADDING`, `groupRowShape`                                             | The M3 grouped-card row metrics/shapes shared by settings-style screens.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `setSplashHidden` / `useSplashHidden`                                                              | Tiny global store for "has the splash screen hidden" — set once, subscribe anywhere.                                                                                                                                                                                                                                                                                                                                                                                                                                         |

| `ManageAccountScreen` | Drop-in account screen — identity rows, nav rows, and the delete-account entry. Same prop-driven contract as `SettingsScreen`; an app without a feature omits its prop. |
| `SkeletonBone` | THE loading placeholder for every app. Static `surfaceVariant` fill under a highlight that sweeps diagonally, driven by ONE app-wide clock and positioned from each bone's on-screen location — so bones light at different moments instead of throbbing in unison. Reduce-motion drops the band and leaves the static shape, which is Apple's own answer. `.redacted` is reachable on @expo/ui 57 and is deliberately NOT used, even inside a native `List` — see `FormDisclosureRowIos` for the argument. Each app keeps only its content-shaped bones. |
| `SheetFormIos` / `SheetFormBodyIos` | The iOS form-sheet body. `SheetFormBodyIos` is for a TITLED route (UIKit bar carries the title, ✕/✓ ride the header slots — the only arrangement with genuine Liquid Glass); `SheetFormIos` draws its own authored header for sheets that are not titled routes. Two components rather than one flag, because a flag left five props dead at every titled call site. |
| `sheetCommitBarOptionsIos` | Apple's commit-modal pair as `Stack.Screen` options — title + ✕ `headerLeft` + ✓ `headerRight`. One statement of an editor sheet's bar for the whole portfolio; a route passes only its own words and its own validity. |
| `SheetFormFieldIos` / `SheetFormMediaIos` / `SheetFormDestructiveIos` / `SheetCommitGlyphIos` | The form's rows: an uncontrolled native `TextField` row, Contacts' centred media-over-caption row, the full-width destructive `Section` row, and the ✓ bar glyph with its busy spinner. |
| `ActionButtonIos` / `actionButtonModifiersIos` | THE portfolio button on iOS — a system `Button`, `prominent` (filled) or `bordered` (settled), sized `small`/`regular`/`large` by its container. MONOCHROME BY VARIANT since 2026-08-22: the FILLED one inks its capsule (`onSurface`) and needs `labelColor` (`colors.background`), because SwiftUI draws a filled label WHITE whatever the tint — white-on-white in dark otherwise. The BORDERED one keeps the accent: it derives its wash AND its label from the tint, so ink renders it as grey-on-grey, which is iOS's disabled vocabulary. The modifier stack is exported separately for the one caller that cannot nest a `Host` (`EmptyState.ios`'s CTA), so it still gets the identical control. |
| `HeaderGlyphButtonIos` / `HeaderGlyphGroupIos` (+ `HEADER_GLYPH_SIZE`, `HEADER_CLOSE_GLYPH_SIZE`) | SF Symbol bar-button items, label-coloured on the system's glass (iOS 26 marks tappability with the capsule, not with tint). Use the GROUP when a bar needs two adjacent items — a screen-level `headerRight` REPLACES the one a sheet's options supply, so rendering one glyph silently drops the other. |
| `SwiftUIHost` | `Host` wrapper with the safe-area handling bar items need (`ignoreSafeArea`) — a bar item framed by the safe area shifts when the keyboard opens. |
| `SquashPressable` / `PRESS_SCALE` / `PRESS_SPRING` / `usePressSquash` | The portfolio's ONE press spring for tiles and cards (0.96, damping 22 / mass 0.4 / stiffness 360). Never hand-roll a scale. |
| `PRESSED_OPACITY` / `BRAND_PRESSED_OPACITY` / `ICON_PRESS_OPACITY` / `ICON_PRESS_SCALE` | The fade treatment for INLINE rows and text actions — the other half of the press-language split (tiles squash, inline fades, native containers keep the system's own feedback). One constant because it was once declared in seven files at three values. |
| `createText` / `TEXT_VARIANTS` | The shared type scale. Bones read line heights off it rather than copying numbers, since the scale is platform-split. |
| `SnackbarProvider` / `useSnackbar` / `SnackbarContext` / `SnackbarOutlet` | App-level snackbar overlay (Android idiom; iOS uses it only for failures that have nowhere else to land). No SwiftUI equivalent — see the component matrix. `SnackbarOutlet` is the escape hatch for a `formSheet`: UIKit presents the sheet ABOVE the root view the provider wraps, so a toast fired from inside a sheet renders behind it unless the sheet mounts its own outlet. The toast BINDS to the outlet it was fired on and never re-parents (re-parenting on sheet close was a visible flicker-and-jump); a `host`-scoped toast dies with its surface — committing its undo transaction — and `scope: 'app'` (for a save that dismisses its own editor) re-homes to the new top with a fresh entrance. |
| `StateLab` | The DEV state picker — pins any surface to any one of its states so they can be stepped side by side. `__DEV__`-gated; each app supplies its own state groups. It pins the BRANCH a screen renders, not the data underneath, so it needs no fixtures — and there are none: the `MOCK_DATA` flag and all five fixture files were deleted 2026-08-19. |
| `SheetBar` / `useSheetKeyboardInset` | Sheet chrome, and the keyboard inset for anything PINNED to a sheet's bottom — keyboard avoidance is a property of the container, not of the control (a `Form` handles its own). |
| `CollapsingHeaderBar` / `CollapsingHeaderTitle` / `useCollapsingHeader` | The hand-built collapsing header, still used on Android and by Sound Shaper. iOS prefers the system large title (`headerLargeTitle`), which does the same job natively. |
| `InitialArt` | The initial-letter placeholder every art-less surface falls back to. |
| `useNavigationTheme` | React Navigation theme wired to the app palette — the fix for the dark-mode nav flicker caused by RN Navigation's `DefaultTheme`. |
| `ProgressViewIos` | THE indeterminate spinner — the other half of waiting, for work the person STARTED or content whose shape cannot be predicted. States its own 20×20 box (never `matchContents`) and centres itself in whatever frame it is given. |
| `ProgressOverlayIos` | The scrim over work that must not be interrupted — eats every touch, spinner on top. For an irreversible task that tears its own screen down; pair it with taking the route's dismiss affordances away, since a `disabled` container does not block a sheet's ✕ or grabber. |
| `GlassSurfaceIos` / `GLASS_FLOOR` / `FLOATING_RADIUS` / `FLOATING_EDGE_GAP` / `FLOATING_COPY_GAP` | THE material under every floating surface — snackbar, trophy banner, now-playing banner. `regular` glass over a 0.25 `surfaceContainer` floor, no border and no shadow (the material IS the edge), 12pt off the safe area. MEMOIZED as part of the contract: iOS 26's adaptive glass re-picks its light/dark treatment when the modifier is re-sent, so a parent re-render must never reach it. |
| `SNACKBAR_BOTTOM_CLEARANCE` | Where the toast stands, in EVERY app — the portfolio's tallest bottom chrome clearing itself, so one surface is not in a different spot per app. |
| `MINI_PLAYER_HEIGHT` / `NOW_PLAYING_BANNER_BOX` / `NOW_PLAYING_BOTTOM_GAP_IOS` | The now-playing banner's box, which the toast stands on. Its own 8pt bottom gap is deliberate — a 34pt home indicator is not a 62pt notch, and Apple does not mirror them either. |
| `FormDisclosureRowIos` / `FormValueRowIos` | The two grouped-form rows: a destination (label + chevron) and a fact (label + value), as ONE geometry so they agree in the same card. The value's loading state is a bridged `SkeletonBone`, not `redacted`. |
| `SheetFormBodyIos` metrics — `SHEET_CONTENT_TOP` / `SHEET_EMPTY_HEADER_SLOT` / `SHEET_TITLE_TO_CONTENT` | Where ANY sheet's first content starts, below its OWN top edge. 84 is Apple's number, band-scanned off Settings; a headerless first card must claim the empty header slot or it lands 21pt low. |
| `GROUPED_ROW` / `GROUPED_ROW_PITCH` / `LIST_ROW_PADDING_VERTICAL` | A native grouped row's measured geometry, shared by the real rows and by anything that has to stand where they stand. |
| `LIST_ROW_ONE_LINE` / `LIST_ROW_TWO_LINES` | How any native list row shortens text — one modifier pair, so two rows on a screen never truncate differently. |
| `InitialArt` extras — `emptyMediaColor` / `EMPTY_MEDIA_INITIAL_RATIO` / `emptyMediaPlusStyle` / `EMPTY_MEDIA_PLUS` | The material behind ANY art-less box, stepped by container: inside a sheet every grouped colour goes up one, so callers pass `container="sheet"` rather than a colour. |
| `artworkRadius` | A picture's corner — a RATIO of the picture (0.15), not a constant, and not the grouped-card radius. |
| `MediaPickerAvatar` / `MEDIA_PICKER_SIZE` | An editor sheet's media slot — Contacts' centred media-over-caption box. The box is shared; the picture is the caller's. |
| `StateWrap` | The container for a screen's non-list states — empties, errors and skeletons — under a native large title or search bar. Hands its child a full screen frame, which is why `EmptyState` and `ProgressViewIos` both centre themselves. |
| `SHEET_HERO_*` | The hero badge at the top of a sheet — symbol, badge and glyph sizes as one set. |
| `confirmDestructiveIos` | The iOS destructive confirmation — `Alert.alert` in the platform's own grammar, the twin of Android's `DestructiveConfirmDialog`. |
| `AppleSignInButton` | Sign in with Apple, per Apple's spec (U+F8FF from the system font, black-on-light / white-on-dark). iOS only, by policy rather than by capability. |
| `LegalFooter` | The auth disclaimer under the welcome screen's buttons — muted footnote with the two legal pages as inline links. Pure RN, because nested-text links are native to RN `Text` and painful in both bridges. |
| `UsernameEditRow` | The iOS inline username editor. The base `.tsx` is a pass-through stub so `tsc` resolves the import — Android edits the username in its own Compose dialog. |

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
