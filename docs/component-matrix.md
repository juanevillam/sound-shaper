# Component support matrix — Android vs iOS

Which `@expo/ui` components the portfolio showcase can use on **Android (Jetpack
Compose)** vs **iOS (SwiftUI)**. This is the decision aid for building real
portfolio apps: before reaching for a component, check whether it exists on both
platforms or needs a custom iOS build.

**Source of truth:** the installed `@expo/ui` **57.0.7** type exports — read the
`index.d.ts` re-exports, NOT the build directory's file names: `BasicTextField`
and `OutlinedTextField` ship out of `TextField`, and the two segmented rows out
of `SegmentedButton`, so a listing of files under-reports and over-reports at
once. `node_modules/@expo/ui/build/jetpack-compose/index.d.ts` and
`.../swift-ui/index.d.ts` — _not_ the published docs (per
[`apps/expo-ui-starter/AGENTS.md`](../apps/expo-ui-starter/AGENTS.md), docs can
lead the package).

The Android column lists what the expo-ui-starter showcase actually demos today.
The iOS column was authored as a **target** mapping from types and docs, and its
showcase has since been **simulator-verified** (2026-07-31, iPhone 17 / iOS 26.5,
all 47 components; the library-level Toggle tap bug is the one exception).
Physical-device verification is still pending.

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
| ✅ direct                            | 15          | 27%      |
| 🟢 equivalent                        | 19          | 35%      |
| 🟡 partial                           | 1           | 2%       |
| 🔴 none                              | 20          | 36%      |
| **Portable (direct + equivalent)**   | **34 / 55** | **~62%** |
| **Custom iOS work (partial + none)** | **21 / 55** | **~38%** |

About **62%** of the Android showcase maps onto a SwiftUI export with little to no
rework. The other **~38%** is Material-specific (chips, badges, cards, FAB,
snackbar, tooltips, search bars, pull-to-refresh, radio/checkbox, etc.) and needs
a custom SwiftUI implementation.

## Matrix

