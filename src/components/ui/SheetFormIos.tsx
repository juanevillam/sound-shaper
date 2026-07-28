import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';

// Shared chrome for the iOS form-sheet routes (Topper's `SheetFormIos` idiom):
// the title + tinted-action header row and the iOS filled text field. Pure RN —
// these live inside native form-sheet routes, whose grabber and swipe-to-
// dismiss come from the system presentation, so there is no Cancel button.

const PRESSED_OPACITY = 0.5;
const DISABLED_OPACITY = 0.35;
const SPINNER_SIZE = 20;

type SheetHeaderProps = {
  title: string;
  actionLabel: string;
  actionEnabled?: boolean;
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
      <Text doNotTranslate text={title} variant="titleLarge" />
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
            doNotTranslate
            text={actionLabel}
            variant="labelLarge"
            style={{ color: colors.primary, fontWeight: '600' }}
          />
        </Pressable>
      )}
    </View>
  );
}

type SheetFieldProps = {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  error?: string | null;
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
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        returnKeyType={returnKeyType}
        editable={editable}
        onSubmitEditing={onSubmitEditing}
        style={[
          styles.field,
          {
            backgroundColor: colors.sheetField,
            color: colors.onSurface,
            borderColor: error ? colors.danger : 'transparent',
          },
        ]}
      />
      {error ? (
        <Text
          doNotTranslate
          text={error}
          variant="bodySmall"
          style={{ color: colors.danger }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fieldWrap: { gap: 4 },
  field: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
