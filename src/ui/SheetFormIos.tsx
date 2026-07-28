import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@portfolio/core';

import { TEXT_VARIANTS } from './createText';
import { radius, spacing } from './tokens';

/**
 * Chrome for the iOS form-sheet routes, shared by every portfolio app: the
 * title + tinted-action header, the centred media block, the filled text
 * field, the section header, and the outlined destructive button.
 *
 * It lives in the package rather than per app because these are the SAME
 * surface — an app that re-authored one drifted from the others within a week
 * (mismatched delete buttons, two different media treatments). Labels arrive
 * already translated (the package has no app translator), and colors come
 * from the shared `useAppTheme`, so a call site passes only content.
 *
 * ## The type roles these establish
 *
 * Every iOS sheet uses exactly four, and nothing else:
 *
 * | role              | component / style          | colour   |
 * | ----------------- | -------------------------- | -------- |
 * | sheet title       | `SheetHeaderIos`           | onSurface|
 * | section header    | `SheetSectionHeaderIos`    | onSurface|
 * | row title         | `bodyLarge`                | onSurface|
 * | supporting/value  | `bodySmall` / `labelMedium`| muted    |
 *
 * Muted means "supporting", never "a heading in grey".
 *
 * ## The vertical rhythm these establish
 *
 * A sheet reads as sections only if the gap BETWEEN them clearly beats the gap
 * WITHIN them. Three numbers, and no sheet should invent a fourth:
 *
 * | gap                          | token                   | value |
 * | ---------------------------- | ----------------------- | ----- |
 * | section → section            | `SHEET_SECTION_GAP`     | 24    |
 * | header → the section's rows  | `SHEET_CONTENT_GAP`     | 8     |
 * | any title → its support line | `SHEET_SUPPORTING_GAP`  | 4     |
 *
 * The last one is why `SheetSectionHeaderIos` takes the supporting line as a
 * `subtitle` prop rather than leaving call sites to render it as one more
 * child: as a child it inherited the section's own gap and sat three times
 * further from its heading than the identical pair one row below.
 */

/** Between two sections of a sheet. */
export const SHEET_SECTION_GAP = spacing.xl;
/** Between a section's header and its controls. */
export const SHEET_CONTENT_GAP = spacing.sm;
/** Between any title — section header or row title — and its support line. */
export const SHEET_SUPPORTING_GAP = spacing.xs;

const PRESSED_OPACITY = 0.5;
const DISABLED_OPACITY = 0.35;
const SPINNER_SIZE = 20;
const HEADER_WEIGHT = '600';
const FIELD_FONT_SIZE = 16;
const FIELD_RADIUS = 10;
const FIELD_PADDING_X = 14;
const FIELD_PADDING_Y = 12;
const FIELD_MULTILINE_HEIGHT = 88;
const DESTRUCTIVE_PADDING_Y = 11;

type SheetHeaderProps = {
  title: string;
  actionLabel: string;
  /** Defaults to enabled — pass `false` while the form is invalid. */
  actionEnabled?: boolean;
  /** Swaps the action for a spinner while a real network wait is in flight. */
  busy?: boolean;
  onAction: () => void;
};