| Component                   | Android (`jetpack-compose`)      | iOS (`swift-ui`)     | iOS | Porting note                                                                                                                    |
| --------------------------- | -------------------------------- | -------------------- | :-: | ------------------------------------------------------------------------------------------------------------------------------- |
| Alert dialog                | `AlertDialog`                    | `Alert`              | 🟢  | Both modal title/message/actions; `isPresented` vs callback pattern differs.                                                    |
| Animated visibility         | `AnimatedVisibility`             | `withAnimation`      | 🟢  | Compose animates a child in/out; SwiftUI drives the same from the transaction.                                                  |
| Badge                       | `Badge`                          | —                    | 🔴  | Material pill badge; build with `Label` or a custom overlay shape.                                                              |
| Badged box                  | `BadgedBox`                      | —                    | 🔴  | Overlay-badge primitive; build with `ZStack` + badge overlay.                                                                   |
| Basic alert dialog          | `BasicAlertDialog`               | `ConfirmationDialog` | 🟢  | Closest API twin, but NOT our confirm: it presents as a popover in a form sheet and drops Cancel — use `confirmDestructiveIos`. |
| Basic text field            | `BasicTextField`                 | `TextField`          | ✅  | Bare, unstyled text input; iOS `TextField` is the closest primitive.                                                            |
| Box                         | `Box`                            | `Group`              | 🟢  | Lightweight layout/grouping container on both.                                                                                  |
| Button                      | `Button`                         | `Button`             | ✅  | Same role/API: label + action + appearance modifiers.                                                                           |
| Card                        | `Card`                           | —                    | 🔴  | No iOS `Card`; `Group` + `shadow`/`cornerRadius`/`background` modifiers.                                                        |
| Carousel                    | `Carousel`                       | —                    | 🔴  | No iOS carousel; `TabView` page style or custom horizontal scroll.                                                              |
| Checkbox                    | `Checkbox`                       | —                    | 🔴  | No iOS checkbox; `Toggle` or a custom control.                                                                                  |
| Chip                        | `Chip`                           | —                    | 🔴  | No iOS chip; styled `Button` or `Label`.                                                                                        |
| Column                      | `Column`                         | `VStack`             | ✅  | Vertical stack on both.                                                                                                         |
| Date/time picker            | `DatePicker`                     | `DatePicker`         | ✅  | Both export `DatePicker`.                                                                                                       |
| Divider                     | `Divider`                        | `Divider`            | ✅  | Same purpose/API.                                                                                                               |
| Docked search bar           | `DockedSearchBar`                | —                    | 🔴  | No iOS search bar; `TextField` + custom layout.                                                                                 |
| Dropdown menu               | `DropdownMenu`                   | `Menu`               | 🟢  | `Menu` presents a selection menu on tap.                                                                                        |
| Exposed dropdown menu box   | `ExposedDropdownMenuBox`         | `Picker`             | 🟢  | `Picker` handles the field + selection.                                                                                         |
| Floating action button      | `FloatingActionButton`           | —                    | 🔴  | No iOS FAB; positioned `Button` via overlay.                                                                                    |
| Flow row                    | `FlowRow`                        | —                    | 🔴  | No iOS wrapping row; `Grid` or custom arrangement.                                                                              |
| Horizontal floating toolbar | `HorizontalFloatingToolbar`      | —                    | 🔴  | Material 3 toolbar; custom floating `HStack` + overlay.                                                                         |
| Horizontal pager            | `HorizontalPager`                | `TabView`            | 🟢  | `TabView` page style for horizontal paging.                                                                                     |
| Host                        | `Host`                           | `Host`               | ✅  | Embed point for expo-ui views; both platforms.                                                                                  |
| Icon                        | `Icon`                           | `Image`              | 🟢  | Android Material icons; iOS `Image` (SF Symbols / assets).                                                                      |
| Icon button                 | `IconButton`                     | —                    | 🔴  | No iOS icon-button; `Button` with image content.                                                                                |
| Lazy column                 | `LazyColumn`                     | `List`               | 🟢  | `List` gives virtualized vertical rendering.                                                                                    |
| Lazy row                    | `LazyRow`                        | `LazyHStack`         | ✅  | Lazy horizontal stack on both.                                                                                                  |
| List item                   | `ListItem`                       | —                    | 🔴  | No iOS `ListItem`; `HStack` + `Label`/`Text`.                                                                                   |
| Loading indicator           | `LoadingIndicator`               | `ProgressView`       | 🟢  | New in 57 — M3 morphing-shape loader; iOS spinner via `ProgressView`.                                                           |
| Material colors             | `getMaterialColors`              | —                    | 🔴  | Android Material palette only; iOS uses its own color system.                                                                   |
| Modal bottom sheet          | `ModalBottomSheet`               | `BottomSheet`        | 🟢  | Both present from the bottom; names differ.                                                                                     |
| Modifiers                   | `…/modifiers`                    | `…/modifiers`        | 🟢  | Both expose a modifier system; different APIs, same role.                                                                       |
| Navigation bar              | `NavigationBar`                  | `TabView`            | 🟢  | M3 bottom nav bar; iOS `TabView` fills the tab-bar role.                                                                        |
| Progress                    | `Progress`                       | `ProgressView`       | 🟢  | Both show progress; APIs differ.                                                                                                |
| Pull-to-refresh box         | `PullToRefreshBox`               | —                    | 🔴  | No iOS export; scroll view + custom refresh.                                                                                    |
| Radio button                | `RadioButton`                    | —                    | 🔴  | No iOS radio; `Picker` or custom toggle group.                                                                                  |
| RN host view                | `RNHostView`                     | `RNHostView`         | ✅  | Embed RN inside expo-ui; both platforms.                                                                                        |
| Row                         | `Row`                            | `HStack`             | ✅  | Horizontal stack on both.                                                                                                       |
| Search bar                  | `SearchBar`                      | —                    | 🔴  | No iOS search bar; `TextField` + styling.                                                                                       |
| Segmented button            | `SegmentedButton`                | `Picker`             | 🟢  | `Picker` with segmented style.                                                                                                  |
| Segmented row, single       | `SingleChoiceSegmentedButtonRow` | `Picker`             | 🟢  | The container Compose needs; `Picker` IS the container on iOS.                                                                  |
| Segmented row, multi        | `MultiChoiceSegmentedButtonRow`  | —                    | 🔴  | No multi-select segmented control on iOS; a row of `Toggle`s in a `Group`.                                                      |
| Shape                       | `Shape`                          | `Shapes`             | 🟡  | iOS `Shapes` is limited (`ConcentricRectangle`); use shape modifiers.                                                           |
| Slider                      | `Slider`                         | `Slider`             | ✅  | Same role/API.                                                                                                                  |
| Snackbar                    | `Snackbar`                       | —                    | 🔴  | No iOS snackbar; custom overlay + animation.                                                                                    |
| Spacer                      | `Spacer`                         | `Spacer`             | ✅  | Flexible spacing on both.                                                                                                       |
| Surface                     | `Surface`                        | `Group`              | 🟢  | `Surface` adds Material elevation; `Group` is lighter.                                                                          |
| Switch                      | `Switch`                         | `Toggle`             | 🟢  | On/off state; different native look.                                                                                            |
| Switch, worklet-driven      | `SyncSwitch`                     | `SyncToggle`         | ✅  | The same control driven off the UI thread; exact twins.                                                                         |
| Text                        | `Text`                           | `Text`               | ✅  | Same role/API.                                                                                                                  |
| Text field                  | `TextField`                      | `TextField`          | ✅  | Text input on both.                                                                                                             |
| Text field, outlined        | `OutlinedTextField`              | `TextField`          | 🟢  | Material's outlined variant; iOS gets it from `textFieldStyle(.roundedBorder)`.                                                 |
| Toggle button               | `ToggleButton`                   | —                    | 🔴  | No iOS toggle-button; `Button` with custom state.                                                                               |
| Tooltip                     | `Tooltip`                        | —                    | 🔴  | No iOS tooltip; custom overlay or `Popover`.                                                                                    |
| Use native state            | `useNativeState`                 | `useNativeState`     | ✅  | Cross-platform hook to sync state with the native view.                                                                         |

