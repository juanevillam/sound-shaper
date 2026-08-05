import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import {
  Button,
  Form,
  HStack,
  Host,
  ProgressView,
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
  font,
  foregroundStyle,
  keyboardType as keyboardTypeModifier,
  lineLimit,
  padding,
  scrollContentBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useAppTheme } from '@portfolio/core';

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
  /** `Section`s — the form's rows. */
  children: React.ReactNode;
};

/**
 * The whole iOS editor sheet: title + action over a grouped `Form`.
 *
 * The header is a SwiftUI `HStack` in the SAME host as the form rather than an
 * RN bar above it, so the two can't drift apart in font, tint or pressed
 * state. `scrollContentBackground('hidden')` drops the Form's own grouped
 * backdrop — the sheet already paints one, and stacking them read as a lighter
 * panel floating on the sheet.
 *
 * These sheets COMMIT — they collect an edit and apply it on Save — so they get
 * Apple's commit-modal pair: Cancel leading, the affirmative action trailing
 * (New Contact, New Event, Compose). That is the opposite of the Settings
 * sheet, whose rows apply as you tap them and which therefore takes a single
 * `xmark`. Before this, the only way out of an editor was the grabber or a
 * swipe-down: discoverable if you already know iOS, invisible if you don't, and
 * the Android twin has always had an explicit dismiss.
 */
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
        <HStack modifiers={[padding({ horizontal: 20, top: 18, bottom: 4 })]}>
          {cancelLabel && onCancel ? (
            <>
              {/* Plain (borderless) button, tinted like the trailing action —
                  Apple gives Cancel the accent too and distinguishes the two by
                  WEIGHT, not colour. */}
              <Button
                label={cancelLabel}
                onPress={onCancel}
                modifiers={[tint(colors.primary)]}
              />
              <Spacer />
            </>
          ) : null}
          <SwiftUIText
            modifiers={[
              font({ textStyle: 'title2', weight: 'bold' }),
              foregroundStyle(colors.onSurface),
            ]}
          >
            {title}
          </SwiftUIText>
          <Spacer />
          {busy ? (
            <ProgressView />
          ) : (
            <Button
              label={actionLabel}
              onPress={onAction}
              modifiers={[
                tint(colors.primary),
                ...(actionEnabled ? [] : [disabledModifier(true)]),
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
          controlSize('large'),
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
