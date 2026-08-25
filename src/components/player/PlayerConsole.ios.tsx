import { useEffect } from 'react';

import { Pressable, StyleSheet, View } from 'react-native';

import { withAlpha } from '@portfolio/core';
import {
  AppIcon,
  FLOATING_RADIUS,
  GlassSurfaceIos,
  SwiftUIHost,
  usePressSquash,
} from '@portfolio/mobile-ui';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClipActionsRow } from '@/components/player/ClipActionsRow';
import {
  ClipTrimFrameIos,
  TRIM_FRAME_HEIGHT,
} from '@/components/player/ClipTrimFrameIos';
import { GlyphButton } from '@/components/player/GlyphButton';
import { PlayerScrubberLive } from '@/components/player/PlayerScrubberLive';
import {
  NextGlyph,
  PauseGlyph,
  PlayGlyph,
  PreviousGlyph,
} from '@/components/player/TransportGlyphs';
import { Text as AppText } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { formatTime } from '@/lib/player';
import { usePlayerStore } from '@/store/player';
import { opticalTextInset } from '@/styles/metrics';
import { CONTINUOUS_CURVE, HAIRLINE } from '@/styles/shape';

import { bannerBottomOffset, MINI_PLAYER_HEIGHT } from './bannerMetrics';
import {
  IOS_SLIDER_HOST_HEIGHT,
  PLAYER_SIDE_PADDING,
  playerArtRadius,
  playerArtSize,
  type PlayerCard,
  type PlayerConsoleProps,
} from './chrome';

// ---------------------------------------------------------------------------
// THE iOS EXPANDED CONSOLE.
//
// Not Android's console with iOS parts swapped in — a different surface. What
// was here before was a Material now-playing screen: a 64pt filled FAB for
// play, two outlined cards for the studios, `colors.primary` on every glyph,
// and the whole column top-loaded so that 164pt of the screen below it was
// empty (band-scanned, iPhone 17 / iOS 26.5: content ended at 676 on an 874pt
// screen). Android keeps all of that, deliberately — see `PlayerConsole.tsx`.
//
// Four rules decide what replaced it:
//
// 1. ONE CONTENT BOX. The artwork, the title, the scrubber, the transport and
//    the footer all run to the same two edges, and that inset is the app's own
//    screen gutter — which is also the collapsed banner's, so the surface's
//    sides never move as it expands. The artwork's size is therefore a RULE
//    (as wide as the box) rather than the fraction-with-nothing-under-it it
//    replaced. See `chrome.ts`.
//
// 2. THE COLUMN FILLS THE SCREEN. Two flexible spacers put the transport
//    between the scrubber and the footer and stand the footer on the bottom
//    inset, so the reclaimed space is distributed as air instead of left in
//    one dead lump at the bottom.
//
// 3. NO ACCENT. Apple does not tint a now-playing screen's controls — it tints
//    the BACKGROUND from the artwork (which `PlayerBackdrop` already does) and
//    leaves every control monochrome on top. So the fix for "everything is
//    system blue" is to delete the accent, not to extract one: the transport,
//    the scrubber and the footer all take `onSurface` over the wash.
//
// 4. NO BAR ROW. There is nothing above the artwork but the artwork.
//
//    The row that stood here carried `chevron.down` leading and an overflow
//    `Menu` trailing, at the portfolio's 43pt bar target. Juan removed it
//    (2026-08-21): a personal player has no bar's worth of work to put in one,
//    the drag already puts the player away, and two glyphs floating over the
//    wash were the busiest thing on an otherwise calm screen. It also hands
//    43pt back to the column below, which is where the transport and the
//    footer wanted it.
//
//    Two earlier occupants of the same slot were built and rejected before it:
//    a sheet GRABBER, because this surface has a bottom sheet's dismiss gesture
//    but is not a sheet and a grabber is UIKit's promise that it is one; and
//    the original row built on `IconButton`, which wraps a `matchContents`
//    Host, so a re-render moved the whole row 79pt (measured: chevron ink
//    centre 87.67 on a fresh launch, 166.67 after a live appearance change,
//    with the artwork unmoved). That trap is the reason every host on this
//    screen still states its box.
//
//    THE MENU'S TWO ENTRIES DID NOT SURVIVE IT IN THE SAME WAY. Edit is the
//    glass bar's third compartment (see `GlassFooter`). Info had nowhere to go
//    and nothing left to say: it listed artist, album and release year, and the
//    app no longer handles the last two, so what remained was the title and
//    artist already set two lines below the cover. The iOS route is gone.
//
//    WHAT THIS COSTS is the only dismiss control VoiceOver and Switch Control
//    could reach — this is not a real UIKit sheet, so nothing publishes a
//    dismiss action on its behalf. The drag zone above the artwork carries it
//    now, as a labelled button, and the console answers the two-finger-Z
//    escape gesture, which is Apple's own dismiss.
// ---------------------------------------------------------------------------

