import { StyleSheet, Text as RNText, View } from 'react-native';

import {
  Button,
  Form,
  Host,
  HStack,
  Image,
  RNHostView,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
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

// iOS counterpart of `TrophiesScreen` — same prop API. The trophy list is a
// REAL SwiftUI inset-grouped `Form` (the exact chrome the shared Settings
// screen uses: system cell background, separators, radius, press highlight);
// the progress summary is a plain RN header on the grouped background above
// it. The trophy glyph (react-native-svg) bridges into each row via
// RNHostView.
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
    <View style={styles.root}>
      {/* Progress summary as a plain header ON the grouped background —
          Android parity (its header floats over the screen background too).
          Boxing it as its own one-row Form card read as a stray pill that
          broke the page flow (user-flagged), so only the trophy LIST is a
          card. Pure RN: SF text + the same track/fill bar the Android header
          draws. */}
      <View style={styles.header}>
        <View style={styles.summaryRow}>
          <RNText style={[styles.progressText, { color: colors.onSurface }]}>
            {strings.progress}
          </RNText>
          <RNText style={[styles.percentText, { color: colors.primary }]}>
            {strings.percent}
          </RNText>
        </View>
        <View style={[styles.track, { backgroundColor: colors.track }]}>
          <View
            style={[
              styles.fill,
              {
                backgroundColor: colors.primary,
                width: `${Math.round(fraction * 100)}%`,
              },
            ]}
          />
        </View>
      </View>

      <Host style={styles.host}>
        <Form
          modifiers={[scrollContentBackground('hidden'), tint(colors.primary)]}
        >
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
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  host: { flex: 1 },
  // 20pt side inset = Android's header rhythm (16 scroll + 4 header) and
  // Apple's large-content margin; the Form's own section inset provides the
  // gap down to the trophy card.
  header: {
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  summaryRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  // SF headline (17 semibold) + a subheadline-sized tinted percent.
  progressText: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  percentText: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  track: {
    borderRadius: 999,
    height: 4,
    overflow: 'hidden',
    width: '100%',
  },
  fill: { borderRadius: 999, height: '100%' },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: ICON_SLOT,
  },
});
