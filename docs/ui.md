# Mobile UI

`@portfolio/mobile-ui` — shared, Android-first React Native UI for the monorepo's
Expo apps: design tokens, a typed icon set, screen scaffolding, login UI, and
splash / animation helpers. Built on [`@expo/ui`](https://docs.expo.dev/versions/latest/sdk/ui/jetpack-compose/)
(Jetpack Compose).

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
  AnimatedEntrance,
  LoginScreen,
  spacing,
  useSplashHidden,
} from '@portfolio/mobile-ui';
```

## Exports

| Export                                                                                                        | Purpose                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `spacing`, `radius`, `opacity`, `duration`, `springs`, `podium`, `layout`, `staggerDelay`                     | Design tokens — the single source for spacing, radii, opacities, and animation timings. Reference these instead of raw numbers. |
| `Screen`                                                                                                      | `flex: 1` screen container with an optional `backgroundColor`; forwards all `ViewProps`.                                        |
| `AppIcon` / `AppIconProps`                                                                                    | Android `@expo/ui` `Icon` selected by a typed `name` (no `require()`); every other `Icon` prop passes through.                  |
| `iconSource` / `IconName`                                                                                     | Resolve a typed icon name to its bundled Android vector drawable.                                                               |
| `AnimatedEntrance`                                                                                            | Reanimated fade + slide-in wrapper. Pass a stable `id` so items in recycling lists don't replay (or get stuck invisible).       |
| `LoginScreen` / `LoginFeature` (+ `AuthAction`, `AuthActionProvider`, `LoginScreenProps`, `LoginFeatureItem`) | Drop-in login screen — logo/hero, feature rows, and Google / Apple / custom auth actions.                                       |
| `setSplashHidden` / `useSplashHidden`                                                                         | Tiny global store for "has the splash screen hidden" — set once, subscribe anywhere.                                            |

## Adding an icon

Icons are bundled Android vector drawables in `src/assets/icons/`, mapped to
typed names in `src/icons.ts`:

1. Drop `my-icon.xml` into `src/assets/icons/`.
2. Add one line to the `icons` map in `src/icons.ts`:
   ```ts
   myIcon: require('./assets/icons/my-icon.xml'),
   ```
3. `IconName` updates automatically — use it via `iconSource('myIcon')` or
   `<AppIcon name="myIcon" />`.

## Peer dependencies

Provided by the host app: `@expo/ui`, `react`, `react-native`,
`react-native-reanimated`, `react-native-safe-area-context`.

> Android-first: `AppIcon`, `LoginScreen`, and friends render through `@expo/ui`
> Jetpack Compose. See the root [README](../../README.md) for monorepo tooling
> and conventions.
