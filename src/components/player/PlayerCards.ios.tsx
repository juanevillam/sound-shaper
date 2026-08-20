import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon, usePressSquash } from '@portfolio/mobile-ui';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { TILE_GAP } from '@/styles/metrics';
import { CARD_RADIUS, CONTINUOUS_CURVE, HAIRLINE } from '@/styles/shape';

import { CARDS_HEIGHT, type PlayerCard, type PlayerCardsProps } from './chrome';

const ICON_SIZE = 26;

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
//
// THEY SQUASH, they do not fade. Press feedback in this portfolio is split by
// CONTAINER — tiles and cards squash, inline rows and text actions fade — and
// these are cards. They were fading at a locally-declared 0.55, one of two
// copies of a constant the package already owns; see `SquashPressable`, which
// carries the one spring and the story of the seven divergent copies that
// forced it there.
//
// `usePressSquash` rather than `SquashPressable` because the tile IS the
// pressable: it owns the row layout, the hairline and the height, and the
// component's shape puts the styled box around a bare Pressable instead.
function PlayerCardTile({ card }: { card: PlayerCard }) {
  const { colors } = useAppTheme();
  const squash = usePressSquash();

  return (
    <Animated.View style={[styles.slot, squash.style]}>
      <Pressable
        accessibilityLabel={card.label}
        accessibilityRole="button"
        onPress={card.onPress}
        onPressIn={squash.onPressIn}
        onPressOut={squash.onPressOut}
        style={[styles.card, { borderColor: colors.border }]}
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
    </Animated.View>
  );
}

export function PlayerCards({ cards }: PlayerCardsProps) {
  return (
    <View style={styles.row}>
      {cards.map(card => (
        <PlayerCardTile key={card.key} card={card} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // The animated box the squash scales; the tile below fills it.
  slot: { flex: 1 },
  card: {
    alignItems: 'center',
    borderRadius: CARD_RADIUS,
    borderWidth: HAIRLINE,
    flexDirection: 'row',
    gap: 10,
    height: CARDS_HEIGHT,
    paddingHorizontal: 14,
    ...CONTINUOUS_CURVE,
  },
  copy: { flex: 1, gap: 1 },
  row: { flexDirection: 'row', gap: TILE_GAP, width: '100%' },
});