/* -------------------------------------------------------------------------- */
/*  Type — Apple's ladder, stepped, never derived from a container's width.    */
/* -------------------------------------------------------------------------- */

/**
 * The sound's name and its artist, which this app typesets in three places.
 * The home tile pairs `body`/`subheadline` (17/15) and so does the collapsed
 * banner. The console is the one surface where the pair is the SCREEN'S
 * subject rather than a row's label, so it steps up to `title2`/`body` —
 * 22/17, both named steps, with Apple's own leading (28/22).
 *
 * `title1` (28) HAS BEEN RENDERED AND REJECTED TWICE ON THIS SURFACE — once
 * for competing with the artwork instead of captioning it, and again on
 * 2026-08-25 after the column around it had opened up (the cover at 12pt
 * under the island, the scrubber without its thumb, a larger transport).
 * Juan's verdict both times was the same on sight: too big.
 *
 * DO NOT DERIVE THIS RUNG FROM THE COVER'S SIZE. The argument for 28 was the
 * app's own caption precedent — the home grid stepped 14 to 17 when its cover
 * grew 124 to 178, so a 370pt cover "wants" about 26 and the ladder offers
 * only 22 or 28. That reasoning is what produced the second rejection. A
 * now-playing title is not a caption on a tile: the cover is already the
 * subject, and the copy's job is to name it quietly, so the ratio falling as
 * the picture grows is correct rather than a deficit to correct for.
 *
 * 22/17 — `title2` over `body`, both named rungs with Apple's own leading.
 */
const TITLE_SIZE = 22;
const TITLE_LEADING = 28;
const ARTIST_SIZE = 17;
const ARTIST_LEADING = 22;

/**
 * TRANSPORT — three controls of equal weight, no filled disc.
 *
 * The FAB this replaces was Material's, and it broke the row twice over: a
 * filled 64pt circle made play the only control with a background, and the
 * 19pt symbol inside it occupied 0.30 of its own disc, so the glyph read as
 * undersized in a button that read as oversized.
 *
 * Play is still primary — it just says so with SIZE rather than with a fill,
 * which is how a symbol-based transport carries hierarchy. These are SF point
 * sizes; `TransportGlyphs.ios` derives each glyph's box from its size.
 *
 * THEY GREW WITH THE SPACE AROUND THEM (2026-08-25). At 30/44 the row was
 * 195pt of a 370pt content box and read as floating in the console's lower
 * half rather than holding it — an imbalance that only appeared once the
 * cover moved up and the scrubber lost its thumb, freeing 26pt into exactly
 * those gaps. Apple's own video transport runs ~40pt of play ink against our
 * 35.67. At 34/52 the row is 228pt, and the taller box also takes ~10pt back
 * out of the flexible gaps it was floating in.
 *
 * This is GEOMETRY, so it scales with its box rather than stepping a ladder —
 * the rule that governs `artworkRadius`. A symbol has no Dynamic Type ramp to
 * break.
 */
const TRANSPORT_SKIP_SIZE = 34;
const TRANSPORT_PLAY_SIZE = 52;
/** Between the boxes, so the three read as one group rather than a spread row. */
const TRANSPORT_GAP = 34;

/**
 * THE TRANSPORT IS CENTRED OPTICALLY, NOT MATHEMATICALLY, and the difference is
 * what the eye anchors on.
 *
 * Two equal spacers centre it between the slider BLOCK and the footer, and
 * measured that way it already was: 51pt above the play glyph, 47 below. But
 * the bottom of the slider block is the small grey elapsed label, and nobody
 * reads that as the edge of anything — the eye takes the TRACK, the strong
 * horizontal above it. Measured from there it is 68 above against 47 below, and
 * the footer compounds it by being a solid 68pt slab whose mass starts
 * abruptly where the label's does not.
 *
 * So the lower spacer carries more weight, which lifts the row until the two
 * gaps that are actually LOOKED at come out even. Band-scanned after: see the
 * numbers on `spacerLower`.
 */
const SPACER_LOWER_WEIGHT = 1.55;

/* -------------------------------------------------------------------------- */
/*  The bar row                                                               */
/* -------------------------------------------------------------------------- */

/**
 * EDIT LIVES IN THE GLASS BAR, and it took two tries to get there.
 *
 * It was first hung beside the copy it edits — a `pencil` trailing the title
 * and artist — on the argument that the button should name its OBJECT. That is
 * sound reasoning and it still is; what it missed is that the console's whole
 * case is ONE floating control surface, and a lone glyph in the middle of the
 * screen is a second one. Juan called it: putting it in the bar leaves the UI
 * cleaner because there is less floating.
 *
 * So it is the bar's third compartment. It is NOT a third card — it carries no
 * label and no summary, because unlike Shape and Clips it has no live state to
 * say, and three cards on a 370pt bar leaves none of them room. The narrow
 * compartment is what makes it read as secondary; the INK stays `onSurface` at
 * the bar's own icon size, because a hand-muted glyph in a row of full-strength
 * ones reads as disabled, and `disabled(true)` is the only thing allowed to say
 * that.
 */