## SwiftUI-only exports (no Android showcase yet)

`@expo/ui` ships SwiftUI components with **no Jetpack Compose counterpart** —
candidates for an iOS-only showcase section: `Chart`, `Gauge`, `ColorPicker`,
`Stepper`, `Form`, `Section`, `DisclosureGroup`, `Label`, `LabeledContent`,
`Link`, `ShareLink`, `Menu`, `ContextMenu`, `ControlGroup`, `Popover`,
`SwipeActions`, `ContentUnavailableView`, `Grid`, `SecureField`,
`GlassEffectContainer`, `AccessoryWidgetBackground`, `Mask`, `Overlay`,
`Namespace`.

Plus one that is not a component: `withAnimation`, SwiftUI's transaction
wrapper. Compose's `AnimatedVisibility` is the nearest thing on the other side
and is in the matrix above.

## How to keep this current

Refresh after an `@expo/ui` bump by re-reading both `index.d.ts` re-export lists
and diffing them against this table (added/removed components since last sync).
**Read the index, not the directory** — `ls` misses `BasicTextField`,
`OutlinedTextField` and the two segmented rows, which are re-exported from
sibling modules, and it lists internals (`ExpoUIModule`, `SlotView`,
`layout-types`) that are not components:

```bash
grep -o "export [^;]*" node_modules/@expo/ui/build/jetpack-compose/index.d.ts
grep -o "export [^;]*" node_modules/@expo/ui/build/swift-ui/index.d.ts
```

Then update the rows and the summary counts. Pair this with the upgrade checklist
in [`expo-ui-customizations.md`](expo-ui-customizations.md).

