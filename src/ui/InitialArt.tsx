import {
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/core';

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
/**
 * THE LETTER'S SIZE, as a ratio of the box — the same 0.42 the avatars use, so
 * an item's initial and a person's initial are the same mark at every size.
 *
 * EXPORTED because one surface cannot use this component and still has to
 * obey it: `TopItemListIos` draws the identical placeholder in SwiftUI (a
 * native row may bridge only one `RNHostView`, and that budget is spent on the
 * artwork). It took `title3` and a muted ink and `surfaceVariant` before this
 * was shared — the same box, three values different from every other one in
 * the app.
 */
export const EMPTY_MEDIA_INITIAL_RATIO = 0.42;
const INITIAL_RATIO = EMPTY_MEDIA_INITIAL_RATIO;

/**
 * WHERE AN EMPTY-MEDIA BOX SITS. The material has to step with its container,
 * so the container is what callers state.
 */
export type MediaContainer = 'page' | 'sheet';

/**
 * THE EMPTY-MEDIA MATERIAL — one term, for every art-less box in the portfolio:
 * an item's initial, a person's disc, a song's placeholder.
 *
 * ONE MATERIAL was the owner's call (2026-08-08) and it still is: on iOS every
 * art-less box takes `surfaceContainer`, the same solid systemGray5 the create
 * tiles use, so a person and an item and a create affordance read as one thing.
 * Two measured rejections stand behind it — `surfaceVariant` was too dark
 * beside the item boxes, and the translucent `fill` composited to #1D1D1F
 * against a #1C1C1E card, so a rail of art-less tiles read as a wall of cards.
 *
 * IT STEPS ON A SHEET, AND ONLY IN DARK. Inside a form sheet every grouped
 * colour moves up one: a row's fill goes from `card` (#1C1C1E) to `sheetField`
 * (#2C2C2E), which is EXACTLY `surfaceContainer` — so an unstepped box lands on
 * its own row and there is no box at all. Measured on iPhone 17 / iOS 26.5.
 * Light has no elevated split (`card` and `sheetField` are both #FFFFFF), so
 * stepping there would only darken the box away from what the tab renders.
 *
 * THIS FUNCTION EXISTS BECAUSE THE RULE WAS APPLIED IN ONE PLACE AND NOT THE
 * OTHER. `Avatar` carried the step inline while `InitialArt` did not, so a
 * person's disc was visible on a sheet row and an item's initial was invisible
 * beside it — caught in Recently Deleted (Juan, 2026-08-19). Two sibling
 * placeholders, one rule, one implementation.
 */
export const emptyMediaColor = ({
  colors,
  container = 'page',
  scheme,
}: {
  colors: { surfaceContainer: string; surfaceVariant: string };
  container?: MediaContainer;
  scheme: 'light' | 'dark';
}): string =>
  Platform.select({
    ios:
      container === 'sheet' && scheme === 'dark'
        ? colors.surfaceVariant
        : colors.surfaceContainer,
    // Android takes its M3 role and has no sheet-elevated split to make.
    default: colors.surfaceVariant,
  }) as string;

type InitialArtProps = {
  /** Defaults to the platform's EMPTY-MEDIA material — on iOS
   *  `surfaceContainer` (the systemGray5 pair), the same material the create
   *  tiles use, so every art-less box and every create affordance read as one
   *  thing; on Android `surfaceVariant`.
   *
   *  SOLID on purpose, not the translucent `fill` this briefly was: over a
   *  dark page background the fill composites to #1D1D1F, one hex step from
   *  the card surface (#1C1C1E) — a rail of art-less tiles read as a wall of
   *  CARDS. systemGray5 separates from both the background and the cards in
   *  both modes (#E5E5EA vs white / #2C2C2E vs #1C1C1E, measured). */
  backgroundColor?: string;
  /**
   * WHERE THE BOX SITS, so the material can step with its container — see
   * `emptyMediaColor`. A box on a form-sheet ROW must say `sheet` or it lands
   * on its own row fill in dark.
   */
  container?: MediaContainer;
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
  container,
  size,
  style,
  title,
}: InitialArtProps) {
  const { colors, scheme } = useAppTheme();

  // "?" only for the genuinely nameless — a title is required everywhere this
  // renders, so in practice this is always a real letter.
  const initial = title?.trim()?.[0]?.toUpperCase() ?? '?';

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor:
            backgroundColor ?? emptyMediaColor({ colors, container, scheme }),
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
