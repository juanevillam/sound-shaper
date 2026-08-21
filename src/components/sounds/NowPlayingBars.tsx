import { useEffect } from 'react';

import { StyleSheet, View } from 'react-native';

import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// The "this one is playing" mark for a sound tile: hairline equalizer bars
// breathing inside a translucent disc on the artwork. Deliberately understated
// — a filled, brand-colored badge reads like a sticker slapped on the cover,
// so this is a soft scrim with white hairlines instead, and the motion is slow
// and shallow rather than bouncy. Paused settles the bars level, so the mark
// doubles as a play/pause state.

const BAR_COUNT = 3;
const BAR_WIDTH = 2;
const BAR_HEIGHT = 11;
const BAR_GAP = 3;
const DISC_SIZE = 26;
// Prime-ish and staggered so the bars never march in lockstep. These are the
// 1x durations; the real ones divide by the playback rate, so the bars visibly
// speed up at 2x and drag at 0.5x — the mark keeps time with the music.
const BAR_DURATIONS = [560, 700, 620];
const BAR_DELAYS = [0, 160, 320];
// A shallow range: the bars breathe rather than jump.
const REST_SCALE = 0.42;
const PAUSED_SCALE = 0.55;

type BarProps = {
  delay: number;
  duration: number;
  playing: boolean;
  still: boolean;
};

function Bar({ delay, duration, playing, still }: BarProps) {
  const scale = useSharedValue(REST_SCALE);

  useEffect(() => {
    if (still) {
      scale.value = PAUSED_SCALE;
      return;
    }

    if (playing) {
      // A reversing withRepeat oscillates between the value it STARTS from and
      // 1. Changing the rate re-runs this effect mid-breath, so restarting
      // from wherever the bar happens to be shrinks the range — and once it
      // collapses near 1 the bars look frozen and never recover. Always
      // restart from the low end so the full range is guaranteed.
      cancelAnimation(scale);
      scale.value = REST_SCALE;
      scale.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        ),
      );
      return;
    }

    cancelAnimation(scale);
    scale.value = withTiming(PAUSED_SCALE, { duration: 260 });
  }, [playing, still, delay, duration, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));

  return <Animated.View style={[styles.bar, style]} />;
}

type NowPlayingBarsProps = {
  playing: boolean;
  /** Playback speed — the bars beat in time with it. */
  rate: number;
};

export function NowPlayingBars({ playing, rate }: NowPlayingBarsProps) {
  const still = useReducedMotion();
  // Guard against a bad rate collapsing the durations to 0/Infinity.
  const tempo = Math.min(Math.max(rate, 0.25), 4);

  return (
    <View style={styles.disc}>
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <Bar
          key={index}
          delay={BAR_DELAYS[index] / tempo}
          duration={BAR_DURATIONS[index] / tempo}
          playing={playing}
          still={still}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    alignItems: 'center',
    // A soft scrim, not a brand chip — it must sit quietly on any artwork.
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: DISC_SIZE / 2,
    flexDirection: 'row',
    gap: BAR_GAP,
    height: DISC_SIZE,
    justifyContent: 'center',
    width: DISC_SIZE,
  },
  bar: {
    // White reads on every cover; a theme token would vanish on light art.
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: BAR_WIDTH / 2,
    height: BAR_HEIGHT,
    width: BAR_WIDTH,
  },
});