## Native-first inventory (iOS) — updated 2026-08-22

Standing rule in `AGENTS.md` → "Native primitive first". This is the running
ledger of iOS surfaces that were authored in RN, what happened to each, and —
where they stayed RN — the reason, so nobody re-litigates it from scratch.

Two portfolio-wide passes landed on top of it and are NOT re-listed row by row,
because they changed how surfaces are painted rather than what they are built
from — both are stated in full in `AGENTS.md`: the **monochrome tint audit**
(2026-08-21 — an accent stays only where the colour IS the information; Topper
needed nothing, the trophies ring and Sound Shaper's player took the rest;
re-audited 2026-08-22, where the governing principle became "monochrome is not
colourless — an action must read as an action", and two sites came back because
ink left them looking disabled) and
the **floating-glass family** (snackbar, trophy banner, now-playing banner all
on `GlassSurfaceIos` over `GLASS_FLOOR`).

### Converted to the system control

| surface                                              | was                                                                                                             | now                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SheetFormIos` chrome (all editor sheets, both apps) | RN header `Pressable`, styled `TextInput`s, `ActivityIndicator`                                                 | SwiftUI `Form` + `Section` + `TextField` + `Button` + `ProgressView`                                                                                                                                                                                                                     |
| Topper edit-item / edit-top, Sound Shaper edit-sound | RN `ScrollView` of hand-drawn rows                                                                              | grouped native `Form`                                                                                                                                                                                                                                                                    |
| Delete item / top / sound                            | RN outlined pill (Material's `OutlinedButton` in disguise)                                                      | `Button(role: .destructive)` as a `Section` row — full width by construction                                                                                                                                                                                                             |
| Topper item-detail "Edit item"                       | RN bordered pill                                                                                                | `ActionButtonIos` (`.bordered`)                                                                                                                                                                                                                                                          |
| `EmptyState.ios` CTA (both apps)                     | filled RN pill                                                                                                  | `ActionButtonIos` (`.borderedProminent`)                                                                                                                                                                                                                                                 |
| `InlineFollowButton.ios`                             | RN capsule, two hand-picked fills                                                                               | `ActionButtonIos`, prominent = Follow / bordered = Following                                                                                                                                                                                                                             |
| Topper blocked-users "Unblock"                       | RN tonal pill                                                                                                   | `ActionButtonIos`                                                                                                                                                                                                                                                                        |
| Sound Shaper clips sheet                             | RN rows + trailing trash `IconButton`                                                                           | `Form` rows + native `SwipeActions` delete                                                                                                                                                                                                                                               |
| `RecentSearches.ios`                                 | RN rows + trailing ✕ `Pressable`, RN header                                                                     | `insetGrouped` `List` + `Section` header slot + `SwipeActions` remove                                                                                                                                                                                                                    |
| Explore "See All" people (`(app)/people.tsx`)        | did not exist — the shelf's action was unwired                                                                  | form sheet over an `insetGrouped` `List` of `PersonListRowIos`, the same native row the search results use                                                                                                                                                                               |
| Topper comments composer                             | styled `TextInput` + `Pressable` "Post"                                                                         | one `Host`: SwiftUI `TextField` (`plain`) + the ⬆ `arrow.up.circle.fill` glyph — Messages' grammar. `roundedBorder` was tried first and drew a legacy border in dark.                                                                                                                    |
| Sound Shaper `shaper.tsx`                            | RN sheet, `Pressable` chips, hand-typeset headers, RN `Switch`                                                  | grouped `Form`: `Picker` (menu) for presets, `Slider` rows, `Toggle`. Saved shapes — a checkmark `Section` with labelled swipe-to-delete — were built here and REMOVED with the feature on 2026-08-22                                                                                    |
| Sound Shaper `edit-sound`                            | four ID3 fields (title / artist / album / year) in the sheet                                                    | two: a `name` and a `subtitle` `TextField` row. The app stopped handling album and release year rather than drawing dead metadata — "Subtitle" is `UIListContentConfiguration.subtitleCell()`'s own word (2026-08-21)                                                                    |
| Sound Shaper home bar                                | TWO bar glyphs — Account beside Settings                                                                        | ONE: `HeaderSettingsButton`, the same gear every app's home now carries. The account entry moved into Settings' identity banner (`SettingsAccountLink`), which is the App Store's Apple Account row (2026-08-21)                                                                         |
| Topper top-detail item list                          | RN cards imitating a grouped list + `react-native-sortables` drag                                               | a real SwiftUI `List`: `SwipeActions` (leading Edit, trailing Delete), `List.ForEach` `onMove` reorder in the DEFAULT mode, system row highlight                                                                                                                                         |
| Topper trash (`trash.ios`)                           | Material cards, a hand-drawn `PILL_RADIUS` Recover capsule, a squashing red text action                         | `insetGrouped` `List` with `SwipeActions` — leading Recover, trailing Delete Permanently; Empty Trash stays in the bar's ⋯                                                                                                                                                               |
| Topper follow-list / See All / blocked-users         | three separate implementations (RN `Pressable`s, RN cards)                                                      | ONE `PeopleSheetListIos` over an `insetGrouped` `List` of `PersonListRowIos`; only the trailing verb differs                                                                                                                                                                             |
| Topper editors' bar (edit-top / edit-item)           | an authored header row whose "glass" circles rendered flat                                                      | the REAL UIKit bar via `sheetCommitBarOptionsIos` — title inline, ✕/✓ in the header slots, genuine Liquid Glass                                                                                                                                                                          |
| Topper reaction row                                  | three hand-drawn RN capsules                                                                                    | SwiftUI `Button` `.glass` / `.glassProminent`, floating over the list's bottom edge                                                                                                                                                                                                      |
| Topper browse-tile menu                              | no menu (an `ActionSheetIOS` on long-press was the Android shape)                                               | a real `ContextMenu` with a `TopCard` preview (`BrowseCellIos`)                                                                                                                                                                                                                          |
| Skeleton placeholder (both apps)                     | a per-bone opacity pulse, every bone in unison                                                                  | one shared `SkeletonBone` with an app-wide diagonal sweep; reduce-motion falls back to the static shape                                                                                                                                                                                  |
| Topper trophies progress summary                     | an RN block ABOVE the `Form` — pinned chrome, so the sheet needed an OPAQUE bar and lost the scroll-edge effect | the trophy `Section`'s own `header` view (`headerProminence('increased')` keeps it title-case) with a real `ProgressView` in place of a hand-painted track + fill; the sheet is one scroller and takes the family's transparent bar                                                      |
| Topper account-sheet fact rows                       | `LabeledContent`, which STACKS a long value under its label                                                     | an `HStack` (`FormValueRowIos`), one line, middle-truncated — the stack was a text line of layout shift against the redacted state                                                                                                                                                       |
| Account sheet / trophies / trash loading states      | nothing (account), a false all-locked state (trophies), a hand-built RN bone (trash)                            | the shared `SkeletonBone` bridged INTO the real `Form` / `List` row, one `RNHostView` per row. `redacted('placeholder')` was reached for first and rejected — it is static where every other bone in the app sweeps, and it blanks the label with the value (see `FormDisclosureRowIos`) |

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

That refactor is now DONE for every people list: `follow-list`, Explore's See All
and Blocked Users are one shared `PeopleSheetListIos`, and `TrashListIos` applies
the same shape to a list of tops. `CommentListIos` was the last row to adopt it
(2026-08-19) and closes the set.

The genuine remaining limits are a row whose artwork CANNOT be given a concrete
size up front, and a `Host` per cell across a large grid (see `emoji-picker`
below, and the browse grid's note in `BrowseCellIos`).

Other standing exceptions:

- **`emoji-picker` cells** — a `Host` per emoji in a large grid is a perf
  non-starter; the whole picker would have to become a SwiftUI `LazyVGrid`.
- **Sound Shaper's expanded player** (`PlayerConsole.ios`, `ClipHandles.ios`,
  `ClipActionsRow.ios`, `PlayerScrubber.ios`) — the 2026-08-21 rewrite dropped
  the card stack this entry used to name (`PlayerCards.ios`, gone; the plain
  `PlayerCards.tsx` is the Android side). What replaced it is a transport over
  a live scrubber on `GlassSurfaceIos`, with the clip trimmer as a TRIM FRAME
  drawn in RN. None of it imitates a system control — SwiftUI has no
  now-playing console to inherit — and the parts that DO map to one already
  take it: the `Slider` is `@expo/ui`'s, the glyphs are SF Symbols, the
  material is the shared glass.
- **`GoogleSignInButton.ios`** — Google's brand guidelines dictate the button.
- **`SnackbarProvider`** — no SwiftUI equivalent; it's an app-level overlay.
- **RN `Switch`** — already renders a real `UISwitch` on iOS.

### Still to do

- ~~`CommentRow.ios` → a native `List` row with `SwipeActions`~~ — **DONE
  2026-08-19** (`CommentListIos`), found by the craft audit. The row is an
  `insetGrouped` `List` row: a `plain` `Button` opening the author's profile, the
  avatar bridged through `RNHostView`, and Delete / Report behind a trailing
  swipe. The long-press `ActionSheetIOS` and the `•••` that was DRAWN OUT OF
  THREE 3.15pt `View`s are both gone. The constraint noted here was real and
  held: the Host is one `flex: 1` child of the route's column, above the pinned
  composer, and `scrollDismissesKeyboard('interactively')` replaces the RN
  list's `keyboardDismissMode`.

  Two things came out of it worth keeping. The rows are mapped in JS as direct
  children of the `List` rather than through `List.ForEach`, because an
  `RNHostView` inside a `ForEach` row renders the whole row blank — the same
  arrangement `PeopleSheetListIos` already ran. And the FlashList's
  scroll-to-top-on-change effect was DELETED rather than ported: it existed
  because FlashList held its old offset, and a SwiftUI `List` anchors its
  content instead.

- **`ProfileHeader.ios` — SETTLED AS AUTHORED RN, not outstanding work.** iOS has
  no native container for a centred profile header, and the two things inside it
  that iOS DOES provide are now the platform's own: the Follow control is
  `ActionButtonIos` and the verified mark is an SF Symbol. Only the avatar (a
  remote URL) and the stat presses remain RN, both for documented reasons. It was
  listed here as a refactor candidate; it is not one.
- **`emoji-picker` cells** — unchanged: a `Host` per emoji across a large grid is
  a perf non-starter, and the whole picker would have to become a SwiftUI
  `LazyVGrid`.

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
  `SheetFormDestructiveIos`, which a `Section` row hands a width, may hug one.
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

- **A swipe action with `role="destructive"` REMOVES THE ROW THE MOMENT IT IS
  TAPPED** — before any confirmation alert has run, so a Cancel leaves live data
  invisible until the next snapshot (sim-caught 2026-08-15). Get the red from
  `tint(colors.danger)` instead; the row then leaves only when the data does.
  `allowsFullSwipe={false}` on anything permanent, too — a flick past the
  threshold should not be able to commit an unrecoverable action.
- **`RNHostView` inside a `List.ForEach` row renders the WHOLE ROW BLANK**
  (bisected on the simulator 2026-08-15 — the same row renders once the RN bridge
  is removed). This is the FlatList/Host-per-row trap family, now confirmed for
  `ForEach`. Artwork inside a `ForEach` must therefore be pure SwiftUI: resolve
  the remote URL to expo-image's DISK CACHE path and hand `Image` a `file://` via
  `uiImage`, prefetching through expo-image so both stacks share one cache. A
  plain child of the `List` (not inside the `ForEach`) can still bridge normally.
