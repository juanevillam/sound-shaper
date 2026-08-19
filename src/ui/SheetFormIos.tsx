import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import {
  Button,
  Form,
  HStack,
  Host,
  Image,
  ProgressView,
  RNHostView,
  Spacer,
  Text as SwiftUIText,
  TextField,
  VStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  keyboardType as keyboardTypeModifier,
  lineLimit,
  listRowBackground,
  listRowSeparator,
  padding,
  scrollContentBackground,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { useAppTheme } from '@portfolio/core';

// Base specifier, not `.ios`: the bundler resolves the real glyph on iOS and
// the stub on Android (this file is iOS-only by NAME, so it has no `.ios`
// suffix of its own to resolve against).
import { HeaderGlyphButtonIos } from './HeaderGlyphButton';
import { SHEET_EMPTY_HEADER_SLOT } from './sheetMetrics';
import { SwiftUIHost } from './SwiftUIHost';
import { spacing } from './tokens';

/**
 * WHAT THE BODY PULLS BACK — the grouped empty section-header slot, less a
 * measured 3.33 residual.
 *
 * The slot itself is `SHEET_EMPTY_HEADER_SLOT`, the same 21 every sheet in the
 * portfolio takes off. The residual is not a fudge: this Form's own first
 * section inset differs from a `List`'s by that much, so a flat 21 landed the
 * first card 80.67 below the sheet's own top edge against the family's 84.00.
 * SOLVED BACKWARDS against `SHEET_CONTENT_TOP`, band-scanned on iPhone 17 /
 * iOS 26.5, not chosen.
 *
 * Re-measure against a family sheet — `manage-account` or `trophies` — if the
 * sheet chrome changes; the target is the constant, this is the compensation.
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
  // The native form owns the whole sheet, so its host fills it.
  formHost: { flex: 1 },
  /**
   * THE EMPTY SECTION-HEADER SLOT, pulled back — the same 21pt every other
   * sheet in the portfolio takes off, and taken the same way.
   *
   * This body sits under the NATIVE inline bar (`sheetCommitBarOptionsIos`),
   * so it is the account family's shape, not the inline-header one: its `Form`
   * reserves room above its first section for a header it does not have, and
   * the band under the title read as a hole. Measured 55.67 below the title's
   * ink against the family's `SHEET_TITLE_TO_CONTENT` of 38.5.
   *
   * IT COMES OFF THE HOSTING VIEW, never off the `Form`. `PeopleSheetListIos`
   * measured seven levers and this is the one that shipped: moving the SwiftUI
   * frame inside the Host leaves RNScreens' content inset describing the old
   * layout and the scroller gains 21pt of empty travel, while moving the
   * hosting VIEW makes UIKit recompute with it. Confirmed here too — negative
   * padding on this Form was a no-op.
   *
   * `formHost` above keeps NO pull-back on purpose: `SheetFormIos` draws its
   * own header inside the Host, so shifting the box would move the header too.
   */
  bodyHost: { flex: 1, marginTop: -BODY_PULL_BACK },
});

type SheetFormProps = {
  title: string;
  actionLabel: string;
  actionEnabled?: boolean;
  busy?: boolean;
  onAction: () => void;
  /**
   * Already-translated "Cancel". Renders the leading half of Apple's
   * commit-modal pair — see the header note below. Omit only for a sheet that
   * commits nothing.
   */
  cancelLabel?: string;
  /** Dismiss without committing. Required whenever `cancelLabel` is given. */
  onCancel?: () => void;
  /** `Section`s — the form's rows. */
  children: React.ReactNode;
};

