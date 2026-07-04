# Component support matrix — Android vs iOS

Which `@expo/ui` components the portfolio showcase can use on **Android (Jetpack
Compose)** vs **iOS (SwiftUI)**. This is the decision aid for building real
portfolio apps: before reaching for a component, check whether it exists on both
platforms or needs a custom iOS build.

**Source of truth:** the installed `@expo/ui` type exports —
`node_modules/@expo/ui/build/jetpack-compose/` and `.../swift-ui/` — _not_ the
published docs (per [`apps/expo-starter/AGENTS.md`](../apps/expo-starter/AGENTS.md),
docs can lead the package). The Android column lists what the expo-starter
showcase actually demos today; the iOS SwiftUI showcase code exists but is
device-unverified, so the iOS column is still the **target** mapping.

> **Version note:** the matrix below was generated from **56.0.18** exports.
> The repo is now on `@expo/ui` **57.0.2** (SDK 57, July 2026) — the 57 bump
> added `LoadingIndicator` (showcased) and changed no other showcase-relevant
> export surface, so the rows still hold; regenerate against the installed
> types on the next major bump.

## Legend

| Status        | Meaning                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| ✅ direct     | A SwiftUI export with the same/clear name exists — straight port.          |
| 🟢 equivalent | A different-named SwiftUI export fills the same role.                      |
| 🟡 partial    | Only a weaker/related SwiftUI primitive exists.                            |
| 🔴 none       | No SwiftUI export — needs a custom build (compose primitives + modifiers). |

## Summary

| Status                               | Count       | Share    |
| ------------------------------------ | ----------- | -------- |
| ✅ direct                            | 14          | 29%      |
| 🟢 equivalent                        | 15          | 31%      |
| 🟡 partial                           | 1           | 2%       |
| 🔴 none                              | 19          | 39%      |
| **Portable (direct + equivalent)**   | **29 / 49** | **~59%** |
| **Custom iOS work (partial + none)** | **20 / 49** | **~41%** |

About **59%** of the Android showcase maps onto a SwiftUI export with little to no
rework. The other **~41%** is Material-specific (chips, badges, cards, FAB,
snackbar, tooltips, search bars, pull-to-refresh, radio/checkbox, etc.) and needs
a custom SwiftUI implementation.

## Matrix