/** Title left, tinted action right — the sheet's action bar (grabber above). */
export function SheetHeaderIos({
  title,
  actionLabel,
  actionEnabled = true,
  busy = false,
  onAction,
}: SheetHeaderProps) {
  const { colors } = useAppTheme();
  const disabled = !actionEnabled || busy;

  return (
    <View style={styles.header}>
      <Text style={[TEXT_VARIANTS.titleLarge, { color: colors.onSurface }]}>
        {title}
      </Text>
      {busy ? (
        <ActivityIndicator size={SPINNER_SIZE} color={colors.onSurfaceMuted} />
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onAction}
          style={({ pressed }) => ({
            opacity: disabled
              ? DISABLED_OPACITY
              : pressed
                ? PRESSED_OPACITY
                : 1,
          })}
        >
          <Text
            style={[
              TEXT_VARIANTS.labelLarge,
              { color: colors.primary, fontWeight: HEADER_WEIGHT },
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

type SheetSectionHeaderProps = {
  title: string;
  /** Optional right-aligned current value ("0,9×") — supporting, so muted. */
  value?: string;
  /**
   * The line UNDER the heading that says what the section is for. Passed here
   * rather than rendered by the call site so it always sits at
   * `SHEET_SUPPORTING_GAP` from its title, like every other pair in the sheet.
   */
  subtitle?: string;
};

/**
 * A section's name inside a sheet. Deliberately NOT muted: muted is the
 * supporting-text role, and a heading painted in the supporting colour is the
 * single most common way these sheets start to read as accidental.
 */
export function SheetSectionHeaderIos({
  title,
  value,
  subtitle,
}: SheetSectionHeaderProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.sectionHeaderBlock}>
      <View style={styles.sectionHeader}>
        <Text
          style={[
            TEXT_VARIANTS.labelLarge,
            { color: colors.onSurface, fontWeight: HEADER_WEIGHT },
          ]}
        >
          {title}
        </Text>
        {value ? (
          <Text
            style={[
              TEXT_VARIANTS.labelMedium,
              { color: colors.onSurfaceMuted },
            ]}
          >
            {value}
          </Text>
        ) : null}
      </View>
      {subtitle ? (
        <Text
          style={[TEXT_VARIANTS.bodySmall, { color: colors.onSurfaceMuted }]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

type SheetMediaBlockProps = {
  /** The media itself — a picker avatar, a cover-art disc, an emoji slot. */
  children: React.ReactNode;
  /** Muted line under it: what the media is, or what tapping it does. */
  caption: string;
};

/** Centred media over its muted caption — the top block of every editor. */
export function SheetMediaBlockIos({
  children,
  caption,
}: SheetMediaBlockProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.mediaBlock}>
      {children}
      <Text
        style={[TEXT_VARIANTS.labelMedium, { color: colors.onSurfaceMuted }]}
      >
        {caption}
      </Text>
    </View>
  );
}

type SheetFieldProps = {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  error?: string | null;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  returnKeyType?: 'done' | 'next';
  editable?: boolean;
  onSubmitEditing?: () => void;
};

/** iOS filled input (grouped-background rounded rect), error line below. */
export function SheetFieldIos({
  value,
  onChangeText,
  placeholder,
  error,
  multiline = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  returnKeyType,
  editable = true,
  onSubmitEditing,
}: SheetFieldProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.fieldWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        returnKeyType={returnKeyType}
        editable={editable}
        onSubmitEditing={onSubmitEditing}
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          {
            backgroundColor: colors.sheetField,
            color: colors.onSurface,
            borderColor: error ? colors.danger : 'transparent',
          },
        ]}
      />
      {error ? (
        <Text style={[TEXT_VARIANTS.bodySmall, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

type SheetDestructiveButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Extra separation from the row above — destructive actions stand apart. */
  style?: StyleProp<ViewStyle>;
};

/**
 * The one destructive control for iOS sheets: a full-width outlined pill in
 * the danger colour, at the very bottom. Outlined rather than filled because
 * on iOS a filled row reads as a *field*, and the app's fields are exactly
 * that fill — a delete button must not look like somewhere to type.
 */
export function SheetDestructiveButtonIos({
  label,
  onPress,
  disabled = false,
  style,
}: SheetDestructiveButtonProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.destructive,
        { borderColor: colors.border },
        { opacity: pressed || disabled ? PRESSED_OPACITY : 1 },
        style,
      ]}
    >
      <Text style={[TEXT_VARIANTS.labelLarge, { color: colors.danger }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionHeaderBlock: { gap: SHEET_SUPPORTING_GAP },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mediaBlock: { alignItems: 'center', gap: spacing.sm },
  fieldWrap: { gap: spacing.xs },
  field: {
    borderCurve: 'continuous',
    borderRadius: FIELD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: FIELD_FONT_SIZE,
    paddingHorizontal: FIELD_PADDING_X,
    paddingVertical: FIELD_PADDING_Y,
  },
  fieldMultiline: {
    minHeight: FIELD_MULTILINE_HEIGHT,
    textAlignVertical: 'top',
  },
  destructive: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingVertical: DESTRUCTIVE_PADDING_Y,
  },
});
