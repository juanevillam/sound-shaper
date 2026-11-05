import { StyleSheet, View } from 'react-native';

import { MediaScrubberIos } from '@/components/player/MediaScrubberIos';
import { Text } from '@/components/ui/Text';
import { useI18n } from '@/i18n';
import { formatTime } from '@/lib/player';

import {
  IOS_SLIDER_HOST_HEIGHT,
  SKIP_SECONDS,
  type PlayerScrubberProps,
} from './chrome';

// The scrubber's box gets a FIXED height (`IOS_SLIDER_HOST_HEIGHT`, in
// `chrome.ts` because a value cannot be imported OUT of a platform-suffixed
// file — see that module's header): a scrubber that jumps is worse than one
// told its own height.
//
// WHILE THIS WAS SwiftUI's `Slider` IN A `Host` (until 2026-08-25, when
// `MediaScrubberIos` replaced it), the box was only half of it — the Host
// also had to be told to IGNORE THE SAFE AREA, or SwiftUI lays the slider out against a box of ZERO height and
// CENTRES it on the Host's TOP edge, which puts the track 16.33pt (half the
// box) too high, hard against the subtitle. It was measured on a cold launch,
// iPhone 17 / iOS 26.5: ink centre 1662.5 against the Host's own centre of
// 1709.5, corrected 0.4s later when the next SwiftUI render happened to run.
//
// A hosting controller takes part in the safe area by default and only stops
// once `ignoreSafeArea` reaches it through a props update; until then its
// content is squeezed to nothing. That update lands within a frame when the
// main thread is free, which is why this was invisible on every open EXCEPT
// the first after a fresh start — the first expand also decodes the artwork,
// blurs the wash and opens the clips query, and the correction waited behind
// all of it.
//
// EVERY OTHER FIXED-BOX HOST IN THIS CONSOLE ALREADY CARRIED IT — the glass
// footer glyphs, the transport glyphs — and that one did not, because it came
// in through the cross-platform `ThemedHost` rather than `SwiftUIHost`: the
// type checker resolves the BASE specifier, so a `ThemedHost` call site is
// checked against the Compose props, where `ignoreSafeArea` does not exist.
// Any SwiftUI host this console grows takes both.

// iOS counterpart of `PlayerScrubber` — Apple's media scrubber
// (`MediaScrubberIos`, authored RN) with the elapsed/total labels in plain RN
// below it.
export function PlayerScrubber({
  copyInset = 0,
  position,
  duration,
  totalDuration,
  onDrag,
  onDragEnd,
}: PlayerScrubberProps) {
  const { t } = useI18n();

  return (
    <View style={styles.block}>
      {/* APPLE'S MEDIA SCRUBBER, not a thumb slider — see
          `MediaScrubberIos`. Framing left this surface for the dedicated
          clip editor (2026-08-26), so the scrubber is plainly the player's
          again — no trim frame rides it and no range readout shares its
          label row. */}
      <View style={styles.host}>
        <MediaScrubberIos
          position={position}
          duration={duration}
          accessibilityLabel={t('player.position')}
          accessibilityValueText={
            totalDuration > 0
              ? t('player.positionValue')
                  .replace('{elapsed}', formatTime(position))
                  .replace('{total}', formatTime(totalDuration))
              : formatTime(position)
          }
          accessibilityStep={SKIP_SECONDS}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
        />
      </View>
      <View style={[styles.labels, { paddingHorizontal: copyInset }]}>
        <Text
          doNotTranslate
          muted
          style={styles.time}
          text={formatTime(position)}
          variant="labelMedium"
        />
        <Text
          doNotTranslate
          muted
          style={styles.time}
          // `-:--` WHILE THE DURATION IS UNKNOWN - a sound change resets the
          // store's duration until the fresh stream reports its own, and
          // rendering that 0 flashed "3:09 -> 0:00 -> 2:50" on every skip
          // (Juan, 2026-08-27). A placeholder is Apple's own answer (Podcasts
          // streams show --:-- while loading); holding the PREVIOUS sound's
          // number would be the one thing worse than the flash - a wrong
          // value that looks right.
          text={totalDuration > 0 ? formatTime(totalDuration) : '-:--'}
          variant="labelMedium"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { width: '100%' },
  /**
   * TABULAR FIGURES. The elapsed readout changes every second and SF's
   * proportional digits are not the same width, so a leading `1` shifts the
   * whole label sideways as it ticks — a control that twitches once a second
   * beside a slider that does not. `tabular-nums` is what SwiftUI's
   * `monospacedDigit` does, which is what Apple sets on every running timer.
   *
   * ALL THREE READOUTS SHARE THIS OBJECT — elapsed, total, and the centred
   * clip range, which is handed it as a prop rather than re-declaring the
   * `fontVariant`. The range needs it MOST: it is centred, so a narrower `1`
   * moves both of its ends, and under a drag its digits change several times
   * a second.
   */
  time: { fontVariant: ['tabular-nums'] },
  host: { height: IOS_SLIDER_HOST_HEIGHT, width: '100%' },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
});
