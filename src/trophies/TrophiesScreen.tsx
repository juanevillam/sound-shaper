import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { tierColor } from './tierColors';
import { TrophyIcon } from './TrophyIcon';
import { type ResolvedTrophy, type TrophyTier } from './types';

/** Material You roles the screen paints with. */
export type TrophiesScreenColors = {
  background: string;
  /** Row background — an elevated surface (e.g. surfaceContainer). */
  surface: string;
  onSurface: string;
  onSurfaceMuted: string;
  /** Progress-line fill. */
  primary: string;
  /** Progress-line track (e.g. surfaceVariant). */
  track: string;
  /** Row press ripple — pass a low-alpha onSurface (e.g. withAlpha(onSurface, .1)). */
  ripple: string;
};

export type TrophiesScreenStrings = {
  /** Pre-formatted progress line, e.g. "3 of 7 earned". */
  progress: string;
  /** Pre-formatted completion percent, e.g. "43%" — sits inside the ring. */
  percent: string;
  /** iOS: the two figures flanking the summary ring. */
  earnedLabel: string;
  availableLabel: string;
  /** Prefix before the date on an earned trophy, e.g. "Earned". */
  achievedLabel: string;
  tierNames: Record<TrophyTier, string>;
};

export type TrophiesScreenProps = {
  /** Resolved, display-ordered trophies (see `useTrophies`). */
  trophies: ResolvedTrophy[];
  earned: number;
  total: number;
  colors: TrophiesScreenColors;
  strings: TrophiesScreenStrings;
  /** Locale-aware date formatter for the achieved date. */
  formatDate: (achievedAt: number) => string;
  /** Tapping a row — open the detail sheet. */
  onTrophyPress?: (id: string) => void;
  /**
   * iOS only. The awarded cache has not hydrated yet
   * (`useTrophies().hydrated` is false), so the lock states and the counts
   * passed above are not yet true: every trophy resolves LOCKED and the
   * summary reads "0 of N", which is a wrong answer rather than a pending one.
   *
   * While it is set, the parts that WAIT stand `SkeletonBone`s — each row's
   * icon (the tier colour is what claims "earned") and the whole progress
   * summary. The trophy TITLES stay real: they come from config and copy, not
   * the network, and boning them would only cost each row its true height.
   * Android, frozen, does not read it.
   */
  loading?: boolean;
};

// Grouped-list geometry, mirroring the app's `settingsGroup.ts`: the rows share
// one rounded card split by 2px hairline gaps — the group's first/last rows take
// the big outer radius, inner edges the small one. (Kept in sync with
// settingsGroup.ts by hand: this screen is plain RN, that helper returns Compose
// shapes, and a Host-per-row would measure async and lag the scroll.)
const OUTER_RADIUS = 24;
const INNER_RADIUS = 4;
const ROW_GAP = 2;
const ICON_SLOT = 40;

const groupRadii = (index: number, count: number) => ({
  borderTopLeftRadius: index === 0 ? OUTER_RADIUS : INNER_RADIUS,
  borderTopRightRadius: index === 0 ? OUTER_RADIUS : INNER_RADIUS,
  borderBottomLeftRadius: index === count - 1 ? OUTER_RADIUS : INNER_RADIUS,
  borderBottomRightRadius: index === count - 1 ? OUTER_RADIUS : INNER_RADIUS,
});

const TrophyRow = ({
  trophy,
  index,
  count,
  colors,
  strings,
  formatDate,
  onPress,
}: {
  trophy: ResolvedTrophy;
  index: number;
  count: number;
  colors: TrophiesScreenColors;
  strings: TrophiesScreenStrings;
  formatDate: (achievedAt: number) => string;
  onPress?: () => void;
}) => {
  const tierName = strings.tierNames[trophy.tier];

  // One supporting line. Tier rides along as a plain muted word (PlayStation
  // distinguishes tiers by label; the icon carries the color): earned shows the
  // date, locked shows the objective (the same description shown when earned).
  const supporting = trophy.unlocked
    ? `${tierName} · ${strings.achievedLabel} ${formatDate(trophy.achievedAt ?? 0)}`
    : `${tierName} · ${trophy.description}`;

  const textColor = trophy.unlocked ? colors.onSurface : colors.onSurfaceMuted;
  // Earned trophies wear their tier's color; locked ones stay a dim grey
  // silhouette, so the color is part of the reward.
  const iconColor = trophy.unlocked
    ? tierColor(trophy.tier)
    : colors.onSurfaceMuted;

  // The rounded, clipping background is an OUTER View; the Pressable lives
  // inside it. The press ripple can't clip itself to the group's asymmetric
  // (24/4) corners on its own — Android's outline ripple-mask only supports a
  // uniform radius — so the outer `overflow: 'hidden'` rounded clip is what keeps
  // the ripple inside the row (the same effect Compose's `clip(shape)` gives the
  // Settings rows).
  return (
    <View
      style={[
        styles.rowClip,
        groupRadii(index, count),
        {
          backgroundColor: colors.surface,
          marginBottom: index === count - 1 ? 0 : ROW_GAP,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        android_ripple={{ color: colors.ripple }}
        style={styles.row}
      >
        <View style={styles.iconSlot}>
          <TrophyIcon color={iconColor} size={26} locked={!trophy.unlocked} />
        </View>
        <View style={styles.text}>
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
      </Pressable>
    </View>
  );
};

/**
 * The trophies screen, built in the app's own Material 3 grouped-list idiom (the
 * Settings pattern): a summary line + progress on top, then every trophy as a
 * tappable row in one rounded card. Restrained — earned rows wear their tier
 * color with the achieved date, locked rows recede to a dim silhouette + hint,
 * the secret one stays masked. Tapping a row opens its detail (host-owned via
 * `onTrophyPress`). Fully prop-driven (colors, strings, date formatter injected)
 * so the package stays app-agnostic and localizable.
 */
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
      <View style={styles.header}>
        <View style={styles.summaryRow}>
          <Text
            numberOfLines={1}
            style={[styles.progress, { color: colors.onSurface }]}
          >
            {strings.progress}
          </Text>
          {/* The completion %, tinted to match the progress bar it sits above. */}
          <Text style={[styles.percent, { color: colors.primary }]}>
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

      <View>
        {trophies.map((trophy, index) => (
          <TrophyRow
            key={trophy.id}
            trophy={trophy}
            index={index}
            count={trophies.length}
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
  // Roomier gap below the summary before the trophy card starts.
  header: { gap: 12, paddingBottom: 28, paddingHorizontal: 4, paddingTop: 12 },
  // Count on the left, completion % on the right, sharing the line above the bar.
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  progress: { flexShrink: 1, fontSize: 22, fontWeight: '600', lineHeight: 28 },
  percent: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  track: { borderRadius: 999, height: 4, overflow: 'hidden', width: '100%' },
  fill: { borderRadius: 999, height: '100%' },
  // Outer wrapper owns the rounded corners + clip so the Pressable's ripple
  // stays inside them; the Pressable owns the row layout.
  rowClip: { overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: ICON_SLOT,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '500', lineHeight: 22 },
  supporting: { fontSize: 12, lineHeight: 16 },
});
