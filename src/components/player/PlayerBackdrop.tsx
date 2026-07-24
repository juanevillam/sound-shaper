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
            {/* Never reaches full opacity: a stop that hits 1 kills the wash
                outright, which reads as the artwork ending in a hard gap
                partway down the screen. It only dims enough to keep the
                controls legible, so the tint runs edge to edge. */}
            <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
            <Stop
              offset="0.45"
              stopColor={colors.background}
              stopOpacity="0.28"
            />
            <Stop
              offset="0.75"
              stopColor={colors.background}
              stopOpacity="0.48"
            />
            <Stop offset="1" stopColor={colors.background} stopOpacity="0.6" />
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