| Component                   | Android (`jetpack-compose`) | iOS (`swift-ui`)     | iOS | Porting note                                                                 |
| --------------------------- | --------------------------- | -------------------- | :-: | ---------------------------------------------------------------------------- |
| Alert dialog                | `AlertDialog`               | `Alert`              | 🟢  | Both modal title/message/actions; `isPresented` vs callback pattern differs. |
| Badge                       | `Badge`                     | —                    | 🔴  | Material pill badge; build with `Label` or a custom overlay shape.           |
| Badged box                  | `BadgedBox`                 | —                    | 🔴  | Overlay-badge primitive; build with `ZStack` + badge overlay.                |
| Basic alert dialog          | `BasicAlertDialog`          | `ConfirmationDialog` | 🟢  | `ConfirmationDialog` covers basic modal confirmation.                        |
| Basic text field            | `BasicTextField`            | `TextField`          | ✅  | Bare, unstyled text input; iOS `TextField` is the closest primitive.         |
| Box                         | `Box`                       | `Group`              | 🟢  | Lightweight layout/grouping container on both.                               |
| Button                      | `Button`                    | `Button`             | ✅  | Same role/API: label + action + appearance modifiers.                        |
| Card                        | `Card`                      | —                    | 🔴  | No iOS `Card`; `Group` + `shadow`/`cornerRadius`/`background` modifiers.     |
| Carousel                    | `Carousel`                  | —                    | 🔴  | No iOS carousel; `TabView` page style or custom horizontal scroll.           |
| Checkbox                    | `Checkbox`                  | —                    | 🔴  | No iOS checkbox; `Toggle` or a custom control.                               |
| Chip                        | `Chip`                      | —                    | 🔴  | No iOS chip; styled `Button` or `Label`.                                     |
| Column                      | `Column`                    | `VStack`             | ✅  | Vertical stack on both.                                                      |
| Date/time picker            | `DatePicker`                | `DatePicker`         | ✅  | Both export `DatePicker`.                                                    |
| Divider                     | `Divider`                   | `Divider`            | ✅  | Same purpose/API.                                                            |
| Docked search bar           | `DockedSearchBar`           | —                    | 🔴  | No iOS search bar; `TextField` + custom layout.                              |
| Dropdown menu               | `DropdownMenu`              | `Menu`               | 🟢  | `Menu` presents a selection menu on tap.                                     |
| Exposed dropdown menu box   | `ExposedDropdownMenuBox`    | `Picker`             | 🟢  | `Picker` handles the field + selection.                                      |
| Floating action button      | `FloatingActionButton`      | —                    | 🔴  | No iOS FAB; positioned `Button` via overlay.                                 |
| Flow row                    | `FlowRow`                   | —                    | 🔴  | No iOS wrapping row; `Grid` or custom arrangement.                           |
| Horizontal floating toolbar | `HorizontalFloatingToolbar` | —                    | 🔴  | Material 3 toolbar; custom floating `HStack` + overlay.                      |
| Horizontal pager            | `HorizontalPager`           | `TabView`            | 🟢  | `TabView` page style for horizontal paging.                                  |
| Host                        | `Host`                      | `Host`               | ✅  | Embed point for expo-ui views; both platforms.                               |
| Icon                        | `Icon`                      | `Image`              | 🟢  | Android Material icons; iOS `Image` (SF Symbols / assets).                   |
| Icon button                 | `IconButton`                | —                    | 🔴  | No iOS icon-button; `Button` with image content.                             |
| Lazy column                 | `LazyColumn`                | `List`               | 🟢  | `List` gives virtualized vertical rendering.                                 |
| Lazy row                    | `LazyRow`                   | `LazyHStack`         | ✅  | Lazy horizontal stack on both.                                               |
| List item                   | `ListItem`                  | —                    | 🔴  | No iOS `ListItem`; `HStack` + `Label`/`Text`.                                |
| Material colors             | `getMaterialColors`         | —                    | 🔴  | Android Material palette only; iOS uses its own color system.                |
| Modal bottom sheet          | `ModalBottomSheet`          | `BottomSheet`        | 🟢  | Both present from the bottom; names differ.                                  |
| Modifiers                   | `…/modifiers`               | `…/modifiers`        | 🟢  | Both expose a modifier system; different APIs, same role.                    |
| Navigation bar              | `NavigationBar`             | `TabView`            | 🟢  | M3 bottom nav bar; iOS `TabView` fills the tab-bar role.                     |
| Progress                    | `Progress`                  | `ProgressView`       | 🟢  | Both show progress; APIs differ.                                             |
| Pull-to-refresh box         | `PullToRefreshBox`          | —                    | 🔴  | No iOS export; scroll view + custom refresh.                                 |
| Radio button                | `RadioButton`               | —                    | 🔴  | No iOS radio; `Picker` or custom toggle group.                               |
| RN host view                | `RNHostView`                | `RNHostView`         | ✅  | Embed RN inside expo-ui; both platforms.                                     |
| Row                         | `Row`                       | `HStack`             | ✅  | Horizontal stack on both.                                                    |
| Search bar                  | `SearchBar`                 | —                    | 🔴  | No iOS search bar; `TextField` + styling.                                    |
| Segmented button            | `SegmentedButton`           | `Picker`             | 🟢  | `Picker` with segmented style.                                               |
| Shape                       | `Shape`                     | `Shapes`             | 🟡  | iOS `Shapes` is limited (`ConcentricRectangle`); use shape modifiers.        |
| Slider                      | `Slider`                    | `Slider`             | ✅  | Same role/API.                                                               |
| Snackbar                    | `Snackbar`                  | —                    | 🔴  | No iOS snackbar; custom overlay + animation.                                 |
| Spacer                      | `Spacer`                    | `Spacer`             | ✅  | Flexible spacing on both.                                                    |
| Surface                     | `Surface`                   | `Group`              | 🟢  | `Surface` adds Material elevation; `Group` is lighter.                       |
| Switch                      | `Switch`                    | `Toggle`             | 🟢  | On/off state; different native look.                                         |
| Text                        | `Text`                      | `Text`               | ✅  | Same role/API.                                                               |
| Text field                  | `TextField`                 | `TextField`          | ✅  | Text input on both.                                                          |
| Toggle button               | `ToggleButton`              | —                    | 🔴  | No iOS toggle-button; `Button` with custom state.                            |
| Tooltip                     | `Tooltip`                   | —                    | 🔴  | No iOS tooltip; custom overlay or `Popover`.                                 |
| Use native state            | `useNativeState`            | `useNativeState`     | ✅  | Cross-platform hook to sync state with the native view.                      |

## SwiftUI-only exports (no Android showcase yet)

`@expo/ui` ships SwiftUI components with **no Jetpack Compose counterpart** —
candidates for an iOS-only showcase section: `Chart`, `Gauge`, `ColorPicker`,
`Stepper`, `Form`, `Section`, `DisclosureGroup`, `Label`, `LabeledContent`,
`Link`, `ShareLink`, `Menu`, `ContextMenu`, `ControlGroup`, `Popover`,
`SwipeActions`, `ContentUnavailableView`, `Grid`, `SecureField`,
`GlassEffectContainer`, `AccessoryWidgetBackground`.

## How to keep this current

Refresh after an `@expo/ui` bump by re-listing both export dirs and re-diffing
against this table (added/removed components since last sync):

```bash
ls node_modules/@expo/ui/build/jetpack-compose
ls node_modules/@expo/ui/build/swift-ui
```

Then update the rows and the summary counts. Pair this with the upgrade checklist
in [`expo-ui-customizations.md`](expo-ui-customizations.md).
