# Component support matrix — Android vs iOS

Which `@expo/ui` components the portfolio showcase can use on **Android (Jetpack
Compose)** vs **iOS (SwiftUI)**. This is the decision aid for building real
portfolio apps: before reaching for a component, check whether it exists on both
platforms or needs a custom iOS build.

**Source of truth:** the installed `@expo/ui` **57.0.3** type exports —
`node_modules/@expo/ui/build/jetpack-compose/` and `.../swift-ui/` — _not_ the
published docs (per [`apps/expo-ui-starter/AGENTS.md`](../apps/expo-ui-starter/AGENTS.md),
docs can lead the package). The Android column lists what the expo-ui-starter
showcase actually demos today; the iOS SwiftUI showcase code exists but is
device-unverified, so the iOS column is still the **target** mapping. The 57
bump added `LoadingIndicator` (showcased) and changed no other
showcase-relevant export surface.

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
| Loading indicator           | `LoadingIndicator`          | `ProgressView`       | 🟢  | New in 57 — M3 morphing-shape loader; iOS spinner via `ProgressView`.        |
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

## Native-first inventory (iOS) — 2026-07-29

Standing rule in `AGENTS.md` → "Native primitive first". This is the running
ledger of iOS surfaces that were authored in RN, what happened to each, and —
where they stayed RN — the reason, so nobody re-litigates it from scratch.

### Converted to the system control

