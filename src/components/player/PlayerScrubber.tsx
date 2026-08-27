import { Column, Row, Slider, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { formatTime } from '@/lib/player';

import { type PlayerScrubberProps } from './chrome';

// Drop below the elapsed/total row, so the range reads as its own line.
const CLIP_LABEL_GAP = 6;

// THE scrubber — Material's native Slider plus the elapsed/total labels.
// Extracted from PlayerSheet so the iOS twin can swap in a SwiftUI Slider
// without the rest of the player (pure RN + Reanimated) being duplicated.
export function PlayerScrubber({
  position,
  duration,
  totalDuration,
  clipLabel,
  onDrag,
  onDragEnd,
}: PlayerScrubberProps) {
  const { colors } = useAppTheme();

  return (
    <ThemedHost matchContents={{ vertical: true }} style={styles.host}>
      <Column
        horizontalAlignment="center"
        verticalArrangement={{ spacedBy: 0 }}
        modifiers={[fillMaxWidth()]}
      >
        <Slider
          value={Math.min(position, duration)}
          min={0}
          max={duration}
          onValueChange={onDrag}
          onValueChangeFinished={onDragEnd}
          modifiers={[fillMaxWidth()]}
        />
        <Row horizontalArrangement="spaceBetween" modifiers={[fillMaxWidth()]}>
          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'labelMedium' }}
          >
            {formatTime(position)}
          </Text>
          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'labelMedium' }}
          >
            {/* `-:--` while unknown - see the iOS twin. UNVERIFIED on
                device (Android is frozen); re-check when Android resumes. */}
            {totalDuration > 0 ? formatTime(totalDuration) : '-:--'}
          </Text>
        </Row>
        {/* The clip range gets its OWN line under the playhead/total pair,
            never their baseline: it belongs to the brackets above, not to the
            track's own readout, and sharing a row made the three read as one
            crowded strip. */}
        {clipLabel ? (
          <Text
            color={colors.onSurface}
            style={{ typography: 'labelMedium' }}
            modifiers={[padding(0, CLIP_LABEL_GAP, 0, 0)]}
          >
            {clipLabel}
          </Text>
        ) : null}
      </Column>
    </ThemedHost>
  );
}

const styles = { host: { width: '100%' } } as const;
