import { StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  Button,
  Form,
  Gauge,
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
  frame,
  gaugeStyle,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listSectionMargins,
  listSectionSpacing,
  scrollContentBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { FormDisclosureIndicatorIos, SkeletonBone } from '@portfolio/mobile-ui';

import { tierColor } from './tierColors';
import {
  type TrophiesScreenProps,
  type TrophiesScreenColors,
  type TrophiesScreenStrings,
} from './TrophiesScreen';
import { TrophyIcon } from './TrophyIcon';
import { type ResolvedTrophy, type TrophyTier } from './types';

/**
 * iOS counterpart of `TrophiesScreen` — same prop API. The trophy list is a
 * REAL SwiftUI inset-grouped `Form` (the exact chrome the shared Settings
 * screen uses: system cell background, separators, radius, press highlight).
 * The trophy glyph (react-native-svg) bridges into each row via RNHostView.
 *
 * THE PROGRESS SUMMARY LIVES INSIDE THE FORM, which is what makes this screen
 * one scroller instead of two stacked boxes. It was a plain RN block ABOVE the
 * Form, and that cost the sheet its bar: pinned chrome over a scroller slides
 * under a transparent nav bar, so the route had to carry `pinnedHeader` — an
 * OPAQUE bar, no scroll-edge effect, and a title that could not collapse, on
 * the one sheet in the account family that behaved that way. Inside the Form,
 * UIKit tracks the scroll again and the bar is Liquid Glass like every other
 * sheet's.
 *
 * IT IS THE SCREEN'S OPENING BLOCK, NOT THE LIST'S HEADER. It spent a while as
 * a `Section` header, and that is precisely why it read as a caption however
 * large the type got: a grouped header is structurally a LABEL FOR THE THING
 * BELOW IT, so scale can never promote it. As its own section with the row's
 * fill cleared, its insets zeroed and its separator hidden, the same pixels
 * become page content — the screen's headline, with the list as its body.
 *
 * IT IS STILL NOT A CARD. Boxing it read as a stray pill breaking the page flow
 * (user-flagged, and still true), which is why the row's background is cleared
 * rather than left to the grouped default.
 *
 * THE SUMMARY IS A RING, NOT A BAR. It went headline + hand-painted track, then
 * headline + a real `ProgressView`, and the second was native but still the
 * wrong SHAPE: a labelled bar is the Material vocabulary for progress, and it
 * read as one on a screen that is otherwise all grouped iOS chrome. Apple's own
 * answer to "how much of this is done" is the Activity ring, and SwiftUI ships
 * it as `Gauge(circularCapacity)`.
 *
 * The layout is Fitness's: ring, then the count beside it, then the metrics
 * under the count. Those metrics are data the screen already held and threw
 * away — every trophy knows its tier, so "7 of 7" can say WHICH seven. See the
 * header itself for why they wear tier colour.
 */
const ICON_SIZE = 26;
const ICON_SLOT = 34;

/**
 * THE PROGRESS HEADER'S OWN GEOMETRY, for the ONE bridged host that stands it
 * while the award cache loads.
 *
 * The header is a native `Gauge` + `Text` once the counts are real — the
 * platform primitives, which is the whole reason the summary moved into the
 * `Section` in the first place. It cannot ALSO bone its parts in place:
 * a bridged host per figure is a second and third `RNHostView` in one row, and
 * that blew the layout apart (titles clipped off the leading edge, the icon
 * slot gone, the header collapsed to a stub). One host per row is the ceiling.
 *
 * So the loading header is a SINGLE host holding the whole summary in RN — a
 * disc for the ring and two bars for the count and the pips — and the numbers
 * here exist to land it exactly where the native one sits. Verified by
 * band-scan (iPhone 17 / iOS 26.5): card top 218.0 and every separator
 * identical between the two states.
 *
 * The header content box is 338 wide at a 32pt inset — the grouped header's
 * inset, not the card's 18. Re-measure if the header's type or
 * `headerProminence` changes.
 */
/**
 * A CLEARED ROW FILL. `listRowBackground` takes a colour string, so "no card"
 * is a fully transparent one — which is what turns the summary's row from a
 * grouped cell into page content.
 */
const TRANSPARENT = '#00000000';

const HEADER_INSET = 32;
/**
 * The headline's line box — what the two figures sit in. SOLVED, not guessed:
 * at 22 the bar landed 182.0 against the native header's 180.33 and the card
 * followed it down by the same 1.67, so the box is that much smaller.
 */
const HEADER_LINE_BOX = 22;
/**
 * The ring. `circularCapacity` is the Activity/Fitness gauge — Apple's own
 * answer to "how much of this is done", and the reason the summary stopped
 * being a linear bar: a `ProgressView` under a headline is the Material shape
 * for progress, and it read as one on a screen that is otherwise all native
 * grouped chrome.
 *
 * An accessory gauge draws small by default, so the frame states the size the
 * header wants rather than accepting the widget one.
 */
const RING_SIZE = 64;
/**
 * THE GAP FROM THE SUMMARY DOWN TO THE LIST — a SECTION gap, not a header gap.
 *
 * This chased the wrong reference for two rounds. The brief was "match Home's
 * user-row-to-card gap", and it does measure ~10 there — but that relationship
 * is the OPPOSITE of this one. Home's owner row is a HEADER BOUND TO ITS CARD,
 * and its gap is deliberately tight for exactly that reason:
 * `OWNER_ROW_CARD_GAP` is 4, and its own note says "a header belongs to its
 * content; 4 puts it 9pt off its first card against the cards' 12".
 *
 * The summary is not that. The whole point of promoting it out of the section
 * header was that it does NOT own the list — it is the screen's headline and
 * the list is the body, two independent blocks. Binding them at 10pt contradicts
 * the promotion, which is why it read as stuck to the list.
 *
 * So the reference is what iOS puts between two SECTIONS. Band-scanned on
 * iPhone 17 / iOS 26.5:
 *
 *   Account sheet, card → card   30.67   ← same family, same native Form
 *   a real iOS grouped list      31.33   (already recorded in home/index.ios)
 *
 * Solved rather than nudged: the mapping is exactly 1:1 (spacing 0 → 10.67,
 * spacing 24 → 34.67), so 20 lands 30.67. Verified.
 */
const SUMMARY_TO_LIST_GAP = 20;

/**
 * THE SUMMARY'S OWN TOP MARGIN — zero, because the section supplies its own.
 *
 * Promoting the summary out of the section header cost it the header's tighter
 * top inset and gave it the grouped list's, which dropped the first ink from
 * 151.00 to 184.00 — 33pt lower than it sat as a header, and far below where
 * the sibling sheets open. Band-scanned first content ink, iPhone 17 /
 * iOS 26.5:
 *
 *   Account   145.67    Trash  177.00 (a card, no header above it)
 *   Trophies  184.00 before this, 145.00 with it
 *
 * The account sheet is the right reference: it is the same family, and it opens
 * with a label above a card exactly as this now opens with a summary above one.
 */
const SUMMARY_TOP_MARGIN = 0;

/** The ring → text gap, and the tier row's own rhythm. */
const HEADER_ROW_GAP = 16;
const TIER_PIP_GAP = 12;
const TIER_GLYPH_SIZE = 12;
/** The count over the pips, inside the header's text column. */
const HEADER_TEXT_GAP = 6;
/** The pip row's own line box, and what its bone spans across four tiers. */
const TIER_PIP_LINE_BOX = 20;
const TIER_PIP_ROW_WIDTH = 132;

/**
 * PLATINUM FIRST, then down — PlayStation's order, which is the vernacular this
 * trophy module is built in, and it puts the rarest thing where the eye lands.
 */
const TIER_ORDER: TrophyTier[] = ['platinum', 'gold', 'silver', 'bronze'];

const TrophyRow = ({
  trophy,
  colors,
  strings,
  formatDate,
  loading,
  onPress,
}: {
  trophy: ResolvedTrophy;
  colors: TrophiesScreenColors;
  strings: TrophiesScreenStrings;
  formatDate: (achievedAt: number) => string;
  loading: boolean;
  onPress?: () => void;
}) => {
  const tierName = strings.tierNames[trophy.tier];

  const supporting = trophy.unlocked
    ? `${tierName} · ${strings.achievedLabel} ${formatDate(trophy.achievedAt ?? 0)}`
    : `${tierName} · ${trophy.description}`;

  const iconColor = trophy.unlocked
    ? tierColor(trophy.tier)
    : colors.onSurfaceMuted;

  /**
   * The title bar is sized from the title it stands for — the row already HAS
   * the string (it comes from config and copy, not the network), so the bones
   * vary down the card the way the real names do instead of reading as a
   * printed form. An approximation of the settled ink, not a measurement of it:
   * what has to be exact is the row's HEIGHT, which the line boxes below pin.
   */
  const titleBoneWidth = Math.min(140, Math.max(56, trophy.title.length * 9));

  return (
    <Button onPress={onPress}>
      <HStack spacing={12}>
        {loading ? (
          /**
           * THE WHOLE ROW'S CONTENT IN ONE HOST — icon, title and supporting
           * line together, because a row is either loading or it is not.
           *
           * This was a half-skeleton: a boned icon beside the REAL title and
           * subtitle, greyed. It read as broken rather than as loading, and the
           * subtitle was worse than cosmetic — it says "Earned Jul 16, 2026",
           * which is exactly the fact the row is waiting on, printed next to a
           * placeholder claiming to know nothing.
           *
           * The reason it ended up that way is the `RNHostView` ceiling: a
           * SECOND host in this row blows the native layout apart (titles
           * clipped off the leading edge, the icon slot gone). The answer is
           * the one the progress header already uses — not fewer bones, but ONE
           * host holding the whole RN sub-layout. The `Form` still owns the
           * card, the separators and the insets, so only the row's own content
           * is hand-sized.
           *
           * THE BOX IS RESERVED IN SWIFTUI, NOT MEASURED FROM RN. `matchContents`
           * makes a host "update its size in the React Native view tree to match
           * the children's" — an UPDATE, i.e. after the fact — so the row laid
           * out once without it and again once it arrived, which is a shift on
           * the frame the placeholder mounts and exactly the intermittent one
           * Juan saw stepping the states. Framing the wrapper and letting the
           * host fill it (its default) takes the measurement off the layout path
           * for good. Same reasoning as `SHEET_BONE_TOP`: never put an async
           * answer where a static one will do.
           */
          <VStack
            modifiers={[
              frame({ width: ROW_BONE_WIDTH, height: ROW_BONE_HEIGHT }),
            ]}
          >
            <RNHostView>
              <View style={styles.rowBone}>
                <View style={styles.iconSlot}>
                  <SkeletonBone
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    radius={ICON_SIZE / 2}
                  />
                </View>
                <View style={styles.rowBoneText}>
                  {/* Each bar sits in the LINE BOX of the text it stands for, so
                    the row keeps the height it settles at — a bar is drawn
                    thinner than its glyphs, which is why the box and the bar
                    are two numbers. */}
                  <View style={styles.titleLine}>
                    <SkeletonBone width={titleBoneWidth} height={15} />
                  </View>
                  <View style={styles.supportingLine}>
                    <SkeletonBone width={SUPPORTING_BONE_WIDTH} height={11} />
                  </View>
                </View>
              </View>
            </RNHostView>
          </VStack>
        ) : (
          <>
            <VStack
              modifiers={[frame({ width: ICON_SLOT, height: ICON_SLOT })]}
            >
              <RNHostView>
                <View style={styles.iconSlot}>
                  <TrophyIcon
                    color={iconColor}
                    size={ICON_SIZE}
                    locked={!trophy.unlocked}
                  />
                </View>
              </RNHostView>
            </VStack>
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
          </>
        )}
        <Spacer />
        {/* The one chevron definition the portfolio has — the same glyph the
            account sheet's own rows draw, rather than a local size constant
            that can drift a point away from them. */}
        <FormDisclosureIndicatorIos color={colors.onSurfaceMuted} />
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
  loading = false,
  onTrophyPress,
}: TrophiesScreenProps) => {
  const fraction = total > 0 ? earned / total : 0;

  /**
   * EARNED per tier — what the pips count. Derived here rather than asked of
   * the caller: every app that has trophies has tiers, and the screen already
   * holds the resolved list, so a prop would only be a second place for the
   * two to disagree.
   */
  const earnedByTier = TIER_ORDER.reduce<Record<TrophyTier, number>>(
    (acc, tier) => ({
      ...acc,
      [tier]: trophies.filter(t => t.tier === tier && t.unlocked).length,
    }),
    {} as Record<TrophyTier, number>,
  );
  const { width: screenWidth } = useWindowDimensions();
  const headerWidth = screenWidth - HEADER_INSET * 2;

  return (
    <Host style={styles.host}>
      <Form
        modifiers={[scrollContentBackground('hidden'), tint(colors.primary)]}
      >
        {/**
         * THE SUMMARY IS THE SCREEN'S OPENING BLOCK, not the list's header.
         *
         * It WAS a `Section` header, and that is why it read as a caption no
         * matter how large the type got: a grouped header is structurally a
         * LABEL FOR THE THING BELOW IT, so scale alone could never promote it.
         * As its own section with the row's fill cleared, its insets zeroed and
         * its separator hidden, the same pixels stop being a label and become
         * page content — the screen's headline, with the list reading as its
         * body. It is deliberately NOT given a card: that was tried and read as
         * a stray pill breaking the page flow.
         */}
        <Section
          modifiers={[
            listSectionMargins({ edges: 'top', length: SUMMARY_TOP_MARGIN }),
            listSectionSpacing(SUMMARY_TO_LIST_GAP),
          ]}
        >
          <VStack
            modifiers={[
              listRowBackground(TRANSPARENT),
              listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }),
              listRowSeparator('hidden'),
            ]}
          >
            {loading ? (
              <VStack
                modifiers={[frame({ width: headerWidth, height: RING_SIZE })]}
              >
                <RNHostView>
                  <View style={[styles.headerBone, { width: headerWidth }]}>
                    {/* Stands the ring, then the count over the pip row —
                        the same three things the settled summary shows, in
                        the same places. */}
                    <SkeletonBone
                      width={RING_SIZE}
                      height={RING_SIZE}
                      radius={RING_SIZE / 2}
                    />
                    <View style={styles.headerBoneText}>
                      <View style={styles.headerHeadlineLine}>
                        <SkeletonBone width={140} height={15} />
                      </View>
                      <View style={styles.headerPipLine}>
                        <SkeletonBone width={TIER_PIP_ROW_WIDTH} height={12} />
                      </View>
                    </View>
                  </View>
                </RNHostView>
              </VStack>
            ) : (
              /**
               * RING + COUNT + TIER PIPS — Fitness's own summary layout: the
               * gauge carries the fraction, the count beside it is the
               * screen's headline, and the metrics sit under the headline.
               *
               * The pips are real data the screen already had and was throwing
               * away: every trophy knows its tier, so "7 of 7" can say WHICH
               * seven. They wear `tierColor`, the same colours the row icons
               * use, so the summary needs no legend — and platinum leads,
               * PlayStation's order, which is the vernacular this module is
               * built in.
               */
              <HStack alignment="center" spacing={HEADER_ROW_GAP}>
                <Gauge
                  value={fraction}
                  // The percent lives INSIDE the ring, which is what the
                  // `currentValueLabel` slot is for — it fills a centre that
                  // otherwise reads as a decorative circle, and it keeps the
                  // figure the old header showed instead of dropping it.
                  currentValueLabel={
                    <Text
                      modifiers={[
                        font({ textStyle: 'caption', weight: 'semibold' }),
                        foregroundStyle(colors.onSurface),
                      ]}
                    >
                      {strings.percent}
                    </Text>
                  }
                  modifiers={[
                    gaugeStyle('circularCapacity'),
                    tint(colors.primary),
                    frame({ width: RING_SIZE, height: RING_SIZE }),
                  ]}
                />
                <VStack alignment="leading" spacing={HEADER_TEXT_GAP}>
                  {/* `title3` semibold — one step above the `headline` it wore
                      as a caption, and no further: the STRUCTURE carries the
                      importance now (page content, not a section header), so
                      the type does not have to shout. It was briefly `title`
                      bold and read as oversized against the list. */}
                  <Text
                    modifiers={[
                      font({ textStyle: 'title3', weight: 'semibold' }),
                      foregroundStyle(colors.onSurface),
                    ]}
                  >
                    {strings.progress}
                  </Text>
                  <HStack spacing={TIER_PIP_GAP}>
                    {TIER_ORDER.map(tier => (
                      <HStack key={tier} spacing={3}>
                        <Image
                          systemName="trophy.fill"
                          size={TIER_GLYPH_SIZE}
                          color={tierColor(tier)}
                        />
                        <Text
                          modifiers={[
                            font({ textStyle: 'subheadline' }),
                            foregroundStyle(tierColor(tier)),
                          ]}
                        >
                          {String(earnedByTier[tier])}
                        </Text>
                      </HStack>
                    ))}
                  </HStack>
                </VStack>
                <Spacer />
              </HStack>
            )}
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
              loading={loading}
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

/** The supporting line is one sentence at footnote size, whatever the row. */
const SUPPORTING_BONE_WIDTH = 160;
/** The native row's own artwork→text gap. */
const ROW_BONE_GAP = 12;
/** The bone row's own box, reserved in SwiftUI — see the note on the host. */
const ROW_BONE_WIDTH = ICON_SLOT + 12 + SUPPORTING_BONE_WIDTH;
/**
 * THE ROW'S CONTENT HEIGHT — solved from the rendered list, not from the line
 * boxes it holds.
 *
 * Stacking the boxes (22 + 2 + 18 = 42) put every separator 4pt low and the
 * pitch at 72 against the native 68. Band-scanned on iPhone 17 / iOS 26.5, the
 * `Form`'s separators sit 68 apart, of which 1 is the separator itself and
 * 2 × 14.5 is the grouped row's own vertical padding (the same 14.5
 * `PersonListSkeletonIos` measured for its people rows) — so the content it
 * wraps is 68 − 1 − 29 = 38, and the two text boxes are simply drawn tighter
 * than their nominal line heights.
 *
 * IT STAYS 38 even though that leaves a third of a point on the table, and the
 * alternative is the instructive part. Band-scanned separators, live against
 * the bone:
 *
 *   38     261.67 / 329.67 / 397.67 / 465.67   pitch 68.00, a CONSTANT +0.34
 *   37.67  261.33 / 329.00 / 396.67 / 464.67   row one exact, pitch 67.67
 *
 * So 37.67 buys a perfect first row and spends it on a pitch that drifts, which
 * compounds down the card and is the worse defect by far — the eye reads
 * accumulating separator error long before it reads one device pixel at the
 * top. A constant sub-pixel offset with an exact pitch is the trade to take.
 */
const ROW_BONE_HEIGHT = 38;

const styles = StyleSheet.create({
  host: { flex: 1 },
  /**
   * EXPLICIT BOX, no `gap` and no measuring. `RNHostView`'s `matchContents`
   * sizes from the RN tree, and handed a nested flex row it dropped the leading
   * child entirely — the icon bone vanished and the text slid into its slot
   * (seen on iPhone 17 / iOS 26.5). Stating the row's own width and height, and
   * spacing with margins rather than `gap`, leaves it nothing to work out.
   */
  rowBone: {
    alignItems: 'center',
    flexDirection: 'row',
    height: ROW_BONE_HEIGHT,
    width: ICON_SLOT + ROW_BONE_GAP + SUPPORTING_BONE_WIDTH,
  },
  rowBoneText: { marginLeft: ROW_BONE_GAP },
  // The body and footnote line boxes the native row stacks.
  titleLine: { height: 22, justifyContent: 'center' },
  supportingLine: { height: 18, justifyContent: 'center' },
  /** Explicit box, margins not `gap` — see `rowBone` for why. */
  headerBone: {
    alignItems: 'center',
    flexDirection: 'row',
    height: RING_SIZE,
  },
  headerBoneText: { marginLeft: HEADER_ROW_GAP },
  headerHeadlineLine: { height: HEADER_LINE_BOX, justifyContent: 'center' },
  headerPipLine: {
    height: TIER_PIP_LINE_BOX,
    justifyContent: 'center',
    marginTop: HEADER_TEXT_GAP,
  },
  iconSlot: {
    alignItems: 'center',
    height: ICON_SLOT,
    justifyContent: 'center',
    width: ICON_SLOT,
  },
});
