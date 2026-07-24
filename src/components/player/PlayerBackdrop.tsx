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
// Strong enough to feel like the sound is tinting the screen, short of
// wallpaper.
const BACKDROP_OPACITY = 0.62;

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
        transition={220}
        recyclingKey={artUrl}
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
            <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
            <Stop
              offset="0.2"
              stopColor={colors.background}
              stopOpacity="0.1"
            />
            <Stop
              offset="0.36"
              stopColor={colors.background}
              stopOpacity="0.34"
            />
            <Stop
              offset="0.5"
              stopColor={colors.background}
              stopOpacity="0.68"
            />
            <Stop
              offset="0.66"
              stopColor={colors.background}
              stopOpacity="0.82"
            />
            <Stop offset="1" stopColor={colors.background} stopOpacity="0.86" />
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