/* -------------------------------------------------------------------------- */
/*  The footer                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * THE FOOTER IS THE COLLAPSED BANNER'S BOX, EXACTLY — same width, same height,
 * same corner, same place on the screen.
 *
 * It very nearly was already, by accident: both are `SCREEN_PADDING` off each
 * edge and both take `FLOATING_RADIUS`, so width and corner agreed by
 * construction — and the two TOP edges happened to land on the same 764,
 * because `874 − 42 − 68` and `874 − 46 − 64` are two unrelated sums that
 * coincide. Juan spotted the near-match and asked whether it was deliberate. It
 * was not, and a coincidence that a change to any of those four numbers would
 * silently break is not a detail, it is a trap.
 *
 * So it is stated instead: the bar takes `MINI_PLAYER_HEIGHT` and the banner's
 * own bottom clearance, which makes expanding read as the glass bar staying
 * put while its contents change — the banner's title and transport out, the two
 * studios in. The same object, in the same place, in both states.
 */
const GLASS_FOOTER_HEIGHT = MINI_PLAYER_HEIGHT;
const GLASS_FOOTER_ICON = 24;
/**
 * The glyph's host STATES ITS BOX; it never takes `matchContents`.
 *
 * A host that measures its child answers on the LAYOUT PATH — it updates its
 * size in the RN tree after the fact — and this glyph is the first child of a
 * flex row whose label and summary sit beside it, so a late answer slides the
 * copy on the exact frame the content mounts. That is the family AGENTS.md
 * names, and the reason it is worth restating here is that the measurement
 * usually resolves same-frame: it survives a band-scan of the settled state
 * and is caught by eye instead.
 *
 * Same ratio and reasoning as `TransportGlyphs.ios`, which reserves its box
 * from the point size for the identical reason.
 */
const GLASS_FOOTER_ICON_BOX = Math.round(GLASS_FOOTER_ICON * 1.3);

type FooterProps = {
  cards: readonly PlayerCard[];
  /** Spoken name — the full phrase, not the bar's one word. */
  editA11yLabel: string;
  editLabel: string;
  onEdit: () => void;
  width: number;
};

/**
 * THE EDIT COMPARTMENT IS LABELLED, AND IT HUGS ITS CONTENT.
 *
 * It shipped as a bare `pencil` in a fixed 48pt slot, and Juan's objection was
 * the one that matters: you cannot tell what it does. A glyph with no word is a
 * guess, and this is the one control in the bar whose meaning is not carried by
 * the thing beside it.
 *
 * THREE EQUAL CARDS ARE THE OBVIOUS FIX AND THEY DO NOT FIT — measured twice.
 * Ink on iPhone 17 / iOS 26.5: "Shape" 46.33, "Flat · 1×" 50.67, "Clips" 35.67,
 * "None" 34.33. Three equal compartments are 123.33 each, and after 32 of
 * padding, the 31pt icon host and the 12pt gap that leaves 48.33 of copy — so
 * the DEFAULT shape summary truncates, never mind "Bright · 1.5×" at ~73.
 * Trimming the padding to 12 and the gap to 10 buys 61.33, which still loses
 * every preset that is not Flat at 1×.
 *
 * So the compartment is sized to what it holds instead, which is what a toolbar
 * does: icon, one word, and NO SUMMARY LINE. It has no live state to put there
 * — that is precisely what separates it from Shape and Clips, both of which
 * carry one ("Flat · 1×", "2 saved") — and a card that invents a second line to
 * match its neighbours' shape is worse than one that admits it has nothing to
 * say. Vertically centred, so a single line reads as deliberate beside two.
 *
 * It takes the same divider the two cards share. The bar had one divider and
 * then none, which is the asymmetry Juan called next.
 */
const GLASS_ROW_PADDING = 16;

/**
 * THE EDIT GLYPH IS OPTICALLY SIZED, and it is the one place in this bar that
 * states its own size rather than taking `GLASS_FOOTER_ICON`.
 *
 * A point size is a BOX, not an amount of ink, and SF Symbols fill their box by
 * wildly different amounts. Band-scanned at an identical 24 on iPhone 17 /
 * iOS 26.5:
 *
 *   tune      23.33 × 19.67   area 459
 *   scissors  30.00 × 22.67   area 680
 *   pencil    18.67 × 18.33   area 342
 *
 * `pencil` is a thin diagonal stroke with generous bearings, so at the same
 * point size it reads visibly smaller than either sibling — Juan caught it by
 * eye before this was measured. 28 brings its area to within a few percent of
 * `tune`'s (√(459/342) = 1.158 → 27.8), which is the nearer of the two; the
 * scissors are the outlier at the other end and matching THOSE would make the
 * pencil the biggest thing in the bar.
 *
 * SF Symbols' own guidance allows exactly this — optical adjustment so symbols
 * of different shapes read at equal weight. The host box stays
 * `GLASS_FOOTER_ICON_BOX`, so nothing about the layout moves.
 */