| surface                                              | was                                                             | now                                                                                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `SheetFormIos` chrome (all editor sheets, both apps) | RN header `Pressable`, styled `TextInput`s, `ActivityIndicator` | SwiftUI `Form` + `Section` + `TextField` + `Button` + `ProgressView`                                                                       |
| Topper edit-item / edit-top, Sound Shaper edit-sound | RN `ScrollView` of hand-drawn rows                              | grouped native `Form`                                                                                                                      |
| Delete item / top / sound                            | RN outlined pill (Material's `OutlinedButton` in disguise)      | `Button(role: .destructive)` as a `Section` row — full width by construction                                                               |
| Topper item-detail "Edit item"                       | RN bordered pill                                                | `ActionButtonIos` (`.bordered`)                                                                                                            |
| `EmptyState.ios` CTA (both apps)                     | filled RN pill                                                  | `ActionButtonIos` (`.borderedProminent`)                                                                                                   |
| `InlineFollowButton.ios`                             | RN capsule, two hand-picked fills                               | `ActionButtonIos`, prominent = Follow / bordered = Following                                                                               |
| Topper blocked-users "Unblock"                       | RN tonal pill                                                   | `ActionButtonIos`                                                                                                                          |
| Sound Shaper clips sheet                             | RN rows + trailing trash `IconButton`                           | `Form` rows + native `SwipeActions` delete                                                                                                 |
| `RecentSearches.ios`                                 | RN rows + trailing ✕ `Pressable`, RN header                     | `insetGrouped` `List` + `Section` header slot + `SwipeActions` remove                                                                      |
| Explore "See All" people (`(app)/people.tsx`)        | did not exist — the shelf's action was unwired                  | form sheet over an `insetGrouped` `List` of `PersonListRowIos`, the same native row the search results use                                 |
| Topper comments composer                             | styled `TextInput` + `Pressable` "Post"                         | one `Host`: SwiftUI `TextField` (`roundedBorder`) + `Button`                                                                               |
| Sound Shaper `shaper.tsx`                            | RN sheet, `Pressable` chips, hand-typeset headers, RN `Switch`  | grouped `Form`: `Picker` (menu) for presets, checkmark `Section` rows for saved shapes, `Slider` rows, `Toggle`, destructive `Section` row |

### Staying RN, with the reason

**`@expo/ui`'s SwiftUI `Image` renders SF Symbols and asset-catalog names
only — there is no remote-URL image.** A list row showing an avatar or cover art
therefore needs one `RNHostView` bridged per row.

**THAT IS NO LONGER A BLOCKER FOR PERSON ROWS — it is shipped.**
`PersonListRowIos` is a native `List` row whose only hosted part is the avatar,
and it runs in Explore's search results and in the See All sheet, the latter at
`PEOPLE_PAGE_SIZE` (50) rows with no measured cost. The sizing blowup in
`expo-ui-customizations.md` is about an `RNHostView` with no intrinsic size; give
the hosted child a concrete one (the avatar is handed a `size`) and it behaves.

So the remaining avatar rows are REFACTOR CANDIDATES, not blocked work — and the
refactor is "adopt `PersonListRowIos`", not "write another row":

- `follow-list` rows (RN `Pressable`s today — the last hand-built people list)
- `CommentRow.ios`, `ProfileHeader.ios`

The genuine remaining limit is a row whose artwork CANNOT be given a concrete
size up front, and a `Host` per cell across a large grid (see `emoji-picker`
below, and the browse grid's rejection note in Explore's route).

Other standing exceptions:

- **`emoji-picker` cells** — a `Host` per emoji in a large grid is a perf
  non-starter; the whole picker would have to become a SwiftUI `LazyVGrid`.
- **`PlayerCards.ios`** — custom composed cards (icon + title + subtitle), not
  an imitation of any system control, so there is nothing to inherit.
- **`GoogleSignInButton.ios`** — Google's brand guidelines dictate the button.
- **`SnackbarProvider`** — no SwiftUI equivalent; it's an app-level overlay.
- **RN `Switch`** — already renders a real `UISwitch` on iOS.

### Still to do

- **`CommentRow.ios` → a native `List` row with `swipeActions`.** No longer
  blocked by the avatar — `PersonListRowIos` proves a hosted avatar inside a
  native `List` row (see above). What is left is ordinary work: move the row
  into a `List`, take `swipeActions`, and drop the long-press + `•••`
  `ActionSheetIOS` menu for the native gesture. (The composer beside it IS
  converted.)
- **`follow-list` → `PersonListRowIos`.** It is the same surface as the See All
  sheet — a list of people in a form sheet — still drawing RN `Pressable` rows
  with a hand-typeset heading instead of the sheet's own bar. Standardising it
  is the single highest-value item left in this section.
- `ProfileHeader.ios` for the same reason, whenever the profile screen is
  refactored.

### Gotchas found doing this

- A native `Form` is a scroll container with **no intrinsic height**: under a
  `fitToContents` detent the sheet hugs its header and the form renders 0pt
  tall. Editors use a fractional detent (`[0.9]`, clips `[0.6]`, shaper `[0.9]`).
- `frame({ maxWidth: Infinity })` — shown in the `@expo/ui` docs — **does not
  stretch a `.bordered` button**; the value doesn't survive to the Swift
  `FrameModifier`. Get full width from the container (a `Section` row), not a
  frame. A fixed `frame({ width })` DOES work (the EQ band labels use it).
- **A `Host` whose `matchContents` hugs only the vertical axis renders BLANK
  when the parent gives it no width.** It fills whatever width it is handed, so
  in a centred column or a row's trailing slot (both auto-width) the control
  measures ~0 wide and you get a tall empty bar with no label — not a narrow
  button. `ActionButtonIos` therefore hugs BOTH axes; only
  `SheetDestructiveButtonIos`, which a `Section` row hands a width, may hug one.
  This shipped broken in the `EmptyState.ios` CTA and was invisible to
  typechecking — it is the reason every one of these needs a screenshot.
- **A swipe action translates the row's own content left by the action's full
  width.** A worded action ("🗑 Delete clip", ~110pt) pushes a short row label
  clean off the leading edge, leaving what looks like an empty row. Swipe
  actions are therefore GLYPH-ONLY here (Mail does the same), with the wording
  moved to `accessibilityLabel`.
- SwiftUI `Form` handles keyboard avoidance itself; no `KeyboardAvoidingView`.
  Anything PINNED to a sheet's bottom instead uses
  `useSheetKeyboardInset()` from `@portfolio/mobile-ui` — keyboard avoidance is
  a property of the container, not of the control.
- A native multiline `TextField` has no return-key dismiss (Return inserts a
  newline), so a thread above a composer needs
  `keyboardDismissMode="interactive"` or the keyboard cannot be put away.
- A SwiftUI `TextField` is **uncontrolled** on the Swift side. React listens via
  `onTextChange`; JS-driven changes (seed an edit, clear after posting) go
  through the `TextFieldRef` (`setText` / `clear` / `focus`).
- `RNHostView` takes no `style` and `matchContents` is boolean-only, so the RN
  child must carry its own size and centre itself.

### Simulator gotcha while verifying these

`simctl`-injected typing re-enables the **hardware** keyboard, after which
tapping a field focuses it, draws no software keyboard, and still reports a
keyboard frame — so a keyboard-driven inset looks permanently stuck. It is not
an app bug. Restart Simulator.app (with
`defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false`)
and drive the field by taps only.
