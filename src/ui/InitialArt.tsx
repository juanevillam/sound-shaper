import {
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@portfolio/core';

/**
 * Stand-in artwork for something that has none: the title's first character,
 * set in a neutral rounded box.
 *
 * The same idea the avatars already use for a person without a photo, applied
 * to the other two things in the portfolio that can arrive without an image —
 * a Topper item and a Sound Shaper song. It replaces the single fixed emoji
 * each app used to draw (a ⭐ and a 🎵): one glyph repeated down a list says
 * nothing and reads as an error state, while the initial differs per row, so a
 * list of art-less things stays scannable and still looks deliberate.
 *
 * SHARED because both apps need exactly this, and the emoji versions were
 * already two near-identical components that had drifted onto different
 * background roles. Sizing comes from `size` (the box's side) rather than a
 * font size, so the letter keeps ONE ratio to its box everywhere — the same
 * 0.42 the avatars use.
 */
const INITIAL_RATIO = 0.42;

type InitialArtProps = {
  /** Defaults to the platform's EMPTY-MEDIA material — on iOS
   *  `surfaceContainer` (the systemGray5 pair), the same material the create
   *  tiles use, so every art-less box and every create affordance read as one
   *  thing; on Android the frozen `surfaceVariant`.
   *
   *  SOLID on purpose, not the translucent `fill` this briefly was: over a
   *  dark page background the fill composites to #1D1D1F, one hex step from
   *  the card surface (#1C1C1E) — a rail of art-less tiles read as a wall of
   *  CARDS. systemGray5 separates from both the background and the cards in
   *  both modes (#E5E5EA vs white / #2C2C2E vs #1C1C1E, measured). */
  backgroundColor?: string;
  /** Side of the box in dp. The letter scales from this, so it must be the
   *  real rendered size, not a font size. */
  size: number;
  /** Box style — the caller owns size and corners; this fills it. */
  style?: StyleProp<ViewStyle>;
  /** What the art stands for. Its first character is drawn. */
  title?: string | null;
};

export function InitialArt({
  backgroundColor,
  size,
  style,
  title,
}: InitialArtProps) {
  const { colors } = useAppTheme();

  // "?" only for the genuinely nameless — a title is required everywhere this
  // renders, so in practice this is always a real letter.
  const initial = title?.trim()?.[0]?.toUpperCase() ?? '?';

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor:
            backgroundColor ??
            Platform.select({
              ios: colors.surfaceContainer,
              default: colors.surfaceVariant,
            }),
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.initial,
          {
            color: colors.onSurface,
            fontSize: Math.round(size * INITIAL_RATIO),
          },
        ]}
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { fontWeight: '600' },
});