/**
 * THE COMMIT-MODAL HEADER, iOS 26's grammar — measured, not remembered.
 *
 * iOS 26 replaced the Cancel/Done WORD pair on commit sheets with GLYPH
 * CIRCLES: a label-coloured ✕ in a Liquid Glass circle leading, and a ✓ in a
 * FILLED ACCENT circle trailing — grey while the form is invalid, the app's
 * accent once it can commit. Both New Contact (Contacts) and New Event
 * (Calendar) were band-scanned on iPhone 17 / iOS 26.5:
 *
 *   circle          44 × 44, inset 16 from the sheet edge, top 16
 *   ✕ ink           17 × 17, label colour, on glass
 *   ✓ ink           ~18 × 18, white, on the fill
 *   disabled fill   (202,202,208) — light grey under a white check
 *   title           17pt SEMIBOLD, centred on the circles' axis
 *
 * The header this replaces was the PRE-26 imitation — "Cancel" and "Create"
 * as tinted words, with a `title2`-bold title no Apple commit sheet uses.
 * The word labels survive as ACCESSIBILITY labels on the glyphs, so the API
 * (and every translated call site) is unchanged.
 *
 * The disabled fill is `surfaceVariant` + `onSurfaceMuted` rather than
 * Apple's sampled grey-under-white: the palette rule is semantic tokens only,
 * and the token pair keeps the same "dimmed control" read in both modes.
 *
 * It stays a SwiftUI `HStack` in the SAME host as the form, so chrome and
 * rows cannot drift; `scrollContentBackground('hidden')` drops the Form's own
 * grouped backdrop (the sheet already paints one).
 */
const HEADER_CIRCLE = 44;
/** TUNED TO THE INK, not to Apple's requested size (which is unknowable from a
 *  screenshot): SF symbols are sized by font metrics, so `xmark` at 22 rendered
 *  16.33pt of ink against Apple's measured 17.0 — 23 closes it. Re-measure the
 *  ink, not the constant, if the glyphs ever change. */
const CLOSE_GLYPH_SIZE = 23;
const COMMIT_GLYPH_SIZE = 23;

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
export function SheetFormBodyIos({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();

  return (
    <Host style={styles.bodyHost}>
      {/* EXACTLY the Settings sheet's Form — `tint` on the whole Form (so a
          menu picker's value renders tinted, as Settings' Language and
          Appearance values do) and the Form's OWN grouped background kept.
          The editors first inherited the inline-header design's
          `scrollContentBackground('hidden')` and no tint, and the same
          control two sheets apart wore different value colours AND row
          fills — caught by eye in both modes. One titled sheet family, one
          Form recipe. */}
      <Form modifiers={[tint(colors.primary)]}>{children}</Form>
    </Host>
  );
}

export function SheetFormIos({
  title,
  actionLabel,
  actionEnabled = true,
  busy = false,
  onAction,
  cancelLabel,
  onCancel,
  children,
}: SheetFormProps) {
  const { colors } = useAppTheme();

  return (
    <Host style={styles.formHost}>
      <VStack spacing={0}>
        <HStack modifiers={[padding({ horizontal: 16, top: 16, bottom: 4 })]}>
          {cancelLabel && onCancel ? (
            <>
              <Image
                systemName="xmark"
                size={CLOSE_GLYPH_SIZE}
                color={colors.onSurface}
                onPress={onCancel}
                modifiers={[
                  frame({ width: HEADER_CIRCLE, height: HEADER_CIRCLE }),
                  glassEffect({
                    shape: 'circle',
                    glass: { variant: 'regular', interactive: true },
                  }),
                  accessibilityLabel(cancelLabel),
                ]}
              />
              <Spacer />
            </>
          ) : null}
          <SwiftUIText
            modifiers={[
              // Headline — 17/semibold, what New Contact / New Event set their
              // titles in. `title2`-bold read as a screen title on a modal.
              font({ size: 17, weight: 'semibold' }),
              foregroundStyle(colors.onSurface),
            ]}
          >
            {title}
          </SwiftUIText>
          <Spacer />
          {busy ? (
            // The spinner takes the ✓'s own circle, so nothing moves when the
            // commit starts — same slot, same fill, the glyph swaps out.
            <ProgressView
              modifiers={[
                frame({ width: HEADER_CIRCLE, height: HEADER_CIRCLE }),
                background(colors.surfaceVariant, shapes.circle()),
              ]}
            />
          ) : (
            <Image
              systemName="checkmark"
              size={COMMIT_GLYPH_SIZE}
              color={actionEnabled ? colors.onPrimary : colors.onSurfaceMuted}
              onPress={onAction}
              modifiers={[
                frame({ width: HEADER_CIRCLE, height: HEADER_CIRCLE }),
                background(
                  actionEnabled ? colors.primary : colors.surfaceVariant,
                  shapes.circle(),
                ),
                ...(actionEnabled ? [] : [disabledModifier(true)]),
                accessibilityLabel(actionLabel),
              ]}
            />
          )}
        </HStack>
        <Form modifiers={[scrollContentBackground('hidden')]}>{children}</Form>
      </VStack>
    </Host>
  );
}

type SheetFormFieldProps = {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  error?: string | null;
  multiline?: boolean;
  keyboardType?: 'default' | 'numberPad';
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
  error,
  multiline = false,
  keyboardType = 'default',
}: SheetFormFieldProps) {
  const { colors } = useAppTheme();
  const text = useNativeState(value);

  return (
    <VStack alignment="leading" spacing={2}>
      <TextField
        text={text}
        placeholder={placeholder}
        onTextChange={onChangeText}
        axis={multiline ? 'vertical' : 'horizontal'}
        modifiers={[
          keyboardTypeModifier(
            keyboardType === 'numberPad' ? 'numeric' : 'default',
          ),
          ...(multiline ? [lineLimit(6, { reservesSpace: true })] : []),
        ]}
      />
      {error ? (
        <SwiftUIText
          modifiers={[
            font({ textStyle: 'footnote' }),
            foregroundStyle(colors.danger),
          ]}
        >
          {error}
        </SwiftUIText>
      ) : null}
    </VStack>
  );
}

