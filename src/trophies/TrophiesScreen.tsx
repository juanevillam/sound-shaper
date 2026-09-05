import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  DisclosureChevron,
  SCREEN_CONTENT_TOP,
  SkeletonBone,
  SkeletonTextLine,
  TEXT_VARIANTS,
} from '@portfolio/mobile-ui';
import Svg, { Circle } from 'react-native-svg';

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
  /** Progress-ring fill. */
  primary: string;
  /** Progress-ring track (e.g. surfaceVariant). */
  track: string;
  /** Row press ripple — pass a low-alpha onSurface (e.g. withAlpha(onSurface, .1)). */
  ripple: string;
};

export type TrophiesScreenStrings = {
  /** Pre-formatted completion percent, e.g. "43%" — sits inside the ring. */
  percent: string;
  /** The two figures flanking the summary ring, on BOTH platforms. */
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
   * Scroll handlers from the host app's app-bar hook, spread onto this
   * screen's scroller. OPTIONAL: an app that does not lift its bar on scroll
   * (or a platform that has no such idiom) passes nothing and nothing changes.
   *
   * The screen owns the scroller, so the app cannot wire this itself — which
   * is why Android's Settings and Trophies bars sat permanently at the
   * SCROLLED colour while every screen with its own `ScrollView` lifted
   * properly.
   */
  scrollProps?: object;

  /**
   * The awarded cache has not hydrated yet (`useTrophies().hydrated` is
   * false), so the lock states and the counts passed above are not yet true:
   * every trophy resolves LOCKED and the summary reads "0 of N", which is a
   * wrong answer rather than a pending one.
   *
   * While it is set, the parts that WAIT stand bones — the summary's ring and
   * figures, each row's icon and lines. Read by BOTH platforms (Android
   * joined 2026-09-04); the row text bones are ghost-measured
   * (`SkeletonTextLine`), never lineHeight boxes.
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
const ICON_SIZE = 26;

/**
 * THE SUMMARY IS THE iOS SHAPE — a centred [earned | ring | available] block,
 * the screen's headline with the list as its body (Juan, 2026-09-04; it was a
 * count + thin linear bar, which read as a caption). Same parts, Material's
 * language: the gauge is an SVG arc on the track/primary roles, the figures
 * take `titleLarge` over a muted `bodySmall` label.
 *
 * The iOS block's own proportions carry over where they are ratios of the
 * block rather than SwiftUI facts: two equal-width figure columns so the ring
 * lands on the screen's centre, and the ring as the dominant element.
 */
const RING_SIZE = 104;
const RING_STROKE = 8;
const FIGURE_WIDTH = 72;
const SUMMARY_COLUMN_GAP = 14;
/** Bones for the two figures — a number-sized block over a label-sized line. */
const FIGURE_BONE_NUMBER = { width: 26, height: 24 };
const FIGURE_BONE_LABEL = 48;
/** The supporting line is one sentence at bodySmall, whatever the row. */
const SUPPORTING_BONE_WIDTH = 160;

const groupRadii = (index: number, count: number) => ({
  borderTopLeftRadius: index === 0 ? OUTER_RADIUS : INNER_RADIUS,
  borderTopRightRadius: index === 0 ? OUTER_RADIUS : INNER_RADIUS,
  borderBottomLeftRadius: index === count - 1 ? OUTER_RADIUS : INNER_RADIUS,
  borderBottomRightRadius: index === count - 1 ? OUTER_RADIUS : INNER_RADIUS,
});

/**
 * The determinate progress ring — an SVG arc, because Compose's determinate
 * indicator cannot carry the percent INSIDE the way the iOS `Gauge`'s
 * `currentValueLabel` does, and a bridged Host for one arc is not worth its
 * async measurement. Track and fill take the same roles the old linear bar
 * spent (`track` / `primary`); round caps, 12 o'clock start.
 */
const SummaryRing = ({
  fraction,
  percent,
  colors,
}: {
  fraction: number;
  percent: string;
  colors: TrophiesScreenColors;
}) => {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={styles.ring}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          stroke={colors.track}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - fraction)}
          // Start at 12 o'clock, like the iOS gauge.
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <View style={styles.ringLabel}>
        <Text style={[styles.percent, { color: colors.onSurface }]}>
          {percent}
        </Text>
      </View>
    </View>
  );
};

const SummaryFigure = ({
  value,
  label,
  loading,
  colors,
}: {
  value: string;
  label: string;
  loading: boolean;
  colors: TrophiesScreenColors;
}) =>
  loading ? (
    <View style={[styles.figure, styles.figureBone]}>
      <SkeletonBone
        width={FIGURE_BONE_NUMBER.width}
        height={FIGURE_BONE_NUMBER.height}
      />
      <SkeletonBone width={FIGURE_BONE_LABEL} height={12} />
    </View>
  ) : (
    <View style={styles.figure}>
      <Text style={[styles.figureValue, { color: colors.onSurface }]}>
        {value}
      </Text>
      <Text style={[styles.figureLabel, { color: colors.onSurfaceMuted }]}>
        {label}
      </Text>
    </View>
  );

