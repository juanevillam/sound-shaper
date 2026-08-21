import { StyleSheet, View } from 'react-native';

import { Image } from 'expo-image';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { useAppTheme } from '@/hooks/useAppTheme';
import { thumbUrl } from '@/services/cloudinary/thumbUrl';

// The immersive top of the expanded player: the sound's own artwork, blown up
// and blurred behind everything, fading into the sheet's background so the
// console below stays legible. Same trick the artwork slots already use for
// their letterbox backdrop (a blurred copy of the image is a color-matched
// wash that needs no dominant-color extraction) — here it runs full-bleed, the
// way YT Music tints its player.
//
// The fade is a real SVG gradient rather than stacked translucent views, which
// would band badly on a dark surface. react-native-svg is already a dependency,
// so this costs no native module. The gradient dims but never fully hides the
// artwork — the wash has to reach both screen edges or it reads as a gap.

// Rather than reasoning about which box is inset by what, the wash simply
// overscans the sheet in every direction — there is nothing to leave a gap at
// either edge, whatever the insets do.
const OVERSCAN = 320;

const BACKDROP_BLUR = 60;

/**
 * THE SOURCE IS FETCHED SMALL, because a 60pt blur makes its resolution
 * irrelevant — and paying for resolution you then destroy is pure cost.
 *
 * This was the raw `artUrl`: a Cloudinary cover is commonly 1500–3000px, and it
 * was being decoded at that size and blurred across a 402 × 1514pt overscanned
 * box, every frame the layer composites — which includes the whole expand,
 * since the wash fades in over it. `ArtImage` already solved exactly this for
 * its own letterbox blur (`BACKDROP_SOURCE_WIDTH` there is 64); the full-screen
 * wash simply never adopted it, which is the same term-added-after-the-surface
 * miss this player kept producing.
 *
 * 320 rather than that 64: this one is stretched across the whole screen, not a
 * tile, so it needs enough gradient structure to land on the same tone.
 * `thumbUrl` doubles it for density, so the fetch is w_640.
 *
 * MEASURED against the full-size source on one unchanged frame (the cover
 * itself byte-identical, so only the wash could differ): at w_320 the wash
 * shifted 16.67/255 above the cover and 13.74 in the side gutter — small, but
 * visible as a flatter tone. At w_640 that falls to 10.94 and 2.59, i.e. the
 * gutter is within 1%. Still a 5–20x reduction in pixels to decode and blur,
 * since a stored cover is commonly 1500–3000px.
 */
const BACKDROP_SOURCE_WIDTH = 320;
// Long enough to read as the wash CHANGING rather than being replaced — the
// whole screen is tinted by it, so a hard cut is the most violent thing in the
// player. Also covers the gap between a skip's page animation and the store
// swap that brings the new art here.
const BACKDROP_FADE_MS = 420;
/**
 * ONE STEP UP FROM 0.62, NOT ALL THE WAY — and the ceiling is a readability
 * fact rather than taste.
 *
 * The blurred art is mixed this much into the page colour, so light mode drifts
 * toward white and dark toward black. That mix is also what keeps the bar
 * glyphs legible: a dark cover can never pull the top band very dark. 0.62 sat
 * almost exactly ON the limit — for a black cover in light mode it left
 * 0.38 × 242 ≈ 92, and a black glyph needs ~89 to clear 3:1. So the old value
 * was not merely "subtle", it was the most the wash could be with nothing else
 * protecting the glyphs.
 *
 * Full strength was built and rejected on sight — the colour swamped the
 * screen. 0.75 reads as a stronger tint while the short bar-row scrim below
 * covers the difference.
 */
const BACKDROP_OPACITY = 0.75;

type PlayerBackdropProps = {
  artUrl?: string;
};

/**
 * Warm the wash's own Cloudinary variant into expo-image's disk cache.
 *
 * FETCH EARLY, RENDER LATE — the two halves of "don't pay for the player from
 * the banner" pull in opposite directions on their own, and this is what lets
 * both be true. The layer itself is not mounted until the player is actually
 * on screen (see `playerMounted`), which means the first frame of an expand
 * would otherwise be a cold network fetch behind a 60pt blur. Prefetching on
 * the SOUND CHANGE instead moves that cost to a moment with nothing animating,
 * and costs one small image per sound played — the wash is fetched at w_640,
 * not at the cover's stored 1500–3000px.
 *
 * It is deliberately the same call `<Image>` will make: `thumbUrl` is
 * deterministic, so the prefetched URL IS the cache key the layer then hits.
 */