const GLASS_EDIT_ICON = 28;

/**
 * ONE MERGED LIQUID GLASS BAR — the same object as the banner this console
 * grew out of, and as Home's trailing pill: `GlassSurfaceIos` over the
 * portfolio's `GLASS_FLOOR`, no border and no shadow, because the material is
 * the edge. Merged rather than two capsules for the reason Home's is merged —
 * two floating objects side by side read as two decisions.
 *
 * SHAPE AND CLIPS ARE NOT APPLE MUSIC'S FOOTER, and that is why this is a bar
 * rather than a row of bare glyphs. AirPlay, lyrics and queue are incidental to
 * a music player; these two are the PRODUCT'S VERBS, and each carries live
 * state — "Flat · 1×", "3 Clips" — that a glyph alone cannot say.
 *
 * Two alternatives were built and rendered on device before this was chosen.
 * Folding the studios into the transport as two more equal-weight symbols with
 * `caption2` state beneath made a lopsided row (the summaries are wildly
 * different widths), put "change what plays" and "change how it sounds" at
 * identical weight, and — with nothing left to stand at the bottom — brought
 * back 132pt of the dead screen this rewrite exists to remove. Two grouped
 * value rows read best of the three and were rejected only for reading like a
 * Settings section under a now-playing screen.
 *
 * The material is decorative and pointer-transparent, so both halves are
 * ordinary `Pressable`s above it. They are CARDS by container, so they squash.
 */
function GlassFooter({
  cards,
  editA11yLabel,
  editLabel,
  onEdit,
  width,
}: FooterProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.glassFooter, { height: GLASS_FOOTER_HEIGHT, width }]}>
      <GlassSurfaceIos
        width={width}
        height={GLASS_FOOTER_HEIGHT}
        cornerRadius={FLOATING_RADIUS}
      />
      <View style={styles.glassRow}>
        {cards.map((card, index) => (
          <View key={card.key} style={styles.glassHalfSlot}>
            {index > 0 ? (
              <View
                style={[
                  styles.glassDivider,
                  { backgroundColor: withAlpha(colors.onSurface, 0.12) },
                ]}
              />
            ) : null}
            <GlassHalf card={card} />
          </View>
        ))}

        <View style={styles.glassEditSlot}>
          <View
            style={[
              styles.glassDivider,
              { backgroundColor: withAlpha(colors.onSurface, 0.12) },
            ]}
          />
          <GlassEdit
            a11yLabel={editA11yLabel}
            label={editLabel}
            onPress={onEdit}
          />
        </View>
      </View>
    </View>
  );
}

