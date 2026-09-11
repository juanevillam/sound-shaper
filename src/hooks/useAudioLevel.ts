import { useEffect } from 'react';

import {
  Easing,
  cancelAnimation,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { audioEngine } from '@/lib/audioEngine';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE OUTPUT LEVEL AS A SHARED VALUE — what the player's backdrop breathes on.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `audioEngine.level()` is a SAMPLE; this is the envelope a visual can ride.
 *
 * NOTHING HERE TOUCHES REACT STATE, and that is the whole architecture. A level
 * that re-rendered the player at even half this rate would be the exact defect
 * the 2026-08-28 data audit spent its session removing — the transport's own
 * 10Hz tick was pushed down to leaves, and a persisted store was found taking a
 * write per tick. The poll writes a Reanimated shared value, the animation runs
 * on the UI thread, and the React tree re-renders exactly never.
 */

/**
 * 24Hz. Fast enough that a swell arrives with the music, slow enough that the
 * JS thread spends almost nothing — and the gap between polls is covered by
 * interpolating on the UI thread rather than by polling harder.
 *
 * The library's own analyser is a POLLED one and sees roughly a fifth of the
 * samples (AGENTS.md records this from the EQ peak measurements). That is
 * useless for catching a transient and entirely adequate for an envelope, which
 * is the only thing read here.
 */
const POLL_MS = 1000 / 24;

/**
 * THE ENVELOPE — and both halves of it are eased, which is the whole fix.
 *
 * The first version took a RISING sample OUTRIGHT (`raw > smoothed ? raw : …`)
 * and only eased the fall. On device that read as FLASHING — Juan's word — and
 * it is exactly what an instant attack does: every transient snaps the light
 * to its peak and then it slides back, over and over, which is a strobe with a
 * tail rather than a glow.
 *
 * So the attack is a coefficient too, just a faster one than the release. At
 * 24Hz these are time constants of roughly 0.17s up and 0.83s down: the light
 * arrives with the music and leaves slowly, which is what "silky" means here
 * and is also how every compressor's envelope follower is built.
 */
const ATTACK = 0.25;
const RELEASE = 0.05;

/**
 * WHERE THE MUSIC ACTUALLY LIVES, in RMS — and these two numbers were MEASURED
 * on the device rather than reasoned about, because the reasoned pair was
 * wrong by an order of magnitude and produced a light that did not move at all.
 *
 * The first guess was 0.03–0.22, on the argument that a full-scale sine is
 * 0.707 and a mastered track sits well under it. Sampled off the real graph on
 * the A54 (60 consecutive polls, a normal track at 1×): **min 0.103, p10 0.177,
 * median 0.456, p90 0.757, max 0.941**. So almost every sample was clamping to
 * the top of that band and the envelope sat pinned at 1 — a constant light,
 * which measured as 0.2/255 of movement across fourteen frames.
 *
 * The band is now p10→p90 rounded out. That maps the median to roughly the
 * middle of the range, which is what lets a narrow OUTPUT range read as
 * breathing rather than as either a flat glow or a blink.
 *
 * A 32-sample window reads higher than an intuition trained on long-window RMS,
 * which is most of where the bad guess came from. Re-measure before retuning;
 * `useAudioLevel` is one `console.log` away from the distribution.
 */
const RMS_FLOOR = 0.15;
const RMS_CEILING = 0.8;

/**
 * How long the level takes to stand down when playback stops. Long enough to
 * read as settling rather than as the light being switched off.
 *
 * IT SETTLES TO A TRUE ZERO, and the visible floor is the CONSUMER's. This
 * used to hold a non-zero idle here so the light never vanished; that is the
 * right behaviour and the wrong place for it — a hook that reports the output
 * level should report silence as silence, and `PlayerBloom`'s own
 * `EDGE_MIN_OPACITY` is what keeps a rim on screen.
 */
const SETTLE_MS = 420;

/**
 * @param active Playback is running. When false the level eases to its floor
 *   and the poll stops — a paused player costs nothing at all.
 */
export const useAudioLevel = (active: boolean): SharedValue<number> => {
  const level = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(level);
      level.value = withTiming(0, { duration: SETTLE_MS });

      return;
    }

    // The envelope's own state. A ref would do; a closure variable is the same
    // thing without the ceremony, and the interval owns it for its lifetime.
    let smoothed = level.value;

    const timer = setInterval(() => {
      const raw = audioEngine.level();
      // Normalised into the band real music occupies before the envelope sees
      // it, so the coefficients below describe the light rather than the codec.
      const target = Math.min(
        Math.max((raw - RMS_FLOOR) / (RMS_CEILING - RMS_FLOOR), 0),
        1,
      );
      const coefficient = target > smoothed ? ATTACK : RELEASE;
      smoothed += (target - smoothed) * coefficient;

      /**
       * TWEENED TO THE NEXT POLL, not written outright. A bare assignment
       * steps the value 24 times a second and the bloom strobes; giving it
       * exactly one poll's worth of travel makes the UI thread draw the
       * in-between frames, so a 24Hz source renders at 60.
       */
      level.value = withTiming(smoothed, {
        duration: POLL_MS,
        easing: Easing.linear,
      });
    }, POLL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [active, level, reduceMotion]);

  return level;
};
