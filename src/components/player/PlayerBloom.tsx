import { StyleSheet, View } from 'react-native';

import { Image } from 'expo-image';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  RadialGradient as SvgRadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { useAppTheme } from '@/hooks/useAppTheme';
import { thumbUrl } from '@/services/cloudinary/thumbUrl';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE AUDIO-REACTIVE LIGHT — two candidates, switched from the dev lab.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * DEV-ONLY FOR NOW. Juan asked for a background that answers to the music —
 * his reference is the light strip behind a television — and the first attempt
 * modulated the full-bleed wash itself. That failed twice in one sitting, and
 * the pair of failures is the reason this file exists rather than a third
 * guess:
 *
 *   - SCALE ALONE WAS INVISIBLE. `PlayerBackdrop`'s source is blurred at 60pt
 *     and overscanned by 320; blur destroys exactly the spatial detail scale
 *     moves, so a 12% swell changed nothing the eye could catch.
 *   - OPACITY WAS WORSE — "too messy, unclean, unelegant". Measured at 6.23
 *     /255 of movement in the side gutter, which is small, and still wrong,
 *     BECAUSE OF WHERE IT WAS: the wash is the ground the title, transport and
 *     cards are read against, and a moving ground reads as instability rather
 *     than atmosphere. There is no amplitude at which that is elegant.
 *
 * So the rule both variants below obey: **the console's ground never moves.**
 * The light is PERIPHERAL to the content, which is what the reference actually
 * describes — a backlight does not move the picture, it lights the wall.
 *
 * Neither has a TIME AXIS, which is the other hard constraint:
 * `rejected-experiments.md` bars a track-shaped surface from this player (the
 * waveform strip died beside the scrubber — "two diff progress slider, is
 * like, out of place"). A glow has no left and no right.
 *
 * COLOUR COMES FROM THE COVER, never from a palette we invent — same argument
 * `PlayerBackdrop` makes for its wash. Both variants light themselves with a
 * blurred copy of the artwork, so the hue is right by construction and there is
 * no dominant-colour extraction to drift.
 */

export type BloomVariant = 'artwork' | 'edges';

/** The blurred copy both variants light themselves with — see `PlayerBackdrop`. */
const BLOOM_SOURCE_WIDTH = 320;
const BLOOM_BLUR = 40;

/**
 * HOW FAR THE HALO REACHES PAST THE COVER. Big enough to read as light
 * escaping, small enough that it never reaches the title below.
 */
const ARTWORK_HALO_SPREAD = 1.18;
const ARTWORK_HALO_SWELL = 0.1;
/** Peak opacity at full level. The halo is light, not a second artwork. */
const ARTWORK_HALO_MAX_OPACITY = 0.9;

/**
 * The edge variant's inverse vignette: the page colour is OPAQUE through the
 * middle and clears toward the corners, so the cover's colour survives only at
 * the screen's rim. Drawn OVER the blurred copy rather than masking it,
 * because a `<Mask>` would cost a second render pass for the same result.
 *
 * `0.52` is where the page starts letting go — inside that radius the console
 * sits on exactly the ground it always had, which is the whole point.
 */
const EDGE_CLEAR_START = 0.52;

/**
 * THE RANGE IS NARROW AND IT DOES NOT START AT ZERO, and both halves of that
 * were learned on device.
 *
 * It ran 0 → 0.85 first and Juan's read was that it FLASHED — "really
 * unpleasant". Most of that was the envelope (an instant attack; see
 * `useAudioLevel`), but the range was the other half: a light that travels its
 * whole span on every phrase is a strobe however smoothly it gets there.
 *
 * The FLOOR matters as much as the ceiling. Starting at 0 means the light
 * switches off between phrases, and an edge that appears and disappears is a
 * far louder event than one that merely brightens. At 0.08 there is always a
 * rim there, and the music only changes how much.
 */
const EDGE_MIN_OPACITY = 0.08;
const EDGE_MAX_OPACITY = 0.5;

/**
 * A NOTE ON WHY THE CEILING IS NOT LOWER, since "make it weaker" was the ask.
 * The flashing was the ENVELOPE, not the range — an instant attack over a peak
 * detector. With both fixed (`useAudioLevel`), the range is free to be
 * generous again: measured max frame-to-frame movement fell from a strobe to
 * 0.68/255 at a 0.22 span, so the smoothness does not depend on keeping it
 * small. At 0.3 the light was invisible on a DARK cover, which most of this
 * library is — the strength of a backlight is the media's own luminance, and
 * that is not something a single constant can normalise away.
 */

type PlayerBloomProps = {
  artUrl?: string;
  level: SharedValue<number>;
  variant: BloomVariant;
  /**
   * The expanded cover's box — the `artwork` variant glues itself to it. No
   * radius: the halo is a blurred square behind an opaque rounded cover, so
   * only its fringe is ever seen and a corner it never shows would be a prop
   * accepted and ignored.
   */
  art: { x: number; y: number; size: number };
};

export function PlayerBloom({ artUrl, level, variant, art }: PlayerBloomProps) {
  const { colors } = useAppTheme();

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      level.value,
      [0, 1],
      [0, ARTWORK_HALO_MAX_OPACITY],
      'clamp',
    ),
    transform: [
      {
        scale: interpolate(
          level.value,
          [0, 1],
          [1, 1 + ARTWORK_HALO_SWELL],
          'clamp',
        ),
      },
    ],
  }));

  const edgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      level.value,
      [0, 1],
      [EDGE_MIN_OPACITY, EDGE_MAX_OPACITY],
      'clamp',
    ),
  }));

  if (!artUrl) return null;

  const source = { uri: thumbUrl(artUrl, BLOOM_SOURCE_WIDTH) };

  if (variant === 'artwork') {
    /**
     * A blurred copy of the cover, larger than the cover and centred on it.
     * The real artwork is drawn OPAQUE on top, so only the fringe is ever
     * visible — light escaping from behind the panel rather than a second
     * picture.
     */
    const spread = art.size * ARTWORK_HALO_SPREAD;
    const inset = (spread - art.size) / 2;

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.absolute,
          {
            height: spread,
            left: art.x - inset,
            top: art.y - inset,
            width: spread,
          },
          haloStyle,
        ]}
      >
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={BLOOM_BLUR}
          cachePolicy="memory-disk"
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, edgeStyle]}
    >
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={BLOOM_BLUR}
          cachePolicy="memory-disk"
        />
        {/* The page colour, opaque through the middle, clearing to the rim. */}
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgRadialGradient id="playerBloomEdges" cx="0.5" cy="0.5" r="0.75">
              <Stop offset="0" stopColor={colors.background} stopOpacity="1" />
              <Stop
                offset={String(EDGE_CLEAR_START)}
                stopColor={colors.background}
                stopOpacity="1"
              />
              <Stop offset="1" stopColor={colors.background} stopOpacity="0" />
            </SvgRadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#playerBloomEdges)" />
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  absolute: { overflow: 'hidden', position: 'absolute' },
});
