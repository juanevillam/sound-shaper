import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { tierColor } from './tierColors';
import {
  type TrophiesScreenProps,
  type TrophiesScreenColors,
  type TrophiesScreenStrings,
} from './TrophiesScreen';
import { TrophyIcon } from './TrophyIcon';
import { type ResolvedTrophy } from './types';

// iOS counterpart of `TrophiesScreen` — same prop API, laid out as a native
// inset-grouped list (the Settings / Game Center idiom) instead of Android's
// Material grouped card: ONE rounded container, rows divided by hairline
// separators inset past the icon column, press feedback as a highlight (no
// ripple), and a thin rounded progress bar under a headline summary.
// Matches the iOS 26 inset-grouped-list container radius (the app's shared
// CARD_RADIUS on iOS) so the group sits in tone with native Form sections.
const GROUP_RADIUS = 26;
const ICON_SLOT = 40;
const PRESSED_OPACITY = 0.6;

const TrophyRow = ({
  trophy,
  isLast,
  colors,
  strings,
  formatDate,
  onPress,
}: {
  trophy: ResolvedTrophy;
  isLast: boolean;
  colors: TrophiesScreenColors;
  strings: TrophiesScreenStrings;
  formatDate: (achievedAt: number) => string;
  onPress?: () => void;
}) => {
  const tierName = strings.tierNames[trophy.tier];

  const supporting = trophy.unlocked
    ? `${tierName} · ${strings.achievedLabel} ${formatDate(trophy.achievedAt ?? 0)}`
    : `${tierName} · ${trophy.description}`;

  const textColor = trophy.unlocked ? colors.onSurface : colors.onSurfaceMuted;
  const iconColor = trophy.unlocked
    ? tierColor(trophy.tier)
    : colors.onSurfaceMuted;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}
    >
      <View style={styles.row}>
        <View style={styles.iconSlot}>
          <TrophyIcon color={iconColor} size={26} locked={!trophy.unlocked} />
        </View>
        <View
          style={[
            styles.rowBody,
            !isLast && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.track,
            },
          ]}
        >
          <Text numberOfLines={1} style={[styles.title, { color: textColor }]}>
            {trophy.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.supporting, { color: colors.onSurfaceMuted }]}
          >
            {supporting}
          </Text>
        </View>
      </View>
    </Pressable>
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
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      {/* Progress lives in its own inset-grouped card above the list — the
          bare header read Android-ish; a grouped summary card is the
          Game Center read. */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <View style={styles.summaryRow}>
          <Text
            numberOfLines={1}
            style={[styles.progress, { color: colors.onSurface }]}
          >
            {strings.progress}
          </Text>
          <Text style={[styles.percent, { color: colors.onSurfaceMuted }]}>
            {strings.percent}
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.track }]}>
          <View
            style={[
              styles.fill,
              { backgroundColor: colors.primary, width: `${fraction * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* One inset-grouped container; hairline separators live inside. */}
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        {trophies.map((trophy, index) => (
          <TrophyRow
            key={trophy.id}
            trophy={trophy}
            isLast={index === trophies.length - 1}
            colors={colors}
            strings={strings}
            formatDate={formatDate}
            onPress={onTrophyPress ? () => onTrophyPress(trophy.id) : undefined}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: 32, paddingHorizontal: 16, paddingTop: 12 },
  header: {
    borderRadius: GROUP_RADIUS,
    gap: 12,
    marginBottom: 20,
    padding: 18,
  },
  summaryRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  progress: { flexShrink: 1, fontSize: 20, fontWeight: '600', lineHeight: 25 },
  percent: { fontSize: 15, fontWeight: '400', lineHeight: 20 },
  track: { borderRadius: 999, height: 3, overflow: 'hidden', width: '100%' },
  fill: { borderRadius: 999, height: '100%' },
  group: { borderRadius: GROUP_RADIUS, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingLeft: 16,
  },
  iconSlot: {
    alignItems: 'center',
    marginRight: 12,
    width: ICON_SLOT,
  },
  // The separator hangs on the text block so it insets past the icon column —
  // the native grouped-list read.
  rowBody: {
    flex: 1,
    gap: 2,
    paddingRight: 16,
    paddingVertical: 11,
  },
  title: { fontSize: 16, fontWeight: '400', lineHeight: 21 },
  supporting: { fontSize: 13, lineHeight: 18 },
});
