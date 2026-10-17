import { Column, Row, Slider, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { withAlpha } from '@/core';

import { useAppTheme } from '@/hooks/useAppTheme';
import { formatTime } from '@/lib/player';

import { type PlayerScrubberProps } from './chrome';

// THE scrubber — Material's native Slider plus the elapsed/total labels.
// Extracted from PlayerSheet so the iOS twin can swap in a SwiftUI Slider
// without the rest of the player (pure RN + Reanimated) being duplicated.
export function PlayerScrubber({
  position,
  duration,
  totalDuration,
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
        {/* NO ACCENT — the console's rule 3: the backdrop wash carries the
            colour, the track takes the ink. M3 fills a slider with the accent
            by default, which is the monochrome rule's first bucket (a colour
            the framework gave it, saying nothing); the SwiftUI twin was
            detinted the same day for the same reason. */}
        <Slider
          value={Math.min(position, duration)}
          min={0}
          max={duration}
          colors={{
            thumbColor: colors.onSurface,
            activeTrackColor: colors.onSurface,
            inactiveTrackColor: withAlpha(colors.onSurface, 0.24),
          }}
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
            {/* `-:--` while unknown — see the iOS twin. Walked on the A54
                2026-08-28. */}
            {totalDuration > 0 ? formatTime(totalDuration) : '-:--'}
          </Text>
        </Row>
      </Column>
    </ThemedHost>
  );
}

const styles = { host: { width: '100%' } } as const;