- **`listSectionSpacing` on a `Section` sets the gap on BOTH SIDES of it, and
  that is how a fix becomes a defect.** Sound Shaper's Shape sheet handed 22 back
  to the section after a footer; SwiftUI added it above AND clamped the boundary
  below from the default 35.00 to 22.00, which is the one thing on that sheet
  Juan caught by eye. **A section boundary is the platform's — measure Apple
  before handing anything back.** Measured on iPhone 17 / iOS 26.5, both
  appearances: card to card **35.00** (our account sheet, twice), card bottom to
  the next header's ink **32.33** (Settings > Accessibility, three boundaries) and
  **31.00** ours, a card's bottom to its OWN footer ink **10.00** Apple against
  **10.67** ours, and that footer's ink to the next card **25.66** (Settings >
  Accessibility > Motion, which is three headerless sections each carrying a
  footer — the exact case). A footer's INK is not its section's edge: it belongs
  to the section above and is supposed to occupy that space.
- **`listSectionMargins({edges: 'bottom'})` is the ONE-SIDED lever, and the one
  to reach for.** Measured on a `Form` section that owns a footer: at `length:
20` it added exactly 20 below that section and left the NEXT boundary at its
  default 35.00. That is what `listSectionSpacing` cannot do (above). Use it
  when a boundary genuinely needs making up — Sound Shaper's Shape sheet adds 10
  so its footer-to-header reads 30.66 against Apple's 31.00.
