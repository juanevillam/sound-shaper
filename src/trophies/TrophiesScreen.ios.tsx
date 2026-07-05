import { StyleSheet, View } from 'react-native';

import {
  Button,
  Form,
  Host,
  HStack,
  Image,
  ProgressView,
  RNHostView,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  padding,
  scrollContentBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { tierColor } from './tierColors';
import {
  type TrophiesScreenProps,
  type TrophiesScreenColors,
  type TrophiesScreenStrings,
} from './TrophiesScreen';
import { TrophyIcon } from './TrophyIcon';
import { type ResolvedTrophy } from './types';

// iOS counterpart of `TrophiesScreen` — same prop API, rendered as a REAL
// SwiftUI inset-grouped `Form` (the exact chrome the shared Settings screen
// uses: system cell background, separators, radius, press highlight), not an
// RN imitation of one. The trophy glyph (react-native-svg) bridges into each
// row via RNHostView; the progress line is a native `ProgressView`.
const ICON_SIZE = 26;
const ICON_SLOT = 34;
const CHEVRON_SIZE = 13;

const TrophyRow = ({
  trophy,
  colors,
  strings,
  formatDate,
  onPress,
}: {
  trophy: ResolvedTrophy;
  colors: TrophiesScreenColors;
  strings: TrophiesScreenStrings;
  formatDate: (achievedAt: number) => string;
  onPress?: () => void;
}) => {
  const tierName = strings.tierNames[trophy.tier];

  const supporting = trophy.unlocked
    ? `${tierName} · ${strings.achievedLabel} ${formatDate(trophy.achievedAt ?? 0)}`
    : `${tierName} · ${trophy.description}`;

  const iconColor = trophy.unlocked
    ? tierColor(trophy.tier)
    : colors.onSurfaceMuted;

  return (
    <Button onPress={onPress}>
      <HStack spacing={12}>
        <RNHostView matchContents>
          <View style={styles.iconSlot}>
            <TrophyIcon
              color={iconColor}
              size={ICON_SIZE}
              locked={!trophy.unlocked}
            />
          </View>
        </RNHostView>
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              foregroundStyle(
                trophy.unlocked ? colors.onSurface : colors.onSurfaceMuted,
              ),
            ]}
          >
            {trophy.title}
          </Text>
          <Text
            modifiers={[
              font({ textStyle: 'footnote' }),
              foregroundStyle(colors.onSurfaceMuted),
            ]}
          >
            {supporting}
          </Text>
        </VStack>
        <Spacer />
        <Image
          systemName="chevron.right"
          size={CHEVRON_SIZE}
          color={colors.onSurfaceMuted}
        />
      </HStack>
    </Button>
  );
};

export const TrophiesScreen = ({
  trophies,
  earned,
  total,
  colors,
  strings,
  formatDate,
  onTrophyPress,
}: TrophiesScreenProps) => {
  const fraction = total > 0 ? earned / total : 0;

  return (
    <Host style={styles.host}>
      <Form
        modifiers={[
          scrollContentBackground('hidden'),
          tint(colors.primary),
          // The RN navigation header replaces SwiftUI's own bar; match the
          // shared Settings screen's top breathing room.
          padding({ top: 16 }),
        ]}
      >
        {/* Progress summary as its own grouped section — cell chrome comes
            from the system, the bar is a native ProgressView. */}
        <Section>
          <VStack alignment="leading" spacing={10}>
            <HStack spacing={12}>
              <Text
                modifiers={[
                  font({ textStyle: 'headline' }),
                  foregroundStyle(colors.onSurface),
                ]}
              >
                {strings.progress}
              </Text>
              <Spacer />
              <Text
                modifiers={[
                  font({ textStyle: 'subheadline' }),
                  foregroundStyle(colors.onSurfaceMuted),
                ]}
              >
                {strings.percent}
              </Text>
            </HStack>
            <ProgressView value={fraction} />
          </VStack>
        </Section>

        <Section>
          {trophies.map(trophy => (
            <TrophyRow
              key={trophy.id}
              trophy={trophy}
              colors={colors}
              strings={strings}
              formatDate={formatDate}
              onPress={
                onTrophyPress ? () => onTrophyPress(trophy.id) : undefined
              }
            />
          ))}
        </Section>
      </Form>
    </Host>
  );
};

const styles = StyleSheet.create({
  host: { flex: 1 },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: ICON_SLOT,
  },
});
