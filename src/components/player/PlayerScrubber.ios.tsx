import { StyleSheet, View } from 'react-native';

import { Slider } from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import { SwiftUIHost } from '@portfolio/mobile-ui';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { formatTime } from '@/lib/player';

import { type PlayerScrubberProps } from './chrome';

// The Host gets a FIXED height rather than matchContents: an auto-sized Host
// inside the player's absolutely-positioned console mis-measures on first
// layout, and a scrubber that jumps is worse than one told its own height.
//
// THE STATED BOX IS ONLY HALF OF IT — the Host must also be told to IGNORE THE
// SAFE AREA, or SwiftUI lays the slider out against a box of ZERO height and
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
// EVERY OTHER FIXED-BOX HOST IN THIS CONSOLE ALREADY CARRIED IT — the two glass
// footer glyphs, the transport glyphs, the clip row's ✕ — and this one did not,
// because it came in through the cross-platform `ThemedHost` rather than the
// iOS one. That is also why the import is `SwiftUIHost` now: the type checker
// resolves the BASE specifier, so a `ThemedHost` call site is checked against
// the Compose props, where `ignoreSafeArea` does not exist.
const SLIDER_HEIGHT = 32;

// THE RANGE COSTS NO LAYOUT — it is absolutely centred INSIDE the elapsed/total
// row, which is already there and already the right width.
//
// It used to be its own line under that row, appearing only while framing, and
// entering framing therefore pushed the transport and the footer down by the
// line plus `CLIP_FRAMING_GAP` — a shift on the exact frame a mode changes,
// which is the one kind of CLS this player must not have. Reserving the line
// permanently was the obvious alternative and is worse: it buys the fix with
// ~25pt of blank on the resting player, and clawing dead space back out of this
// console is most of why it was rebuilt.
//
// The row is 370pt wide against ~30pt of elapsed, ~30 of total and ~75 of
// range, so the three do not crowd; the range is not muted, because while
// framing it is the number that matters.

// iOS counterpart of `PlayerScrubber` — SwiftUI's own Slider (so it drags,
// tracks and feels exactly like the system one) with the elapsed/total labels
// in plain RN below it. SwiftUI reports the drag end through
// `onEditingChanged(false)`; Compose has a dedicated finished callback.
export function PlayerScrubber({
  copyInset = 0,
  position,
  duration,
  totalDuration,
  clipLabel,
  onDrag,
  onDragEnd,
}: PlayerScrubberProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.block}>
      <SwiftUIHost ignoreSafeArea="all" style={styles.host}>
        <Slider
          // MONOCHROME, like every other control on this surface. A
          // now-playing screen is tinted by its ARTWORK — that is what
          // `PlayerBackdrop` paints — and Apple leaves the controls on top in
          // the content colour rather than the accent. The default `Slider`
          // fills its played portion with the system tint, which is the last
          // place `colors.primary` survived on the iOS console.
          modifiers={[tint(colors.onSurface)]}
          value={Math.min(position, duration)}
          min={0}
          max={duration}
          onValueChange={onDrag}
          onEditingChanged={isEditing => {
            if (!isEditing) onDragEnd();
          }}
        />
      </SwiftUIHost>
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
          text={formatTime(totalDuration)}
          variant="labelMedium"
        />
        {clipLabel ? (
          <View pointerEvents="none" style={styles.clipLabelSlot}>
            <Text doNotTranslate text={clipLabel} variant="labelMedium" />
          </View>
        ) : null}
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
   */
  time: { fontVariant: ['tabular-nums'] },
  host: { height: SLIDER_HEIGHT, width: '100%' },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  clipLabelSlot: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
