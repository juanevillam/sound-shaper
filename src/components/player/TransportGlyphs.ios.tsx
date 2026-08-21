import { StyleSheet, View } from 'react-native';

import { Image, type ImageProps } from '@expo/ui/swift-ui';
import { SwiftUIHost } from '@portfolio/mobile-ui';

import { type TransportGlyphProps } from './TransportGlyphs';

/**
 * iOS TRANSPORT GLYPHS — SF Symbols, which is what these always should have
 * been.
 *
 * They were hand-drawn out of plain views on BOTH platforms: a CSS-border
 * triangle for play, two rounded bars for pause, a triangle plus a bar for
 * skip. The justification in the code was "Compose Icons here would blink on
 * navigation returns" — an ANDROID failure, applied to iOS, which is exactly
 * the drift AGENTS.md's native-primitive rule describes. iOS was drawing by
 * hand a control the system already ships, and the portfolio ALREADY owns these
 * four as real symbols: `AppIcon.ios` maps `play-arrow`, `pause`, `skip-next`
 * and `skip-previous` to `play.fill`, `pause.fill`, `forward.end.fill` and
 * `backward.end.fill`.
 *
 * A hand-drawn triangle is not the same shape as `play.fill`, which carries
 * Apple's corner rounding and optical balance, and it cannot follow the system
 * as those symbols change.
 *
 * WHY A BARE `Image` AND NOT `AppIcon`. Same reason `BarIconButton.ios` gives:
 * `AppIcon` takes no size in the shape this needs, and these want an explicit
 * point size per surface. The symbol names are duplicated here rather than
 * imported because `AppIcon`'s map is keyed by Material names — going through
 * it would mean naming a Material icon to get an Apple one.
 *
 * THE HOST STATES ITS BOX, never `matchContents`. A host that measures its
 * child answers on the layout path, and these sit inside a row that Reanimated
 * transforms every frame of the expand — the one place an async answer is
 * guaranteed to show. See AGENTS.md.
 */

/** Default point size — matches the ink the drawn glyphs occupied (~14–16pt). */
const GLYPH_POINT_SIZE = 19;

/**
 * The box the host reserves, as a multiple of the POINT SIZE — never a fixed
 * number. It was a hard 24 while every call site rendered at 19, which held
 * exactly as long as that stayed true: the console's transport asks for a
 * play glyph at more than twice that, and a 44pt symbol in a 24pt box is
 * clipped on all four sides.
 *
 * The box has to clear the WIDEST of the four (`forward.end.fill`, whose bar
 * and triangle run wider than a symbol's nominal point size) with room for its
 * optical bearing. Measured against the four at 19 and at 44; 1.3 clears every
 * one without padding the row out.
 *
 * A ratio, not a step, because this is GEOMETRY inside its own box — the rule
 * that governs `artworkRadius` and `emptyMediaPlusStyle`. The point size it
 * multiplies is the thing that steps.
 */
const GLYPH_BOX_RATIO = 1.3;

const Glyph = ({
  color,
  size = GLYPH_POINT_SIZE,
  systemName,
}: TransportGlyphProps & {
  systemName: NonNullable<ImageProps['systemName']>;
}) => {
  const box = Math.round(size * GLYPH_BOX_RATIO);

  return (
    <View
      style={[styles.box, { height: box, width: box }]}
      pointerEvents="none"
    >
      <SwiftUIHost style={{ height: box, width: box }} ignoreSafeArea="all">
        <Image systemName={systemName} size={size} color={color} />
      </SwiftUIHost>
    </View>
  );
};

export const PlayGlyph = (props: TransportGlyphProps) => (
  <Glyph {...props} systemName="play.fill" />
);

export const PauseGlyph = (props: TransportGlyphProps) => (
  <Glyph {...props} systemName="pause.fill" />
);

export const NextGlyph = (props: TransportGlyphProps) => (
  <Glyph {...props} systemName="forward.end.fill" />
);

export const PreviousGlyph = (props: TransportGlyphProps) => (
  <Glyph {...props} systemName="backward.end.fill" />
);

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
