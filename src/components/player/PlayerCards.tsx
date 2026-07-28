import { Column, Row, Shape, Surface, Text } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { AppIcon } from '@portfolio/mobile-ui';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { haptics } from '@/lib/haptics';

import { CARDS_HEIGHT, type PlayerCardsProps } from './chrome';

const CARD_SHAPE = Shape.RoundedCorner({
  cornerRadii: {
    topStart: 12,
    topEnd: 12,
    bottomStart: 12,
    bottomEnd: 12,
  },
});

// Shape + Clips — the two studios, side by side as the console's footer.
// OUTLINED (Material 3's own variant for exactly this): a filled surface sat
// as two grey slabs on top of the artwork wash and cut the gradient in half.
// Transparent + a hairline outline keeps the wash running edge to edge.
export function PlayerCards({ cards }: PlayerCardsProps) {
  const { colors } = useAppTheme();

  return (
    <ThemedHost style={styles.host}>
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 12 }}
        modifiers={[fillMaxWidth()]}
      >
        {cards.map(card => (
          <Surface
            key={card.key}
            onClick={() => {
              haptics.selection();
              card.onPress();
            }}
            color="transparent"
            border={{ width: 1, color: colors.border }}
            shape={CARD_SHAPE}
            modifiers={[weight(1)]}
          >
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 10 }}
              modifiers={[fillMaxWidth(), padding(14, 18, 14, 18)]}
            >
              <AppIcon
                name={card.icon}
                size={26}
                tint={colors.primary}
                contentDescription={card.label}
              />
              <Column
                verticalArrangement={{ spacedBy: 1 }}
                modifiers={[weight(1)]}
              >
                <Text
                  color={colors.onSurface}
                  style={{ typography: 'bodyLarge' }}
                  maxLines={1}
                >
                  {card.label}
                </Text>
                <Text
                  color={colors.onSurfaceMuted}
                  style={{ typography: 'bodySmall' }}
                  maxLines={1}
                >
                  {card.summary}
                </Text>
              </Column>
            </Row>
          </Surface>
        ))}
      </Row>
    </ThemedHost>
  );
}

const styles = { host: { height: CARDS_HEIGHT, width: '100%' } } as const;
