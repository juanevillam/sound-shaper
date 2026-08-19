import { StyleSheet, View } from 'react-native';

import {
  Button,
  Form,
  Gauge,
  Host,
  HStack,
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
  scaleEffect,
  scrollContentBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import {
  FormDisclosureIndicatorIos,
  GROUPED_ROW,
  SkeletonBone,
} from '@portfolio/mobile-ui';

import { tierColor } from './tierColors';
import {
  type TrophiesScreenProps,
  type TrophiesScreenColors,
  type TrophiesScreenStrings,
} from './TrophiesScreen';
import { TrophyIcon } from './TrophyIcon';
import { type ResolvedTrophy } from './types';

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
/**
 * THE LEADING SLOT IS THE PORTFOLIO'S GROUPED-ROW SLOT, not a size of its own.
 *
 * This row is structurally the same row a person and a trashed top get: leading
 * media, a body line over a footnote, a chevron. It ran a 34pt slot against
 * everyone else's 44 all the same, so its titles started at 80.00 where a trash
 * row's start at 89.00 — two grouped lists one gesture apart in the same sheet
 * stack, with different text columns (band-scanned, iPhone 17 / iOS 26.5).
 *
 * THE GLYPH DOES NOT GROW WITH IT. 26 is the trophy's own size and the list
 * reads right at it; what had to be shared is the SLOT, because the slot is
 * what fixes where every row's text begins. The box is therefore 44 WIDE and
 * only as tall as the glyph — giving it the slot's 44pt height would push the
 * row's content past the text's 38 and stretch a pitch that is already correct.
 */
const ICON_SLOT = GROUPED_ROW.art;

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
/** Between each figure column and the ring. */
const SUMMARY_COLUMN_GAP = 14;
/**
 * BOTH FIGURE COLUMNS TAKE THE SAME WIDTH, so the group is symmetric and the
 * ring lands on the screen's centre.
 *
 * Left to hug their labels they are not: "Available" is wider than "Earned"
 * (and "Disponibles" wider still), which pulled the whole group left and put
 * the ring 5.33pt off centre — visible as a horizontal jump against the loading
 * state, where the columns are absent and the ring centres properly. Wide
 * enough for the longest label in any shipped locale.
 */
const FIGURE_WIDTH = 72;
/**
 * BOTH LABEL BONES TAKE ONE WIDTH. Sized to their real labels — 52 for
 * "Earned", 60 for "Available" — they made the two hosts different widths, and
 * a bridged host reports its CONTENT rather than the box it was given, so the
 * asymmetry pushed the ring 8.34pt right of where the settled one sits. Equal
 * bones, equal hosts, ring on the same centre in both states.
 */
const FIGURE_BONE_LABEL = 56;
/**
 * THE BOX THE RING SITS IN — and the ring does NOT scale with it.
 *
 * `circularCapacity` draws at its own intrinsic size whatever frame it is
 * given: band-scanned at 58.00 across a 116 frame AND at 58.00 across a 144
 * one. The frame only pads. So the box is sized to hold the SCALED ring plus
 * the row's breathing room, and `RING_SCALE` is the only thing that makes the
 * gauge bigger.
 */
const RING_SIZE = 116;
/**
 * How much bigger than the gauge draws itself. 58.00 intrinsic × this is the
 * ink the summary actually shows — and what the bone has to stand.
 */
const RING_SCALE = 1.55;
/** The gauge's intrinsic ink, measured — 58.00 at every frame size tried. */
const RING_INTRINSIC = 58;
/** What it ends up drawing, and therefore what the bone stands. */
const RING_INK = RING_INTRINSIC * RING_SCALE;
/**
 * THE GAP FROM THE SUMMARY DOWN TO THE LIST — the MIDDLE rung of the ladder.
 *
 * This took three passes and the two misses are the useful part, because each
 * matched a real relationship that was not this one:
 *
 *   ~10  Home's owner-row-to-card. A HEADER BOUND TO ITS CARD, tight on
 *        purpose — `OWNER_ROW_CARD_GAP` is 4 and its own note says "a header
 *        belongs to its content". The summary was that once and is not now, so
 *        it read as stuck to the list.
 *   ~31  What iOS puts between two SECTIONS (account sheet card→card 30.67, a
 *        real grouped list 31.33). Correct for two UNRELATED blocks — and these
 *        two are not unrelated: the summary is the headline OF this list.
 *
 * The screen's own ladder already names the rung in between — `card 12 <
 * person 20 < section 28` (see `PERSON_GAP` in home/index.ios). 20 is the
 * division that groups without separating, which is exactly a headline and its
 * body.
 *
 * Solved rather than nudged: the mapping is exactly 1:1 (spacing 0 → 10.67,
 * 24 → 34.67), so 9.33 lands 20.00. Verified.
 */
const SUMMARY_TO_LIST_GAP = 9.33;

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
      <HStack spacing={GROUPED_ROW.artGap}>
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
              modifiers={[frame({ width: ICON_SLOT, height: ICON_SIZE })]}
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
            {/**
             * THE RING AND ITS TWO FIGURES — how many earned, how many there
             * are, and the fraction between them.
             *
             * What it dropped was PlayStation's TIER TALLY, the row of four
             * trophy glyphs with counts beneath. On a console screen that also
             * shows the game, the player and a rarity column it earns its
             * place; here it sat directly above a list that already names every
             * trophy AND its tier.
             *
             * THE RING IS THE SUBJECT AND IS SIZED LIKE ONE. At 96 against two
             * 84-wide columns 28pt away it read as bullied by its own labels —
             * three elements of similar weight rather than a headline with
             * supporting figures. The gauge takes `RING_SIZE`, the columns pull
             * in to `SUMMARY_COLUMN_GAP` and narrow to what they need.
             *
             * BOTH COLUMNS TAKE THE SAME WIDTH so the group is symmetric and the
             * ring lands on the screen's centre. Left to hug their labels they
             * are not — "Available" is wider than "Earned", "Disponibles" wider
             * still — which pulled the group left and put the ring 5.33pt off
             * centre against the loading state.
             */}
            {/* THE ROW'S HEIGHT IS STATED, not left to its content. The ring
                is the tallest thing in it in both states, so this is a no-op
                once the gauge is there — but while loading the block is three
                bridged hosts, and hosts report their size after the fact, so
                without it the row collapsed and clipped the ring bone to a
                semicircle. */}
            <HStack
              alignment="center"
              spacing={SUMMARY_COLUMN_GAP}
              modifiers={[frame({ height: RING_SIZE })]}
            >
              <Spacer />
              {loading ? (
                <VStack
                  modifiers={[
                    frame({ width: FIGURE_WIDTH, height: RING_SIZE }),
                  ]}
                >
                  <RNHostView>
                    <View style={styles.figureBone}>
                      <SkeletonBone width={26} height={24} />
                      <SkeletonBone
                        width={FIGURE_BONE_LABEL}
                        height={12}
                        style={styles.figureBoneLabel}
                      />
                    </View>
                  </RNHostView>
                </VStack>
              ) : (
                <VStack
                  spacing={2}
                  modifiers={[frame({ width: FIGURE_WIDTH })]}
                >
                  <Text
                    modifiers={[
                      font({ textStyle: 'title2', weight: 'semibold' }),
                      foregroundStyle(colors.onSurface),
                    ]}
                  >
                    {String(earned)}
                  </Text>
                  <Text
                    modifiers={[
                      font({ textStyle: 'footnote' }),
                      foregroundStyle(colors.onSurfaceMuted),
                    ]}
                  >
                    {strings.earnedLabel}
                  </Text>
                </VStack>
              )}

              {/* THE RING IS BONED TOO, not drawn empty. An empty track is a
                  real gauge reading zero, and it read as disabled rather than
                  as waiting — a state, not a placeholder. A disc on the app's
                  own sweep says "loading" in the same language every other
                  surface uses. */}
              {loading ? (
                <VStack
                  modifiers={[frame({ width: RING_SIZE, height: RING_SIZE })]}
                >
                  <RNHostView>
                    <View style={styles.ringBone}>
                      <SkeletonBone
                        width={RING_INK}
                        height={RING_INK}
                        radius={RING_INK / 2}
                      />
                    </View>
                  </RNHostView>
                </VStack>
              ) : (
                <Gauge
                  value={fraction}
                  // The percent lives INSIDE the ring — the `currentValueLabel`
                  // slot — and scales with it: a `caption` sized for a 64pt
                  // gauge reads lost in this one.
                  currentValueLabel={
                    <Text
                      modifiers={[
                        font({ textStyle: 'title', weight: 'semibold' }),
                        foregroundStyle(colors.onSurface),
                      ]}
                    >
                      {strings.percent}
                    </Text>
                  }
                  modifiers={[
                    gaugeStyle('circularCapacity'),
                    tint(colors.primary),
                    scaleEffect(RING_SCALE),
                    frame({ width: RING_SIZE, height: RING_SIZE }),
                  ]}
                />
              )}

              {loading ? (
                <VStack
                  modifiers={[
                    frame({ width: FIGURE_WIDTH, height: RING_SIZE }),
                  ]}
                >
                  <RNHostView>
                    <View style={styles.figureBone}>
                      <SkeletonBone width={26} height={24} />
                      <SkeletonBone
                        width={FIGURE_BONE_LABEL}
                        height={12}
                        style={styles.figureBoneLabel}
                      />
                    </View>
                  </RNHostView>
                </VStack>
              ) : (
                <VStack
                  spacing={2}
                  modifiers={[frame({ width: FIGURE_WIDTH })]}
                >
                  <Text
                    modifiers={[
                      font({ textStyle: 'title2', weight: 'semibold' }),
                      foregroundStyle(colors.onSurface),
                    ]}
                  >
                    {String(total)}
                  </Text>
                  <Text
                    modifiers={[
                      font({ textStyle: 'footnote' }),
                      foregroundStyle(colors.onSurfaceMuted),
                    ]}
                  >
                    {strings.availableLabel}
                  </Text>
                </VStack>
              )}
              <Spacer />
            </HStack>
          </VStack>
        </Section>

        {/* UNTITLED. With one section on the screen a header only labels the
            obvious — the sheet's own title already says Trophies. */}
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
const ROW_BONE_GAP = GROUPED_ROW.artGap;
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
  /**
   * THE SUMMARY BONES. Each sits in its OWN `RNHostView` — three hosts in this
   * block, which is above the one-per-row ceiling everywhere else, and is why
   * they are three separate small trees rather than one: a single host holding
   * the whole summary rendered BLANK here, through eight builds of explicit
   * boxes, `matchContents` on and off, cleared insets, an opaque row fill and
   * both `VStack` and `HStack` parents. Split per element they draw.
   */
  /**
   * Each bone box is the ring's HEIGHT, so all three hosts report the same box
   * and the `HStack`'s centre alignment has something to centre. Left to hug
   * their content the figure hosts sat at the top of the row while the ring
   * bone centred, because a host's own height arrives after the fact.
   */
  figureBone: {
    alignItems: 'center',
    height: RING_SIZE,
    justifyContent: 'center',
    width: FIGURE_WIDTH,
  },
  figureBoneLabel: { marginTop: 8 },
  /**
   * The disc stands the ring's INK, inside a box the size of its FRAME. A
   * `circularCapacity` gauge draws well inside the frame it is given — band
   * scanned at 58.00 across a 116 frame — so a bone at `RING_SIZE` came out
   * twice the ring it replaces. The box keeps the row's height either way.
   */
  /**
   * The disc stands the ring's INK inside a box the size of its FRAME. A
   * `circularCapacity` gauge draws well inside the frame it is given — band
   * scanned at 58.00 across a 116 frame — so a bone at `RING_SIZE` came out
   * twice the ring it replaces.
   *
   * The SLOT is reserved in SwiftUI (see the framed `VStack` around the host),
   * not measured from here: left to report their own size the three hosts gave
   * the row widths that were neither live's nor each other's, and the ring
   * landed 8.34 right at one guess and 20.00 left at the next.
   */
  ringBone: {
    alignItems: 'center',
    height: RING_SIZE,
    justifyContent: 'center',
    width: RING_SIZE,
  },
  iconSlot: {
    alignItems: 'center',
    height: ICON_SIZE,
    justifyContent: 'center',
    width: ICON_SLOT,
  },
});