export const prefetchPlayerBackdrop = (artUrl?: string): void => {
  if (!artUrl) return;
  // Fire-and-forget: a failed warm-up just means the layer fetches normally.
  Image.prefetch(thumbUrl(artUrl, BACKDROP_SOURCE_WIDTH), 'memory-disk').catch(
    () => {},
  );
};

export function PlayerBackdrop({ artUrl }: PlayerBackdropProps) {
  const { colors } = useAppTheme();

  if (!artUrl) return null;

  return (
    <View style={styles.bleed} pointerEvents="none">
      <Image
        source={{ uri: thumbUrl(artUrl, BACKDROP_SOURCE_WIDTH) }}
        style={[StyleSheet.absoluteFill, { opacity: BACKDROP_OPACITY }]}
        contentFit="cover"
        blurRadius={BACKDROP_BLUR}
        // NO recyclingKey: this is one long-lived view, not a recycled row, and
        // a changing recyclingKey CLEARS the old image instead of letting
        // expo-image cross-dissolve into the new one — which is exactly what
        // made the wash snap from one sound's colour to the next.
        transition={BACKDROP_FADE_MS}
        cachePolicy="memory-disk"
      />
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient
            id="playerBackdropFade"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            {/* Lightest at the top behind the artwork, solid by the time it
                reaches the transport and the cards. */}
            {/* Darkens CONTINUOUSLY toward the controls: artwork colours vary
                wildly between sounds, and the cards below need a predictable
                surface to sit on. It never plateaus — a flat run of full
                opacity is what read as a hard gap before — so the wash still
                reaches the bottom edge, just heavily dimmed by the time it
                gets under the Shape and Clips cards. */}
            {/* The wash lives in the top third, around the artwork. Below it
                the fall-off is deliberately steep so the title, transport and
                especially the Shape / Clips cards sit on a settled surface
                whatever colour the cover is — while the bottom still keeps a
                trace of tint rather than cutting to flat black. */}
            {/* THE BAR BAND IS PROTECTED, AND ONLY THE BAR BAND.
                These offsets are in the OVERSCANNED box, not the screen: the
                bleed runs `OVERSCAN` past both edges, so screen y maps to
                `(OVERSCAN + y) / (OVERSCAN * 2 + screenH)` — 0.211 is the top
                of the screen and 0.29 is just under the bar row.

                Across that 105pt the wash fades toward the PAGE colour, which
                is what makes the glyphs safe by construction rather than by
                luck: in light mode it lifts a black cover, in dark it darkens a
                white one, and either way it pulls the ground away from
                `onSurface`. Worst case measured below. It reads as the wash
                emerging from under the status bar, which is the same scrim
                Apple lays over photography beneath a bar. */}
            <Stop offset="0" stopColor={colors.background} stopOpacity="0.24" />
            {/* HELD FLAT ACROSS THE WHOLE BAR ROW (screen y 62–105, i.e. up to
                offset 0.281) and only then released. A ramp that starts
                decaying at the screen's top edge has already lost two thirds of
                itself by the glyphs' own centre — measured at 1.34:1 before
                this was corrected. */}
            <Stop
              offset="0.281"
              stopColor={colors.background}
              stopOpacity="0.24"
            />
            {/* Clear by y ≈ 170. It costs the wash almost nothing to hold on
                this long: the cover is an OPAQUE layer drawn above this one and
                starts at y 119, so between the bar and there the wash is only
                visible in the two 16pt side gutters. */}
            <Stop
              offset="0.323"
              stopColor={colors.background}
              stopOpacity="0.03"
            />
            <Stop
              offset="0.44"
              stopColor={colors.background}
              stopOpacity="0.3"
            />
            {/* From here down it falls off HARDER than it used to, not softer.
                The console needs a predictable surface whatever the cover is —
                the title, the scrubber's labels and the footer all read against
                this — so the colour is spent where it shows and withdrawn where
                it would cost legibility. */}
            <Stop
              offset="0.58"
              stopColor={colors.background}
              stopOpacity="0.68"
            />
            <Stop
              offset="0.72"
              stopColor={colors.background}
              stopOpacity="0.84"
            />
            <Stop offset="1" stopColor={colors.background} stopOpacity="0.9" />
          </SvgLinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#playerBackdropFade)"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  bleed: {
    bottom: -OVERSCAN,
    left: 0,
    position: 'absolute',
    right: 0,
    top: -OVERSCAN,
  },
});
