import {
  Text as RNText,
  StyleSheet,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { useAppTheme, type Translator } from '@portfolio/core';

export type TextVariant =
  | 'displayLarge'
  | 'headlineLarge'
  | 'titleLarge'
  | 'titleMedium'
  | 'bodyLarge'
  | 'bodyMedium'
  | 'bodySmall'
  | 'labelLarge'
  | 'labelMedium';

const VARIANT_STYLES: Record<TextVariant, TextStyle> = {
  displayLarge: {
    fontSize: 36,
    lineHeight: 44,
  },
  headlineLarge: {
    fontSize: 28,
    lineHeight: 36,
  },
  titleLarge: {
    fontSize: 22,
    lineHeight: 28,
  },
  titleMedium: {
    fontSize: 16,
    lineHeight: 22,
  },
  bodyLarge: { fontSize: 16, lineHeight: 22 },
  bodyMedium: { fontSize: 14, lineHeight: 20 },
  bodySmall: { fontSize: 12, lineHeight: 16 },
  labelLarge: { fontSize: 14, lineHeight: 18 },
  labelMedium: {
    fontSize: 12,
    lineHeight: 16,
  },
};

type BaseTextProps = {
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  muted?: boolean;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  variant?: TextVariant;
};

// Discriminated on `doNotTranslate`: the default (translating) variant only
// accepts REAL translation keys, so a typo'd key is a compile error instead
// of a runtime `[missing ...]` render (a real shipped bug — see the Text
// i18n idiom notes). Dynamic/literal strings must opt out explicitly. Apps
// whose key type is plain `string` (no `TranslationKey` union yet) keep their
// lax typing — both arms collapse to `text: string`.
export type TextProps<K extends string> = BaseTextProps &
  (
    | { doNotTranslate?: false; text: K }
    | { doNotTranslate: true; text: string }
  );

/**
 * Builds the app's auto-translating `Text`. The app injects its `useI18n`
 * hook; the key type `K` is inferred from the hook's translator, so an app
 * with a `TranslationKey` union gets compile-time key checking for free.
 */
export function createText<K extends string>(
  useTranslator: () => { t: Translator<K> },
) {
  return function Text({
    doNotTranslate = false,
    ellipsizeMode,
    muted = false,
    numberOfLines,
    style,
    text,
    variant = 'bodyMedium',
  }: TextProps<K>) {
    const { t } = useTranslator();
    const { colors } = useAppTheme();

    return (
      <RNText
        ellipsizeMode={ellipsizeMode}
        numberOfLines={numberOfLines}
        style={StyleSheet.flatten([
          VARIANT_STYLES[variant],
          { color: muted ? colors.onSurfaceMuted : colors.onSurface },
          style,
        ])}
      >
        {/* Destructuring loses the discriminant, hence the cast. */}
        {doNotTranslate ? text : t(text as K)}
      </RNText>
    );
  };
}