function GlassEdit({
  a11yLabel,
  label,
  onPress,
}: {
  a11yLabel: string;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  // THE CARD SQUASH, because this is a card now. It briefly took the ICON pair
  // (`ICON_PRESS_SCALE` / `ICON_PRESS_OPACITY`) and had to: as a lone 24pt
  // glyph the card's 3% is under a pixel and a half of travel and reads as no
  // feedback at all, which is how it first shipped. With a label beside it the
  // compartment is the same object as the two halves and takes their feedback,
  // or one press in the bar would dim and shrink while the others barely move.
  const squash = usePressSquash();

  return (
    <Animated.View style={[styles.glassHalf, squash.style]}>
      <Pressable
        accessibilityLabel={a11yLabel}
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={squash.onPressIn}
        onPressOut={squash.onPressOut}
        style={styles.glassEditPress}
      >
        {/* `AppIcon`, not a bare `Image` — the two cards beside it render
            through the shared icon component and this did not, which is how it
            ended up as the only glyph in the bar outside the portfolio's icon
            set. `edit` maps to `pencil` in `SF_SYMBOLS` already. */}
        <SwiftUIHost
          ignoreSafeArea="all"
          pointerEvents="none"
          style={styles.glassIconHost}
        >
          <AppIcon name="edit" size={GLASS_EDIT_ICON} tint={colors.onSurface} />
        </SwiftUIHost>
        <AppText doNotTranslate text={label} variant="bodyLarge" />
      </Pressable>
    </Animated.View>
  );
}

function GlassHalf({ card }: { card: PlayerCard }) {
  const { colors } = useAppTheme();
  const squash = usePressSquash();

  return (
    <Animated.View style={[styles.glassHalf, squash.style]}>
      <Pressable
        accessibilityLabel={`${card.label}, ${card.summary}`}
        accessibilityRole="button"
        onPress={card.onPress}
        onPressIn={squash.onPressIn}
        onPressOut={squash.onPressOut}
        style={styles.glassHalfPress}
      >
        {/* `SwiftUIHost` directly, not `ThemedHost`, for the reason
            `TransportGlyphs.ios` gives: this file is iOS-only, `ThemedHost`
            re-exports exactly this on iOS, and the type checker resolves the
            BASE specifier — so its Compose type is what a call site is checked
            against, and `ignoreSafeArea` does not exist there. */}
        <SwiftUIHost
          ignoreSafeArea="all"
          pointerEvents="none"
          style={styles.glassIconHost}
        >
          <AppIcon
            name={card.icon}
            size={GLASS_FOOTER_ICON}
            tint={colors.onSurface}
          />
        </SwiftUIHost>
        <View style={styles.glassCopy}>
          {/* BODY OVER FOOTNOTE (17 / 13) — THE TWO LINES ANSWER TO DIFFERENT
              CONSTRAINTS, so they do not step together.
          
              All three pairings were rendered on device. Body/Subheadline
              (17 / 15) read TIGHT once the bar gained a third cell — Juan's
              iPhone 15 is 393pt against the simulator's 402, so his content box
              is 361 and each card is ~4.5pt narrower than anything measured
              here. Subheadline/Footnote (15 / 13) fixed the width and read too
              SMALL. There is no rung between them: the ladder is Body 17,
              Subheadline 15, Footnote 13, and 16 / 14 was already rendered and
              rejected in this app for being off it (16 is `callout`; 14 is
              nothing).
          
              So the pair splits. The LABEL is short — "Shape" is 46.33 of ink
              against a copy box driven entirely by the summary — so keeping it
              at Body costs the cards nothing and is what gives the cell its
              presence. The SUMMARY is the long string, so it takes Footnote and
              buys the width. Body over Footnote is Apple's own list-row pair.
              The icons stay at 24 with the label they sit beside.
          
              STEPPED, NEVER SCALED: these are named rungs Dynamic Type moves as
              a unit, and deriving a point size from the bar's width would ship
              one Apple never draws and break the moment somebody raises their
              text size.
          
              Headline (17 SEMIBOLD) over Subheadline was tried when the bar had
              two items and is too much: a size step and a weight step at once,
              and the bar started shouting over the console above it. */}
          <AppText
            doNotTranslate
            text={card.label}
            variant="bodyLarge"
            numberOfLines={1}
          />
          <AppText
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

/* -------------------------------------------------------------------------- */

export function PlayerConsole({
  cards,
  clipMode,
  clipRange,
  consoleStyle,
  contentTop,
  expanded,
  neighbours,
  onClipCancel,
  onClipPreview,
  onClipRangeChange,
  onClipSave,
  onCollapse,
  onEdit,
  onNext,
  onPrevious,
  onSeek,
  onToggle,
  pagerStyle,
  playing,
  subtitle,
  title,
  titleGesture,
  topGesture,
  trimmerDuration,
  winW,
}: PlayerConsoleProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const contentWidth = playerArtSize(winW);
  /**
   * THE OPTICAL NUDGE UNDER THE COVER — the same correction the home tiles
   * take, and the console was the one surface under a rounded cover that never
   * took it.
   *
   * A corner curves the cover's edge inward exactly where this copy sits, so a
   * title set flush to the true edge reads as hanging past it. Measured on
   * device before the fix: a home tile's title ink sat 23 against its cover's
   * 16, while this one sat 18 — the 2pt was the glyph's own side bearing, not a
   * correction.
   *
   * It is BIGGER here than anywhere else in either app, and that follows from
   * the term rather than from taste: the nudge is derived from the radius it
   * compensates for, and this cover's radius is the largest in the portfolio
   * (56 against a home tile's 27), so the correction doubles to 12.
   */
  const copyInset = opticalTextInset(playerArtRadius(winW, 0));

  /**
   * THE TRIM FRAME'S LIVE EDGES, owned here because TWO children draw from
   * them: the frame itself, and the range readout in the scrubber's label
   * row. They are shared values rather than state for the console's standing
   * reason (`chrome.ts`) — a drag moves them at gesture rate, and routing
   * that through React would re-render this whole tree on every frame of
   * every trim. `clipRange` state is still the committed truth; these follow
   * it whenever it changes from outside a drag.
   */
  const clipStartSv = useSharedValue(clipRange.startS);
  const clipEndSv = useSharedValue(clipRange.endS);
  useEffect(() => {
    clipStartSv.value = clipRange.startS;
    clipEndSv.value = clipRange.endS;
  }, [clipRange.startS, clipRange.endS, clipStartSv, clipEndSv]);

  /**
   * The two SKIPS fade out while framing — see the transport row. A
   * TRANSFORM-free opacity, and the row keeps its height either way, so the
   * fade cannot move the play button beside them or anything below.
   */
  /**
   * IS THE CLIP PREVIEW SOUNDING? Read at the leaf, and it changes only when a
   * preview starts or stops — never on the position tick. While framing the
   * transport is the CLIP's control, so this and not `playing` decides both
   * the glyph and what a press does: pressing with nothing previewing always
   * (re)starts the selection from its start, which is what a trimmer's play
   * button means. Framing entry pauses the song (see the store's `pause`), so
   * the two states cannot disagree in practice — this just makes it explicit.
   */
  const previewing = usePlayerStore(
    s => s.playing && s.activeClip?.clipId === 'preview',
  );

  const skipStyle = useAnimatedStyle(
    () => ({ opacity: withTiming(clipMode ? 0 : 1, { duration: 200 }) }),
    [clipMode],
  );

  const copy = (sound: { artist: string; name: string }) => (
    <>
      <AppText
        doNotTranslate
        text={sound.name}
        numberOfLines={1}
        style={styles.title}
      />
      <AppText
        doNotTranslate
        muted
        text={sound.artist || ' '}
        numberOfLines={1}
        style={styles.artist}
      />
    </>
  );

  return (
    <Animated.View
      onAccessibilityEscape={onCollapse}
      style={[styles.console, consoleStyle]}
      pointerEvents={expanded ? 'auto' : 'none'}
    >
      {/* The drag-to-close zone — everything above the console, which is now
          the gutters beside the artwork and the air over it.

          IT IS ALSO THE DISMISS CONTROL. With the bar row gone there is no
          `chevron.down` for VoiceOver or Switch Control to reach, and this is
          not a real UIKit sheet, so nothing publishes a dismiss action on its
          behalf. Labelling the zone gives both a target; the console's own
          `onAccessibilityEscape` gives VoiceOver the two-finger-Z it expects. */}
      <GestureDetector gesture={topGesture}>
        <View
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
          onAccessibilityTap={onCollapse}
          style={[styles.dragZone, { height: contentTop }]}
        />
      </GestureDetector>

      <View
        style={[
          styles.body,
          {
            // The BANNER's clearance, not the generic floating gap — see
            // `GLASS_FOOTER_HEIGHT`. The two bars have to stand on the same
            // line or none of the rest of it is true.
            paddingBottom: bannerBottomOffset(insets.bottom),
            top: contentTop,
          },
        ]}
      >
        <GestureDetector gesture={titleGesture}>
          <View style={styles.titleSlot}>
            <Animated.View
              style={[
                styles.titleBlock,
                { paddingLeft: copyInset },
                pagerStyle,
              ]}
            >
              {copy({ artist: subtitle, name: title })}
            </Animated.View>

            {/* The neighbours' copy rides the same pager as their artwork, so
                the title arrives WITH the swipe. Absolutely positioned, so
                they never affect the console's layout. */}
            {expanded
              ? (
                  [
                    { sound: neighbours.previous, side: -1 },
                    { sound: neighbours.next, side: 1 },
                  ] as const
                ).map(({ sound, side }) =>
                  sound ? (
                    <Animated.View
                      key={`title:${side}:${sound.id}`}
                      pointerEvents="none"
                      style={[
                        styles.titleBlock,
                        styles.titleGhost,
                        { left: side * winW, paddingLeft: copyInset },
                        pagerStyle,
                      ]}
                    >
                      {copy(sound)}
                    </Animated.View>
                  ) : null,
                )
              : null}
          </View>
        </GestureDetector>

        {/* THE scrubber — the native SwiftUI slider, tinted to the content
            colour rather than the accent. While framing, the trim frame
            rides ON it — the slider stays the screen's one progress surface
            and its thumb stays the playhead: edges resize, the framed middle
            slides the clip. */}
        <View
          // NO FRAMING-ONLY MARGIN. `CLIP_FRAMING_GAP` made room for a third
          // line under the scrubber that iOS no longer draws — the range rides
          // inside the elapsed/total row now — so applying it here would move
          // the transport on entering framing for nothing.
          style={styles.sliderBlock}
        >
          <PlayerScrubberLive
            copyInset={copyInset}
            clipLabel={
              clipMode
                ? `${formatTime(clipRange.startS)} – ${formatTime(clipRange.endS)}`
                : null
            }
            clipRangeSv={
              clipMode ? { endSv: clipEndSv, startSv: clipStartSv } : null
            }
            onSeek={onSeek}
          />
          {clipMode ? (
            <View style={styles.trimFrameRegion} pointerEvents="box-none">
              <ClipTrimFrameIos
                durationS={trimmerDuration}
                startS={clipRange.startS}
                endS={clipRange.endS}
                startSv={clipStartSv}
                endSv={clipEndSv}
                onChange={onClipRangeChange}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.spacer} />

        {/* THE TRANSPORT IS THE ONLY PLAY CONTROL, IN BOTH MODES.

            While framing, the two SKIPS fade out — they would leave the mode
            (a sound change drops the frame), and they were competing for
            attention with the thing being aimed. What stays is the play
            button, which becomes the CLIP's: press it with nothing sounding
            and it previews the selection.

            The glass bar used to carry that preview as a third control, dead
            centre, ~130pt directly below this one — the same triangle on the
            same centre line, meaning something else. Juan read it as seeing
            the player controls twice, which is exactly what it was.

            The GLYPH needs no new state to do this: it already tracks
            `playing`, and a preview sets that too. So the rule is simply
            "sounding → pause it, silent → play the clip", which is honest in
            every combination — including entering framing mid-song, where a
            play glyph over audible sound would have been a lie. */}
        <View style={styles.transportRow}>
          <Animated.View
            pointerEvents={clipMode ? 'none' : 'auto'}
            style={skipStyle}
          >
            <GlyphButton
              onPress={onPrevious}
              hitSlop={12}
              accessibilityLabel={t('player.previous')}
            >
              <PreviousGlyph
                color={colors.onSurface}
                size={TRANSPORT_SKIP_SIZE}
              />
            </GlyphButton>
          </Animated.View>
          <GlyphButton
            onPress={clipMode && !previewing ? onClipPreview : onToggle}
            hitSlop={12}
            accessibilityLabel={t(
              clipMode
                ? previewing
                  ? 'player.pause'
                  : 'player.clips.preview'
                : playing
                  ? 'player.pause'
                  : 'player.play',
            )}
          >
            {(clipMode ? previewing : playing) ? (
              <PauseGlyph color={colors.onSurface} size={TRANSPORT_PLAY_SIZE} />
            ) : (
              <PlayGlyph color={colors.onSurface} size={TRANSPORT_PLAY_SIZE} />
            )}
          </GlyphButton>
          <Animated.View
            pointerEvents={clipMode ? 'none' : 'auto'}
            style={skipStyle}
          >
            <GlyphButton
              onPress={onNext}
              hitSlop={12}
              accessibilityLabel={t('player.next')}
            >
              <NextGlyph color={colors.onSurface} size={TRANSPORT_SKIP_SIZE} />
            </GlyphButton>
          </Animated.View>
        </View>

        <View style={styles.spacerLower} />

        {/* While framing a clip, the action row takes the footer's place —
            whichever footer that is. */}
        {clipMode ? (
          <ClipActionsRow
            onCancel={onClipCancel}
            onPreview={onClipPreview}
            onSave={onClipSave}
            width={contentWidth}
          />
        ) : (
          <GlassFooter
            cards={cards}
            editA11yLabel={t('player.menu.edit')}
            editLabel={t('player.menu.editShort')}
            onEdit={onEdit}
            width={contentWidth}
          />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  console: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // The invisible drag-to-close surface behind the whole region above the
  // console — the bar row and the gutters beside the artwork.
  dragZone: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // A flex column from the artwork's bottom edge to the bottom inset, so the
  // spacers can distribute what used to be dead screen.
  body: {
    bottom: 0,
    left: 0,
    paddingHorizontal: PLAYER_SIDE_PADDING,
    position: 'absolute',
    right: 0,
  },
  spacer: { flex: 1 },
  /** See `SPACER_LOWER_WEIGHT` — heavier, so the row lifts off the glass bar. */
  spacerLower: { flex: SPACER_LOWER_WEIGHT },
  titleSlot: { width: '100%' },
  /**
   * THE COPY'S OWN BREATHING ROOM, and the console's one hand-placed gap
   * between groups. The screen reads as three blocks — the artwork with the
   * copy that names it, the scrubber with its times, and the transport — so
   * the space WITHIN a block is its type's own leading and the space BETWEEN
   * blocks is set here. It was 20 while the slider box was 32 and carried a
   * thumb; freeing 26pt at the top of the console (a 12pt island gap and an
   * 18pt scrubber box) sent all of it to the transport's two flexible gaps
   * and left the copy the tightest thing on screen.
   */
  titleBlock: { paddingBottom: 30, width: '100%' },
  // Overlays the real title block, so a neighbour's copy costs no layout.
  titleGhost: { position: 'absolute', top: 0 },
  title: {
    fontSize: TITLE_SIZE,
    fontWeight: '700',
    lineHeight: TITLE_LEADING,
  },
  artist: { fontSize: ARTIST_SIZE, lineHeight: ARTIST_LEADING },
  sliderBlock: { position: 'relative', width: '100%' },
  // The frame's box is CENTRED on the slider host — a 2pt overhang each
  // side, so the rails clear the thumb — and it is an absolute overlay, so
  // entering framing still costs no layout.
  trimFrameRegion: {
    height: TRIM_FRAME_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: (IOS_SLIDER_HOST_HEIGHT - TRIM_FRAME_HEIGHT) / 2,
  },
  transportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: TRANSPORT_GAP,
    justifyContent: 'center',
    width: '100%',
  },
  // The footer bar.
  glassFooter: { ...CONTINUOUS_CURVE, borderRadius: FLOATING_RADIUS },
  glassRow: { flexDirection: 'row', height: '100%', width: '100%' },
  glassHalfSlot: { flex: 1 },
  glassDivider: {
    bottom: 12,
    left: 0,
    position: 'absolute',
    top: 12,
    width: HAIRLINE,
  },
  glassHalf: { height: '100%', width: '100%' },
  // EACH HALF IS A ROW, and that is why its content leads rather than centres.
  //
  // Centring was tried and made the bar look BIGGER than it needed to be: it
  // split the slack into four pockets, two of them at the bar's outer ends,
  // which is exactly what reads as an oversized container. Left-aligned the
  // slack sits where a list row's always does — trailing the content — and
  // nobody reads a row's trailing space as emptiness, because the content
  // starts at a consistent inset.
  //
  // The bar keeps the collapsed banner's full width regardless. That width is
  // not decoration: it IS the banner's box, which is what makes expanding read
  // as the same object staying put. Hugging the content would also make the bar
  // resize whenever a summary did — "No Clips Yet" against "3 Clips".
  glassHalfPress: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: '100%',
    paddingHorizontal: GLASS_ROW_PADDING,
  },
  glassIconHost: {
    height: GLASS_FOOTER_ICON_BOX,
    width: GLASS_FOOTER_ICON_BOX,
  },
  glassCopy: { flex: 1, gap: 1 },
  glassEditSlot: { flexShrink: 0 },
  /**
   * TRAILING, NOT CENTRED, and it is the same `GLASS_ROW_PADDING` the leading
   * half takes — so the bar's first ink and its last ink sit at equal depth.
   *
   * Centred in its own slot the glyph sat 24.00 off the bar's right edge
   * against the Shape icon's 19.50 off the left, which is the kind of 4.5pt
   * asymmetry nobody can name and everybody sees. Flush against the padding,
   * with the same 31pt icon host the halves use, both come to 19.50 by
   * construction rather than by arithmetic.
   */
  /**
   * STACKED, so the cell occupies BOTH of the bar's rows.
   *
   * Beside it the two cards run label 781.33 → 796.67 over summary
   * 804.00 → 815.00. Laid out as a ROW this cell put its one word at
   * 791.67 → 804.33 — centred on the two-line block to within 0.17pt, and
   * therefore level with neither row: its top 10.3 below the labels, its bottom
   * exactly where the summaries start. Mathematically centred, optically
   * homeless, and Juan read it as a break in the bar's vertical flow.
   *
   * A SUMMARY WOULD HAVE BEEN THE OTHER FIX AND THERE IS NO ROOM FOR ONE. The
   * compartment hugs its content, so every point of summary comes off the two
   * cards: "Details" (~44 of ink) drops them to 125.5 and their copy box to
   * 50.5 against "Flat · 1×"'s 50.67 — truncating the DEFAULT state. Live text
   * is worse than tight: the sound's own name would re-divide the bar on every
   * swipe.
   *
   * So the icon takes the labels' band and the caption takes the summaries',
   * and the cell reads as a trailing toolbar action rather than a card that
   * lost its second line.
   */
  /**
   * A ROW, exactly like the two cards — icon, gap, one line of copy, and
   * `GLASS_ROW_PADDING` at both ends, so the bar's last ink sits at the same
   * depth as its first (measured: 19.67 leading, 19.00 trailing).
   *
   * ITS SINGLE LINE IS VERTICALLY CENTRED. A STACKED version was built first —
   * icon in the cards' label band at 789.00, word in their summary band at
   * 809.50, aligned to within half a point — on the argument that a one-line
   * cell centred beside two-line ones is level with neither row. That argument
   * is true and it is not the one that decides: the stack makes this cell a
   * different KIND of thing, and the bar's three items should read as one kind.
   * Juan chose the row after seeing both.
   *
   * THE TRAILING PADDING CARRIES THE ICON HOST'S SLACK, and this is why the
   * right end read tighter than the left at identical padding. The bar's first
   * ink is a glyph inside a 31pt HOST that is 7 wider than the 24pt symbol it
   * holds, so the leading ink starts `GLASS_ROW_PADDING` plus 3.5 of host slack
   * plus the glyph's own bearing inside the bar — measured, 19.67. The bar's
   * last ink is text, whose box has almost no bearing at all: 16.34, a genuine
   * 3.3pt tighter. So the trailing side adds the host's half-slack back, which
   * is derived from the two constants rather than nudged by eye.
   *
   * The `opticalTextInset` this briefly took is NOT the same correction and
   * does not belong here. It was earned by the STACKED layout, where the word
   * sat low enough for the 22pt corner to have started pulling in; with the
   * word back at the bar's vertical middle the edge is at its full 385.67.
   */
  glassEditPress: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: '100%',
    paddingLeft: GLASS_ROW_PADDING,
    paddingRight:
      GLASS_ROW_PADDING + (GLASS_FOOTER_ICON_BOX - GLASS_FOOTER_ICON) / 2,
  },
});