type SheetFormMediaProps = {
  /** RNHostView bridges ONE RN element into SwiftUI — not a ReactNode list. */
  children: React.ReactElement;
  /**
   * Already-translated label under the media — an ACTION when `onPress` is
   * given ("Add Photo"), a muted status otherwise.
   *
   * OPTIONAL because a caller may render the caption INSIDE its own press
   * target instead (Topper's item editor does, so the artwork and its label
   * are one control — the arrangement Home's create tile uses). Omit it and
   * this component is just the transparent, separator-less media row.
   */
  caption?: string;
  /** Makes the caption the tappable half of the picker (Contacts' "Add
   *  Photo" label). Omit while busy to render it as a plain status line. */
  onPress?: () => void;
};

/**
 * Centred media over its caption — CONTACTS' photo-editor arrangement: the
 * row is TRANSPARENT (no grouped fill, no separator), so the artwork floats
 * directly on the sheet background with a small tinted action label under
 * it. It sat on a grouped row fill before, and the placeholder's own fill on
 * top of the row's read as a box inside a box (Juan: "looks weird") —
 * Contacts draws exactly this control with no container behind it.
 */
const noop = () => {};

export function SheetFormMediaIos({
  children,
  caption,
  onPress,
}: SheetFormMediaProps) {
  const { colors } = useAppTheme();

  return (
    <VStack
      spacing={spacing.sm}
      modifiers={[listRowBackground('transparent'), listRowSeparator('hidden')]}
    >
      {/* RNHostView takes no style and `matchContents` is boolean-only, so
          the RN child must carry its own size AND centre itself in a
          full-width wrapper — the slot is as big as what you hand it. */}
      <RNHostView matchContents>{children}</RNHostView>
      {/* ALWAYS a Button, even for the busy status — a `Text` swapped in
          here rendered a footnote line where a small control had been, so
          every state change jumped the sheet's layout (Juan caught the CLS).
          Same control, same box; only the tint and the enabled state
          change. */}
      {caption ? (
        <Button
          label={caption}
          onPress={onPress ?? noop}
          modifiers={[
            buttonStyle('borderless'),
            controlSize('small'),
            tint(onPress ? colors.primary : colors.onSurfaceMuted),
            ...(onPress ? [] : [disabledModifier(true)]),
          ]}
        />
      ) : null}
    </VStack>
  );
}

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /**
   * `prominent` is the filled capsule (a screen's primary call to action);
   * `bordered` is the tinted tonal one (a secondary or in-sheet action).
   */
  variant?: 'bordered' | 'prominent';
  /**
   * SwiftUI `controlSize`. `large` (default) is the standalone-CTA size —
   * sheets, empty states, full-width actions. `regular` and `small` are for
   * an action living inside a tile or row, where the content leads and the
   * button follows: `small` beside list-row-scale art (the App Store's GET),
   * `regular` beside larger artwork that would dwarf the small pill.
   */
  size?: 'small' | 'regular' | 'large';
  /** Positioning only — the button's own look belongs to the system. */
  style?: StyleProp<ViewStyle>;
};