const TrophyRow = ({
  trophy,
  index,
  count,
  colors,
  strings,
  formatDate,
  loading,
  onPress,
}: {
  trophy: ResolvedTrophy;
  index: number;
  count: number;
  colors: TrophiesScreenColors;
  strings: TrophiesScreenStrings;
  formatDate: (achievedAt: number) => string;
  loading: boolean;
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

  // The title bar is sized from the title it stands for — the row already HAS
  // the string (config and copy, not the network), so the bones vary down the
  // card the way the real names do. The iOS twin's own trick.
  const titleBoneWidth = Math.min(140, Math.max(56, trophy.title.length * 9));

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
          {loading ? (
            <SkeletonBone
              width={ICON_SIZE}
              height={ICON_SIZE}
              radius={ICON_SIZE / 2}
            />
          ) : (
            <TrophyIcon
              color={iconColor}
              size={ICON_SIZE}
              locked={!trophy.unlocked}
            />
          )}
        </View>
        <View style={styles.text}>
          {loading ? (
            // Ghost-measured bones — the box is whatever the platform draws
            // for the row's own variants, never a lineHeight constant.
            <>
              <SkeletonTextLine
                variant="titleMedium"
                barWidth={titleBoneWidth}
              />
              <SkeletonTextLine
                variant="bodySmall"
                barWidth={SUPPORTING_BONE_WIDTH}
              />
            </>
          ) : (
            <>
              <Text
                numberOfLines={1}
                style={[styles.title, { color: textColor }]}
              >
                {trophy.title}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.supporting, { color: colors.onSurfaceMuted }]}
              >
                {supporting}
              </Text>
            </>
          )}
        </View>
        {/* The disclosure chevron every pushed row in this family carries —
            the shared SVG definition, so it cannot drift from the account
            screen's rows. It stays through the wait: the row still goes
            somewhere. */}
        <DisclosureChevron color={colors.onSurfaceMuted} />
      </Pressable>
    </View>
  );
};

/**
 * The trophies screen, built in the app's own Material 3 grouped-list idiom (the
 * Settings pattern): the iOS summary block — earned figure, progress ring with
 * the percent inside, available figure — then every trophy as a tappable row in
 * one rounded card. Restrained — earned rows wear their tier color with the
 * achieved date, locked rows recede to a dim silhouette + hint, the secret one
 * stays masked. Tapping a row opens its detail (host-owned via `onTrophyPress`).
 * Fully prop-driven (colors, strings, date formatter injected) so the package
 * stays app-agnostic and localizable.
 */
export const TrophiesScreen = ({
  trophies,
  earned,
  total,
  colors,
  strings,
  formatDate,
  onTrophyPress,
  scrollProps,
  loading = false,
}: TrophiesScreenProps) => {
  const fraction = total > 0 ? earned / total : 0;

  return (
    <ScrollView
      {...scrollProps}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      {/* The summary sits in a CARD, exactly as the iOS Section takes the
          grouped default fill — page content in the same container language
          as the list below it, not figures floating on the page. */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <SummaryFigure
          value={String(earned)}
          label={strings.earnedLabel}
          loading={loading}
          colors={colors}
        />
        {loading ? (
          // The ring is boned too, not drawn empty: an empty track is a real
          // gauge reading zero — a state, not a placeholder (the iOS rule).
          <View style={styles.ring}>
            <SkeletonBone
              width={RING_SIZE}
              height={RING_SIZE}
              radius={RING_SIZE / 2}
            />
          </View>
        ) : (
          <SummaryRing
            fraction={fraction}
            percent={strings.percent}
            colors={colors}
          />
        )}
        <SummaryFigure
          value={String(total)}
          label={strings.availableLabel}
          loading={loading}
          colors={colors}
        />
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
            loading={loading}
            onPress={onTrophyPress ? () => onTrophyPress(trophy.id) : undefined}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  // The family's shared top — the summary card's fill sits where Settings'
  // first header box does (see SCREEN_CONTENT_TOP).
  content: {
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: SCREEN_CONTENT_TOP,
  },
  // The centred summary card: figure | ring | figure on the row surface,
  // with air below before the trophy card starts.
  header: {
    alignItems: 'center',
    borderRadius: OUTER_RADIUS,
    flexDirection: 'row',
    gap: SUMMARY_COLUMN_GAP,
    justifyContent: 'center',
    marginBottom: 16,
    paddingVertical: 20,
  },
  // Both columns take the SAME width so the block is symmetric and the ring
  // lands on the screen's centre (the iOS block's own rule — left to hug
  // their labels, "Available" pulls the group off-centre).
  figure: { alignItems: 'center', gap: 2, width: FIGURE_WIDTH },
  figureBone: { gap: 6, justifyContent: 'center', minHeight: 46 },
  figureValue: { ...TEXT_VARIANTS.titleLarge, fontWeight: '600' },
  figureLabel: TEXT_VARIANTS.bodySmall,
  ring: {
    alignItems: 'center',
    height: RING_SIZE,
    justifyContent: 'center',
    width: RING_SIZE,
  },
  ringLabel: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: { ...TEXT_VARIANTS.titleLarge, fontWeight: '600' },
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
  // `titleMedium` / `bodySmall` — the ladder's own rungs for a row title and
  // its supporting line, and what lets the bones ghost-measure the same box.
  title: TEXT_VARIANTS.titleMedium,
  supporting: TEXT_VARIANTS.bodySmall,
});
