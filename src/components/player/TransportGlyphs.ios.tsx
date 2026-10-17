import { StyleSheet, View } from 'react-native';

import { Image, type ImageProps } from '@expo/ui/swift-ui';

import { SwiftUIHost } from '@/ui';

import { TRANSPORT_GLYPH_BOX_RATIO } from './chrome';
import { type TransportGlyphProps } from './TransportGlyphs';

/**
 * iOS TRANSPORT GLYPHS — SF Symbols, which is what these always should have
 * been.
 *
 * They were hand-drawn out of plain views on BOTH platforms: a CSS-border
 * triangle for play, two rounded bars for pause, a triangle plus a bar for
 * skip. The justification in the code was "Compose Icons here would blink on
 * navigation returns" — an ANDROID failure, applied to iOS, which is exactly
 * the drift `docs/standards.md`'s native-primitive rule describes. iOS was
 * drawing by hand a control the system already ships, and the app ALREADY owns
 * these four as real symbols: `AppIcon.ios` maps `play-arrow` and `pause` to
 * `play.fill` and `pause.fill`. (Its `skip-next` / `skip-previous` entries
 * point at the BAR symbols, which is right for those Material names and
 * wrong for a music transport — see the skip pair below.)
 *
 * A hand-drawn triangle is not the same shape as `play.fill`, which carries
 * Apple's corner rounding and optical balance, and it cannot follow the system
 * as those symbols change.
 *
 * WHY A BARE `Image` AND NOT `AppIcon`: `AppIcon` takes no size in the shape
 * this needs, and these want an explicit point size per surface. (This used to
 * cite `BarIconButton.ios` for the same reason — that component is gone, so
 * the reason is stated here rather than pointed at.) The symbol names are duplicated here rather than
 * imported because `AppIcon`'s map is keyed by Material names — going through
 * it would mean naming a Material icon to get an Apple one.
 *
 * THE HOST STATES ITS BOX, never `matchContents`. A host that measures its
 * child answers on the layout path, and these sit inside a row that Reanimated
 * transforms every frame of the expand — the one place an async answer is
 * guaranteed to show. See `docs/standards.md`.
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
 * The box has to clear the WIDEST of the four with room for its optical
 * bearing. That is now the SKIP pair: a double triangle is far wider than the
 * bar-and-triangle it replaced, band-scanned at 25.33 × 14.33pt for a 19pt
 * `forward.fill` — a ratio of 1.333 in ink alone, where the old symbols fit
 * inside 1.3 with bearing to spare. 1.45 restores it — 28pt at 19, and 49 at
 * the console's 34, where the ink band-scans at 45.00 and so keeps ~2pt of
 * bearing each side. Nothing clipped at either value: neither the RN box nor
 * the SwiftUI host clips by default, so the old ratio was quietly letting the
 * ink overhang its own reservation rather than cutting it.
 *
 * A ratio, not a step, because this is GEOMETRY inside its own box — the rule
 * that governs `artworkRadius` and `emptyMediaPlusStyle`. The point size it
 * multiplies is the thing that steps.
 */
const GLYPH_BOX_RATIO = TRANSPORT_GLYPH_BOX_RATIO;

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

/**
 * THE SKIP PAIR IS APPLE'S MUSIC TRANSPORT, NOT SF SYMBOLS' LITERAL NAME.
 *
 * `forward.end.fill` / `backward.end.fill` — a triangle set against a bar —
 * say "go to the end", and they are what a Material `skip_next` translates
 * to, which is why `AppIcon`'s map still points a Material NAME at them.
 * Apple does not draw them in a music transport: Music, and the system Now
 * Playing surface this app publishes to, both use the DOUBLE TRIANGLE.
 *
 * Juan caught it by putting the two side by side (2026-08-26) — the Lock
 * Screen player's buttons and this app's own transport, one sound, two
 * different glyphs for the same action. The system surface is not ours to
 * restyle, so the app moves to match it.
 */
export const NextGlyph = (props: TransportGlyphProps) => (
  <Glyph {...props} systemName="forward.fill" />
);

export const PreviousGlyph = (props: TransportGlyphProps) => (
  <Glyph {...props} systemName="backward.fill" />
);

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
