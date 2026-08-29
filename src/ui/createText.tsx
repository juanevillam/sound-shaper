import {
  Platform,
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

// The variant NAMES are Material's, and so were the sizes — on both platforms.
// That meant every iOS screen was typeset in Android's voice: body text at 14pt
// where iOS's is 17, section headers at 16pt where iOS uses 20. Nothing was
// individually wrong and the whole thing read as not-quite-native, because a
// platform's type ramp is most of its handwriting.
//
// So the steps are per-platform. ANDROID KEEPS ITS EXACT NUMBERS — they are
// the M3 roles its screens were built against, and moving them would move every
// Android screen at once. iOS maps each step onto the matching Apple text style at
// the default (Large) Dynamic Type size, from the HIG's specification:
//
//   Large Title 34/41   Title 1 28/34   Title 2 22/28   Title 3 20/25
//   Body 17/22          Callout 16/21   Subheadline 15/20
//   Footnote 13/18      Caption 1 12/16
//
// These are still fixed points, not real Dynamic Type — `fontSize` does not
// track the user's text-size setting. Honouring that properly means mapping to
// SwiftUI's text styles, which also means auditing every fixed-height layout
// (the skeletons are dimension-matched on purpose, and the rail header height
// is a derived constant). Tracked as the next step, not smuggled in here.
// M3 SPECIFIES A WEIGHT PER ROLE, AND HALF OF THESE WERE SILENTLY DROPPING IT.
// The sizes were right and the weights were never written, so RN fell back to
// Roboto Regular for every role — including the four M3 sets in Medium (500).
// Measured on a Galaxy A54 (density 450, dark): the stem of `titleMedium`'s
// "B" and `bodyLarge`'s "B" were both 5px, i.e. a block's TITLE and the body
// text under it were rendering as the same face at the same size. There was no
// weight step anywhere on the Android side, while the iOS ladder below has
// carried its `'600'` on `titleMedium` all along.
//
// This is invisible to tsc, to lint and to a band-scan — the metrics do not
// change, only the face — which is why it survived until a stem was measured.
// The M3 roles that are Medium: `titleMedium`, `labelLarge`, `labelMedium`
// (and `titleSmall`, which this scale has no step for). Everything else on the
// display / headline / body ramps is Regular, and stays unset.
//
// `fontSize` and `lineHeight` are untouched, so no layout moves and the
// dimension-matched skeletons stay matched — this is a weight-only change.
const ANDROID_VARIANTS: Record<TextVariant, TextStyle> = {
  displayLarge: { fontSize: 36, lineHeight: 44 },
  headlineLarge: { fontSize: 28, lineHeight: 36 },
  titleLarge: { fontSize: 22, lineHeight: 28 },
  titleMedium: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  bodyLarge: { fontSize: 16, lineHeight: 22 },
  bodyMedium: { fontSize: 14, lineHeight: 20 },
  bodySmall: { fontSize: 12, lineHeight: 16 },
  labelLarge: { fontSize: 14, lineHeight: 18, fontWeight: '500' },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
};

const IOS_VARIANTS: Record<TextVariant, TextStyle> = {
  displayLarge: { fontSize: 34, lineHeight: 41 }, // Large Title
  headlineLarge: { fontSize: 28, lineHeight: 34 }, // Title 1
  titleLarge: { fontSize: 22, lineHeight: 28 }, // Title 2
  // Section headings above content, and card titles — one step serves both.
  // HEADLINE, not Title 3. Title 3 (20) is what Music and the App Store put
  // above a full-bleed editorial rail; at the size these sections actually
  // are, under a 34pt large title and over a card, it read as a second large
  // title rather than a heading. Headline is Apple's step for "the prominent
  // label of a thing" and it is the same 17 as body, carried by the weight
  // instead of the size — which is the part that was doing the work anyway.
  titleMedium: { fontSize: 17, lineHeight: 22, fontWeight: '600' }, // Headline
  bodyLarge: { fontSize: 17, lineHeight: 22 }, // Body
  bodyMedium: { fontSize: 15, lineHeight: 20 }, // Subheadline
  bodySmall: { fontSize: 13, lineHeight: 18 }, // Footnote
  // Tinted trailing actions ("See All") — a button label on iOS is Body, not a
  // small caps label.
  labelLarge: { fontSize: 17, lineHeight: 22 }, // Body
  labelMedium: { fontSize: 12, lineHeight: 16 }, // Caption 1
};

/**
 * The type scale itself. Exported so package-level components (which can't
 * call an app's `useI18n`, so can't use the app `Text`) still render on the
 * exact same steps as every app screen.
 */
export const TEXT_VARIANTS: Record<TextVariant, TextStyle> =
  Platform.OS === 'ios' ? IOS_VARIANTS : ANDROID_VARIANTS;

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
          TEXT_VARIANTS[variant],
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
