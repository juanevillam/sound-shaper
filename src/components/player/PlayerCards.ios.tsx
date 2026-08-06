import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@portfolio/mobile-ui';

import { Text } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { haptics } from '@/lib/haptics';
import { TILE_GAP } from '@/styles/metrics';
import { CARD_RADIUS, CONTINUOUS_CURVE, HAIRLINE } from '@/styles/shape';

import { CARDS_HEIGHT, type PlayerCardsProps } from './chrome';

const ICON_SIZE = 26;
const PRESSED_OPACITY = 0.55;

// iOS counterpart of `PlayerCards` — same two tiles, built from RN so they sit
// over the artwork wash without a Compose Surface. Each card's glyph still
// needs a Host (SF Symbols are SwiftUI views), but a `pointerEvents="none"`
// one lets the press read straight through to the Pressable, so the whole tile
// stays tappable.
//
// The tiles take the app's iOS container shape from `styles/shape` — the
// grouped radius on a continuous curve, read from a hairline rather than a
// tonal fill (`styles/surfaces` explains why iOS separates by edge and Android
// by tone). Android's twin keeps its M3 outlined card.
export function PlayerCards({ cards }: PlayerCardsProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.row}>
      {cards.map(card => (
        <Pressable
          key={card.key}
          accessibilityLabel={card.label}
          accessibilityRole="button"
          onPress={() => {
            haptics.selection();
            card.onPress();
          }}
          style={({ pressed }) => [
            styles.card,
            {
              borderColor: colors.border,
              opacity: pressed ? PRESSED_OPACITY : 1,
            },
          ]}
        >
          <ThemedHost matchContents pointerEvents="none">
            <AppIcon name={card.icon} size={ICON_SIZE} tint={colors.primary} />
          </ThemedHost>
          <View style={styles.copy}>
            <Text
              doNotTranslate
              text={card.label}
              variant="bodyLarge"
              numberOfLines={1}
            />
            <Text
              doNotTranslate
              muted
              text={card.summary}
              variant="bodySmall"
              numberOfLines={1}
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: CARD_RADIUS,
    borderWidth: HAIRLINE,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    height: CARDS_HEIGHT,
    paddingHorizontal: 14,
    ...CONTINUOUS_CURVE,
  },
  copy: { flex: 1, gap: 1 },
  row: { flexDirection: 'row', gap: TILE_GAP, width: '100%' },
});
