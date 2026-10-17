import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
} from 'react';

import { StyleSheet } from 'react-native';

import {
  Button,
  Form,
  HStack,
  Host,
  RNHostView,
  Spacer,
  Text as SwiftUIText,
  TextField,
  VStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
  foregroundStyle,
  listRowBackground,
  listSectionMargins,
  listRowSeparator,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { useAppTheme } from '@/core';

import { HeaderGlyphButtonIos } from './HeaderGlyphButtonIos';
import { mediaPickerSlotHeight } from './MediaPickerAvatar';
import {
  SHEET_EMPTY_HEADER_SLOT,
  SHEET_FIRST_CARD_MARGIN,
} from './sheetMetrics';
import { spacing } from './tokens';

/**
 * WHAT THE BODY PULLS BACK — the grouped empty section-header slot, and THE
 * DETENT DECIDES WHETHER A RESIDUAL COMES OFF IT.
 *
 * The slot itself is `SHEET_EMPTY_HEADER_SLOT`, the same 21 every sheet in the
 * portfolio takes off. On a FRACTIONAL sheet this Form's own first-section
 * inset differs from a `List`'s by 3.33, so a flat 21 landed the first card
 * 80.67 below the sheet's own top edge against the family's 84.00. That was
 * SOLVED BACKWARDS against `SHEET_CONTENT_TOP`, band-scanned on iPhone 17 /
 * iOS 26.5, not chosen.
 *
 * AT THE LARGE DETENT THERE IS NO RESIDUAL, and assuming there was shipped
 * both of Sound Shaper's `[1]` form sheets 3.33 low. Measured 2026-08-22, same
 * device, 6-frame bursts with no interaction:
 *
 *   Topper    `edit-top`   [0.38]   84.00  ✓ (this constant, as solved)
 *   Topper    `edit-item`  [0.62]   97.67  ✓ (hero ink + the row's padding)
 *   Sound Sh. `edit-sound` [0.65]   98.33  ✓ (same hero shape)
 *   Sound Sh. `shaper`     [1]      87.33  ✗ — 3.33 low
 *   Sound Sh. `clips`      [1]      87.33  ✗ — 3.33 low
 *
 * Every fractional sheet in the portfolio lands on the family number and both
 * full-height ones miss it by exactly the residual, so the compensation is the
 * fractional presentation's, not the Form's. Topper owns no `[1]` form sheet,
 * which is the only reason this stood for as long as it did.
 *
 * THE FULL-HEIGHT CASE NO LONGER PULLS THE HOST BACK AT ALL (2026-10-10).
 * It took the flat 21 off the hosting view, which put the card on 84 and the
 * top of the `Form` under the sheet's bar — and UIKit draws a bar's hard
 * scroll-edge band, separator included, over content it believes has scrolled
 * under it. Every `[1]` editor opened looking already scrolled (Booker's New
 * Highlight is where Juan saw it). It now takes a top margin on its first
 * section instead — the Settings banner's lever and its value — which lands
 * it level with Settings with the `Form` left where UIKit put it (centre-line
 * band-scan, eight frames, one runtime: Settings 88.00, New Highlight at 15
 * 85.00, at 18 88.00 — the slope is 1:1). The fractional case keeps
 * the pull-back: its band was not measured here, and no fractional editor was
 * reported. Re-measure against a family sheet (`manage-account` or `trophies`)
 * if the sheet chrome changes; the target is `SHEET_CONTENT_TOP`.
 */
const BODY_PULL_BACK = SHEET_EMPTY_HEADER_SLOT - 3.33;

/**
 * Chrome for the iOS form-sheet routes, shared by every portfolio app: the
 * grouped `Form` with its title + tinted-action header, the `TextField` row,
 * the centred media row, the affirmative button and the destructive row.
 *
 * It lives in the package rather than per app because these are the SAME
 * surface — an app that re-authored one drifted from the others within a week
 * (mismatched delete buttons, two different media treatments). Labels arrive
 * already translated (the package has no app translator), and colors come from
 * the shared `useAppTheme`, so a call site passes only content.
 *
 * Everything here is the platform's own control. An earlier version of this
 * file drew the same sheet out of RN views — a `Pressable` for the action, a
 * styled `TextInput` per field, an `ActivityIndicator` while saving, and an
 * outlined pill for delete that was, unwittingly, Material's `OutlinedButton`
 * redrawn by hand and shipped on iOS. Beside the real controls in
 * `apps/expo-ui-starter`'s showcase the imitation was obvious; worse, the ANDROID
 * twins of these sheets were already 100% Compose, so iOS was the only platform
 * wearing hand-made paint. Those RN components were deleted once the last
 * sheet (`shaper.tsx`) moved over — going through SwiftUI also hands us press
 * and disabled states, Dynamic Type and the right accessibility traits for
 * free, instead of the opacity ramps we were maintaining.
 */

const styles = StyleSheet.create({
  /**
   * THE EMPTY SECTION-HEADER SLOT, pulled back — the same 21pt every other
   * sheet in the portfolio takes off, and taken the same way.
   *
   * This body sits under the NATIVE inline bar (`sheetCommitBarOptionsIos`),
   * so it is the account family's shape, not the inline-header one: its `Form`
   * reserves room above its first section for a header it does not have, and
   * the band under the title read as a hole. Measured 55.67 below the title's
   * ink against the family's 38.5.
   *
   * IT COMES OFF THE HOSTING VIEW, never off the `Form`. `PeopleSheetListIos`
   * measured seven levers and this is the one that shipped: moving the SwiftUI
   * frame inside the Host leaves RNScreens' content inset describing the old
   * layout and the scroller gains 21pt of empty travel, while moving the
   * hosting VIEW makes UIKit recompute with it. Confirmed here too — negative
   * padding on this Form was a no-op.
   */
  bodyHost: { flex: 1, marginTop: -BODY_PULL_BACK },
  /** A `[1]` sheet's Host is not moved — its first section takes the margin. */
  bodyHostFullHeight: { flex: 1 },
});

/**
 * THE AUTHORED COMMIT HEADER IS GONE, and what it recorded is worth keeping.
 *
 * It drew a Cancel/commit pair INSIDE the form's own Host: a label-coloured ✕
 * in a glass circle leading, and a ✓ in a FILLED ACCENT circle trailing. That
 * pair is Apple's real iOS 26 grammar — band-scanned from New Contact and New
 * Event — and the measurements live in `docs/pending-upstream.md`, against
 * RNScreens exposing prominent bar items.
 *
 * It lost anyway, for a reason that had nothing to do with the design: an
 * authored header cannot have genuine Liquid Glass. Its "glass" sits over a
 * static sheet with nothing ever passing behind it, so the circles render
 * flat. `SheetFormBodyIos` + `sheetCommitBarOptionsIos` put the same pair in
 * the SYSTEM'S bar instead, where the material is real, and every editor in
 * the portfolio moved across — Topper's two first, Sound Shaper's three on
 * 2026-08-21. Nothing imported this component afterwards, so it went.
 *
 * The FILLED DISC does not survive the move, and that is a platform limit
 * rather than a verdict on it: a bar item is one glass capsule UIKit draws
 * itself, so a fill inside it is a nesting artifact (rejected on sight, in
 * dark). `SheetCommitGlyphIos` tints the GLYPH instead.
 */

/**
 * THE FORM FOR A TITLED SHEET ROUTE — the whole component, because a titled
 * route's chrome is UIKit's: the title sits in a real navigation bar and the
 * ✕ / ✓ ride `headerLeft` / `headerRight` (see `sheetCommitBarOptionsIos`).
 * That is the arrangement that gets genuine Liquid Glass — the bar is the
 * system's, so scrolling content dissolves under it and the glyph capsules
 * refract for real, which the authored header in `SheetFormIos` never can
 * (its glass sits over a static sheet with nothing ever passing behind it).
 *
 * IT IS A SEPARATE EXPORT rather than a `titledBar` flag on `SheetFormIos`,
 * because the flag made five of that component's props dead on arrival — a
 * titled caller still had to pass `title`, `actionLabel`, `actionEnabled`,
 * `busy` and `onAction`, none of which were read, while stating the same five
 * things for real in its `Stack.Screen`. Both Topper editors did exactly that,
 * so each named its commit action twice and neither copy was the one that
 * rendered. Two components, each with only the props it uses.
 */
export function SheetFormBodyIos({
  children,
  fullHeight = false,
}: {
  children: React.ReactNode;
  /**
   * PASS THIS WHEN THE ROUTE'S DETENT IS `[1]`, and nothing else — a sheet
   * presented at the large detent leaves its Host alone and takes the empty
   * header slot off its first section (see `BODY_PULL_BACK`). It is stated rather than sensed on
   * purpose: the honest signal is the screen's own safe-area top inset, which
   * arrives from the provider and can land a frame late, and an async answer on
   * the layout path is the exact bug family `SHEET_BONE_TOP` and
   * `matchContents` already cost this repo three times.
   *
   * The detent itself lives in each app's `IOS_FORM_SHEETS`; this call site is
   * where the two meet, so change them together.
   */
  fullHeight?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <Host style={fullHeight ? styles.bodyHostFullHeight : styles.bodyHost}>
      {/* EXACTLY the Settings sheet's Form — `tint` on the whole Form (so a
          menu picker's value renders tinted, as Settings' Language and
          Appearance values do) and the Form's OWN grouped background kept.
          The editors first inherited the inline-header design's
          `scrollContentBackground('hidden')` and no tint, and the same
          control two sheets apart wore different value colours AND row
          fills — caught by eye in both modes. One titled sheet family, one
          Form recipe. */}
      <Form modifiers={[tint(colors.primary)]}>
        {fullHeight ? withFirstCardMargin(children) : children}
      </Form>
    </Host>
  );
}

/**
 * The first `Section` takes `SHEET_FIRST_CARD_MARGIN` as a top margin
 * (see `BODY_PULL_BACK`). The call sites pass plain `Section`s, so the margin is
 * appended to whatever modifiers the first one already carries.
 */
function withFirstCardMargin(children: React.ReactNode) {
  let applied = false;
  return Children.map(children, child => {
    if (applied || !isValidElement(child)) return child;
    applied = true;
    const section = child as ReactElement<{ modifiers?: unknown[] }>;
    return cloneElement(section, {
      modifiers: [
        ...(section.props.modifiers ?? []),
        listSectionMargins({
          edges: 'top',
          length: SHEET_FIRST_CARD_MARGIN,
        }),
      ],
    });
  });
}

type SheetFormFieldProps = {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
};

/**
 * One `TextField` row. The field is UNCONTROLLED on the native side — its text
 * lives in an `ObservableState` seeded once from `value`, and React only
 * listens via `onTextChange`. Pushing every keystroke back down as a prop
 * fights the UIKit text engine (dropped characters, jumping carets); the
 * native field owns its buffer and JS owns validation.
 */
export function SheetFormFieldIos({
  value,
  onChangeText,
  placeholder,
}: SheetFormFieldProps) {
  const text = useNativeState(value);

  return (
    <VStack alignment="leading" spacing={2}>
      <TextField
        text={text}
        placeholder={placeholder}
        onTextChange={onChangeText}
      />
    </VStack>
  );
}

type SheetFormMediaProps = {
  /** RNHostView bridges ONE RN element into SwiftUI — not a ReactNode list. */
  children: React.ReactElement;
};

/**
 * Centred media — CONTACTS' photo-editor arrangement: the row is TRANSPARENT
 * (no grouped fill, no separator), so the artwork floats directly on the
 * sheet background. Callers render the caption INSIDE their own press target,
 * so the artwork and its label are one control. It sat on a grouped row fill
 * before, and the placeholder's own fill on top of the row's read as a box
 * inside a box (Juan: "looks weird") — Contacts draws exactly this control
 * with no container behind it.
 */
export function SheetFormMediaIos({ children }: SheetFormMediaProps) {
  return (
    <VStack
      spacing={spacing.sm}
      modifiers={[listRowBackground('transparent'), listRowSeparator('hidden')]}
    >
      {/* THE BOX IS RESERVED IN SWIFTUI, never asked of the child: a
          `matchContents` host inside a native row answers its size after the
          row has laid out once without it — a shift on the frame the media
          mounts (the house ban). At its default the host fills its parent, so
          the framed stack states the slot's height and the row hands it the
          width; the RN child still centres itself in that full-width box. */}
      <VStack modifiers={[frame({ height: mediaPickerSlotHeight() })]}>
        <RNHostView>{children}</RNHostView>
      </VStack>
    </VStack>
  );
}

/**
 * THE PORTFOLIO BUTTON'S MODIFIER STACK — the affirmative counterpart of
 * `SheetFormDestructiveIos`, for every forward action on the app's iOS
 * surfaces. Every one of those used to be a `Pressable` with a hand-drawn
 * pill, a hardcoded fill and its own opacity ramp — i.e. Material's button
 * wearing an iOS palette, and a different imitation per screen. One stack, so
 * the button is the platform's button.
 *
 * It is a modifier stack rather than a component because its caller
 * (`EmptyState.ios`) puts the `Button` inside a SwiftUI tree it already
 * hosts, and a `Host` cannot nest inside another one.
 *
 * MONOCHROME ONLY WHERE IT STILL READS AS A BUTTON (2026-08-22). The FILLED
 * variant takes the ink: a solid black-in-light, white-in-dark capsule is
 * unmistakably a control. The BORDERED variant KEEPS THE ACCENT, because it
 * derives BOTH its wash and its label from the tint; inked, it renders a grey
 * capsule with grey-ish text — iOS's vocabulary for DISABLED.
 */
export function actionButtonModifiersIos({
  tintColor,
  variant = 'bordered',
  size = 'large',
  disabled = false,
  labelColor,
}: {
  tintColor: string;
  variant?: 'bordered' | 'prominent';
  size?: 'small' | 'regular' | 'large';
  disabled?: boolean;
  /**
   * THE FILLED VARIANT'S LABEL, and it exists because a `borderedProminent`
   * button DOES NOT INVERT ITS OWN LABEL: SwiftUI draws that label white
   * whatever the tint is. That was invisible while the tint was blue and
   * became a white-on-white capsule the moment the fill went `onSurface` in
   * dark — measured on device. Pass `colors.background`, which is
   * `onSurface`'s inverse in both appearances, so the label follows the FILL
   * rather than the colour scheme. Ignored by the bordered variant, whose
   * label is the tint itself.
   */
  labelColor?: string;
}) {
  return [
    buttonStyle(variant === 'prominent' ? 'borderedProminent' : 'bordered'),
    controlSize(size),
    tint(tintColor),
    ...(variant === 'prominent' && labelColor
      ? [foregroundStyle(labelColor)]
      : []),
    ...(disabled ? [disabledModifier(true)] : []),
  ];
}

type SheetFormDestructiveProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * The destructive row: a centred red label filling the section. No `style` and
 * no frame — it is full width because the `Section` row makes it so, which is
 * the Contacts / Calendar "Delete Contact" pattern.
 */
export function SheetFormDestructiveIos({
  label,
  onPress,
  disabled = false,
}: SheetFormDestructiveProps) {
  return (
    <Button
      role="destructive"
      onPress={onPress}
      modifiers={disabled ? [disabledModifier(true)] : []}
    >
      <HStack>
        <Spacer />
        <SwiftUIText>{label}</SwiftUIText>
        <Spacer />
      </HStack>
    </Button>
  );
}

/**
 * THE ✓ FOR A TITLED EDITOR SHEET — the trailing bar item of the commit-modal
 * pair. A TINTED GLYPH on the system's glass, not a filled circle: the glyph
 * is `primary` while the form can commit, muted while it cannot, and the busy
 * spinner takes the same slot.
 *
 * Apple's own enabled ✓ (New Contact / New Event) is stronger — the CAPSULE
 * ITSELF fills with the accent, iOS 26's `.prominent` bar item — and that is
 * out of reach: RNScreens hands a `headerRight` custom view ONE glass capsule
 * it draws itself, so the fill can only ever be a smaller disc INSIDE the
 * glass ring. That was built and rejected on sight (Juan's call, plainest in
 * dark mode): a blue disc floating in a lighter glass ring is a nesting
 * artifact, not a design. Filling the full content instead stretches the
 * capsule to a 51 × 43.7 pill (measured — UIKit grows its capsule around
 * content). So the state moves to the glyph's COLOUR, the glass stays the
 * system's, and the true prominent fill is recorded in
 * docs/pending-upstream.md against RNScreens exposing prominent bar items.
 *
 * The ✕ needs no counterpart here: a plain `HeaderGlyphButtonIos` with
 * `xmark` in `headerLeft` IS Apple's leading half — label-coloured glyph,
 * system glass circle.
 */
const COMMIT_INK = 24;

type SheetCommitGlyphProps = {
  /** Already-translated action name — the glyph's accessibility label. */
  label: string;
  enabled?: boolean;
  busy?: boolean;
  onPress: () => void;
};

type SheetCommitBarOptions = {
  /** Already-translated screen title for the sheet's UIKit bar. */
  title: string;
  /** Already-translated "Cancel" — the ✕'s accessibility label. */
  cancelLabel: string;
  onCancel: () => void;
  /** Already-translated action name — the ✓'s accessibility label. */
  actionLabel: string;
  actionEnabled?: boolean;
  busy?: boolean;
  onAction: () => void;
};

/**
 * THE COMMIT-MODAL PAIR AS `Stack.Screen` OPTIONS — one statement of a titled
 * editor sheet's bar, for every editor in the portfolio.
 *
 * Apple's arrangement, in the only place it can be genuine: the ✕ is a plain
 * bar glyph that UIKit gives its own glass circle, the ✓ is
 * `SheetCommitGlyphIos`, and the title is the bar's. Authoring the same three
 * things per route is what this replaces — Topper's two editors carried
 * byte-identical `headerLeft` blocks and near-identical `headerRight` ones, so
 * a change to the pair had to be made twice and the second copy is the one that
 * gets missed.
 *
 * It returns options rather than rendering, because a route declares its bar
 * through `Stack.Screen` and the header slots are functions UIKit calls.
 */
export function sheetCommitBarOptionsIos({
  title,
  cancelLabel,
  onCancel,
  actionLabel,
  actionEnabled = true,
  busy = false,
  onAction,
}: SheetCommitBarOptions) {
  return {
    title,
    headerLeft: () => (
      <HeaderGlyphButtonIos
        systemName="xmark"
        label={cancelLabel}
        onPress={onCancel}
      />
    ),
    headerRight: () => (
      <SheetCommitGlyphIos
        label={actionLabel}
        enabled={actionEnabled}
        busy={busy}
        onPress={onAction}
      />
    ),
  };
}

export function SheetCommitGlyphIos({
  label,
  enabled = true,
  busy = false,
  onPress,
}: SheetCommitGlyphProps) {
  const { colors } = useAppTheme();

  // THE BAR GLYPH, NOT A SECOND ONE. This was a bare `Image` with `onPress`,
  // a hand-painted muted ink while it could not commit, and `disabled(true)`
  // on top — the exact arrangement `HeaderGlyphButton.ios` records as the bug:
  // SwiftUI's disabled treatment reaches CONTROLS, so on a bare Image it
  // dimmed nothing and the colour was doing the platform's job. Routed through
  // `HeaderGlyphButtonIos`, the ✓ is a real `Button`, disabled the way every
  // other control is, with the busy spinner in its own slot.
  return (
    <HeaderGlyphButtonIos
      systemName="checkmark"
      label={label}
      onPress={onPress}
      size={COMMIT_INK}
      tint={colors.primary}
      disabled={!enabled}
      busy={busy}
    />
  );
}
