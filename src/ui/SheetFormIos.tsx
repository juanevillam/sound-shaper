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
  padding,
  scrollContentBackground,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useAppTheme } from '@portfolio/core';

import { SwiftUIHost } from './SwiftUIHost';
import { spacing } from './tokens';

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
  /**
   * The sheet presents as a TITLED route (a real UIKit navigation bar carries
   * the title and the ✕ / ✓ live in `headerLeft` / `headerRight` — see
   * `SheetCommitGlyphIos`), so this component renders ONLY the `Form`. This is
   * the arrangement that gets genuine Liquid Glass: the bar is UIKit's, so
   * scrolling content dissolves under it and the glyph capsules refract for
   * real — the authored header below never can, because its glass sits over a
   * static sheet with nothing ever passing behind it.
   */
  titledBar?: boolean;
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

export function SheetFormIos({
  title,
  actionLabel,
  actionEnabled = true,
  busy = false,
  onAction,
  cancelLabel,
  onCancel,
  titledBar = false,
  children,
}: SheetFormProps) {
  const { colors } = useAppTheme();

  if (titledBar)
    return (
      <Host style={styles.formHost}>
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
  caption: string;
};

/** Centred media over its caption, as a borderless form row. */
export function SheetFormMediaIos({ children, caption }: SheetFormMediaProps) {
  const { colors } = useAppTheme();

  return (
    <VStack spacing={spacing.sm}>
      {/* RNHostView takes no style and `matchContents` is boolean-only, so
          the RN child must carry its own size AND centre itself in a
          full-width wrapper — the slot is as big as what you hand it. */}
      <RNHostView matchContents>{children}</RNHostView>
      <SwiftUIText
        modifiers={[
          font({ textStyle: 'footnote' }),
          foregroundStyle(colors.onSurfaceMuted),
        ]}
      >
        {caption}
      </SwiftUIText>
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
    // only the vertical axis (what `SheetDestructiveButtonIos` does, because a
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
        modifiers={[
          buttonStyle(
            variant === 'prominent' ? 'borderedProminent' : 'bordered',
          ),
          controlSize(size),
          tint(colors.primary),
          ...(disabled ? [disabledModifier(true)] : []),
        ]}
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