- **A prominent control does not invert its own label.** `borderedProminent` and
  `glassProminent` draw their label WHITE whatever `tint` says, so a dark-mode
  `onSurface` fill is white-on-white (measured: a selected capsule's count
  disappeared). Pair a monochrome fill with `foregroundStyle` of the inverse
  token. Likewise a `Toggle`'s knob is white and fixed — an `onSurface` ON
  track in dark is one solid blob, and a mid grey reads as neither state, so the
  switch takes the platform's green (`colors.switchOn`) rather than any
  monochrome at all.
- **A swipe action ignores `foregroundStyle` too, and has no `labelColor`.** Its
  glyph and word are always white, so its `tint` must be dark in BOTH
  appearances — a light fill is an empty capsule. In practice that means it
  keeps the accent: the greys that do satisfy it read as DISABLED.
- **A `bordered` button takes its wash AND its label from `tint`**, so tinting it
  with the page's ink gives grey-on-grey — again the disabled look. Only
  `borderedProminent` can carry a monochrome fill, and only with an explicit
  inverse label.
- **`listSectionMargins` only bites at SECTION level on @expo/ui 57** — on the
  `List` itself it measured as a no-op, as did `listSectionSpacing`. The gap iOS
  puts BETWEEN sections is likewise not ours to shrink (measured 30.3pt); a tail
  spacer has to subtract it.
- **A grouped list's separator inset follows the leading edge of the row's TEXT,
  not its artwork** — which cuts both ways depending on what leads the row. A
  person row (image first) insets past the avatar and its gap (measured 72); a
  top-detail item row leads with the rank NUMERAL, and its separator measured
  26.33 from the card edge, nowhere near the artwork. Measure it per row shape;
  do not derive it.
- **`redacted(.placeholder)` IS exposed** by @expo/ui 57 (`modifiers/index.d.ts`),
  and this repo does NOT use it. It is static by design — Apple ships no shimmer
  — so on a surface sitting beside twenty sweeping bones it reads as the odd one
  out, and it blanks a row's label along with its value. The shipped answer is
  `SkeletonBone` bridged into the native row. Reach for `redacted` only if the
  whole portfolio ever drops the sweep.

### Simulator gotcha while verifying these

`simctl`-injected typing re-enables the **hardware** keyboard, after which
tapping a field focuses it, draws no software keyboard, and still reports a
keyboard frame — so a keyboard-driven inset looks permanently stuck. It is not
an app bug. Restart Simulator.app (with
`defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false`)
and drive the field by taps only.