/**
 * The affirmative counterpart of `SheetFormDestructiveIos`: a system `Button`,
 * for every forward action across the portfolio's iOS surfaces — "Edit item" in
 * a sheet, an empty state's CTA, an Unblock pill.
 *
 * Every one of those used to be a `Pressable` with a hand-drawn pill, a
 * hardcoded fill and its own opacity ramp — i.e. Material's button wearing an
 * iOS palette, and a different imitation per screen. One export, so a portfolio
 * button is the platform's button.
 */
/**
 * THE PORTFOLIO BUTTON'S MODIFIER STACK, on its own — so a caller that cannot
 * use `ActionButtonIos` still gets the identical control.
 *
 * There is exactly one such caller and it is a real constraint, not laziness:
 * `EmptyState.ios` puts its CTA in a `VStack` beside a `ContentUnavailableView`
 * (the @expo/ui wrapper exposes no `actions` slot — see that file), and
 * `ActionButtonIos` brings its own `Host`, which cannot nest inside another
 * one. It was therefore hand-rolling `borderedProminent` + `large` + `tint`,
 * three lines that had to stay in step with this file by memory. Now the stack
 * is the shared thing and only the Host differs.
 */
export function actionButtonModifiersIos({
  tintColor,
  variant = 'bordered',
  size = 'large',
  disabled = false,
}: {
  tintColor: string;
  variant?: 'bordered' | 'prominent';
  size?: 'small' | 'regular' | 'large';
  disabled?: boolean;
}) {
  return [
    buttonStyle(variant === 'prominent' ? 'borderedProminent' : 'bordered'),
    controlSize(size),
    tint(tintColor),
    ...(disabled ? [disabledModifier(true)] : []),
  ];
}

export function ActionButtonIos({
  label,
  onPress,
  disabled = false,
  variant = 'bordered',
  size = 'large',
  style,
}: ActionButtonProps) {
  const { colors } = useAppTheme();

  return (
    // `matchContents` hugs BOTH axes, and there is no option not to. Hugging
    // only the vertical axis (what `SheetFormDestructiveIos` does, because a
    // Section row hands it a width) leaves the Host filling whatever width it
    // is given — and a capsule CTA is usually given none: a centred column or a
    // row's trailing slot has auto width, the button measures at ~0 wide, and
    // it renders as a tall BLANK bar with no label at all. Stretching is not
    // the alternative either: a `.bordered` button hugs its label whatever
    // width the Host has (`frame({ maxWidth: Infinity })` is a no-op), so full
    // width only ever comes from a `Section` row.
    <Host matchContents style={style}>
      <Button
        label={label}
        onPress={onPress}
        modifiers={actionButtonModifiersIos({
          tintColor: colors.primary,
          variant,
          size,
          disabled,
        })}
      />
    </Host>
  );
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

  return (
    // `ignoreSafeArea`: same keyboard-shift bug the ✕ had — see
    // `HeaderGlyphButton.ios`. A bar item never wants safe-area framing.
    <SwiftUIHost matchContents ignoreSafeArea="all">
      {busy ? (
        <ProgressView />
      ) : (
        <Image
          systemName="checkmark"
          size={COMMIT_INK}
          color={enabled ? colors.primary : colors.onSurfaceMuted}
          onPress={onPress}
          modifiers={[
            ...(enabled ? [] : [disabledModifier(true)]),
            accessibilityLabel(label),
          ]}
        />
      )}
    </SwiftUIHost>
  );
}
