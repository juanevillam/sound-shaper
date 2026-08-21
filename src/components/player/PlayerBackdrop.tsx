import { StyleSheet, View } from 'react-native';

import { Image } from 'expo-image';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { useAppTheme } from '@/hooks/useAppTheme';

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

export function PlayerBackdrop({ artUrl }: PlayerBackdropProps) {
  const { colors } = useAppTheme();

  if (!artUrl) return null;

  return (
    <View style={styles.bleed} pointerEvents="none">
      <Image
        source={{ uri: artUrl }}
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
