import { StyleSheet, View } from 'react-native';

import { Slider } from '@expo/ui/swift-ui';

import { Text } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { formatTime } from '@/lib/player';

import { type PlayerScrubberProps } from './chrome';

// The Host gets a FIXED height rather than matchContents: an auto-sized Host
// inside the player's absolutely-positioned console mis-measures on first
// layout, and a scrubber that jumps is worse than one told its own height.
const SLIDER_HEIGHT = 32;

// Drop below the elapsed/total row, so the range reads as its own line.
const CLIP_LABEL_GAP = 8;

// iOS counterpart of `PlayerScrubber` — SwiftUI's own Slider (so it drags,
// tracks and feels exactly like the system one) with the elapsed/total labels
// in plain RN below it. SwiftUI reports the drag end through
// `onEditingChanged(false)`; Compose has a dedicated finished callback.
export function PlayerScrubber({
  position,
  duration,
  totalDuration,
  clipLabel,
  onDrag,
  onDragEnd,
}: PlayerScrubberProps) {
  return (
    <View style={styles.block}>
      <ThemedHost style={styles.host}>
        <Slider
          value={Math.min(position, duration)}
          min={0}
          max={duration}
          onValueChange={onDrag}
          onEditingChanged={isEditing => {
            if (!isEditing) onDragEnd();
          }}
        />
      </ThemedHost>
      <View style={styles.labels}>
        <Text
          doNotTranslate
          muted
          text={formatTime(position)}
          variant="labelMedium"
        />
        <Text
          doNotTranslate
          muted
          text={formatTime(totalDuration)}
          variant="labelMedium"
        />
      </View>
      {/* The clip range gets its OWN line under the playhead/total pair, never
          their baseline: it belongs to the brackets above, not to the track's
          own readout, and sharing a row made the three read as one crowded
          strip. */}
      {clipLabel ? (
        <View style={styles.clipLabelRow}>
          <Text doNotTranslate text={clipLabel} variant="labelMedium" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { width: '100%' },
  host: { height: SLIDER_HEIGHT, width: '100%' },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  clipLabelRow: {
    alignItems: 'center',
    paddingTop: CLIP_LABEL_GAP,
    width: '100%',
  },
});
