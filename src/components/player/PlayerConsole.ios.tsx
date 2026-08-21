import { Pressable, StyleSheet, View } from 'react-native';

import { Image } from '@expo/ui/swift-ui';
import { withAlpha } from '@portfolio/core';
import {
  AppIcon,
  FLOATING_RADIUS,
  GlassSurfaceIos,
  SwiftUIHost,
  usePressSquash,
} from '@portfolio/mobile-ui';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClipActionsRow } from '@/components/player/ClipActionsRow';
import { ClipHandles } from '@/components/player/ClipHandles';
import { GlyphButton } from '@/components/player/GlyphButton';
import { PlayerMenuButton } from '@/components/player/PlayerMenuButton';
import { PlayerScrubber } from '@/components/player/PlayerScrubber';
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
import { opticalTextInset } from '@/styles/metrics';
import { CONTINUOUS_CURVE, HAIRLINE } from '@/styles/shape';

import { bannerBottomOffset, MINI_PLAYER_HEIGHT } from './bannerMetrics';
import {
  CLIP_FRAMING_GAP,
  HANDLES_REGION_HEIGHT,
  PLAYER_BAR_TARGET,
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
// 4. A BAR ROW, AND IT IS NOT A GRABBER. One glyph on each side at the
//    portfolio's 43pt bar target: `chevron.down` to put the player away, the
//    overflow `Menu` opposite it.
//
//    Both alternatives were built and rejected. A sheet GRABBER was wrong
//    because this surface has a bottom sheet's dismiss gesture but is not a
//    sheet, and a grabber is UIKit's promise that it is one (Juan, on sight).
//    Hanging the overflow off the TITLE was wrong because a "…" that acts on
//    the screen does not belong inside the copy that names the sound.
//
//    What must NOT come back is how the original row was built: on
//    `IconButton`, which wraps a `matchContents` Host, so a re-render moved the
//    whole row 79pt (measured: chevron ink centre 87.67 on a fresh launch,
//    166.67 after a live appearance change, with the artwork unmoved). Every
//    host in this row states its box.
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
 * `title1` (28) was rendered and rejected: against a 370pt cover it competes
 * with the artwork instead of captioning it.
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
 */
const TRANSPORT_SKIP_SIZE = 30;
const TRANSPORT_PLAY_SIZE = 44;
/** Between the boxes, so the three read as one group rather than a spread row. */
const TRANSPORT_GAP = 30;

/* -------------------------------------------------------------------------- */
/*  The bar row                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The bar glyphs' ink. `HEADER_CLOSE_GLYPH_SIZE`'s value and its reason: Apple
 * draws a dismiss glyph noticeably larger than an inline title's cap height so
 * it stays an easy target inside the fixed capsule. Restated rather than
 * imported because that constant belongs to a UIKit BAR ITEM — this row is not
 * one, and borrowing the name would claim a kinship the layout does not have.
 */
const BAR_GLYPH_SIZE = 20;

/**
 * THE BAR GLYPHS STAND ON GLASS, and it is a readability guarantee rather than
 * decoration.
 *
 * The artwork wash is at full strength now, which means the top band takes the
 * cover's own colour — and the bar row sits in exactly the part of the gradient
 * that is least scrimmed. A near-black cover in LIGHT mode puts black glyphs on
 * a (36,36,36) ground: 1.35:1, unreadable. Solving that with a scrim floor
 * needs ~0.37 of page colour at the top, which would flatten the wash for
 * precisely the covers it should be strongest on.
 *
 * So the glyphs get their own ground instead — the portfolio's floating
 * material, whose `GLASS_FLOOR` is the measured term that lifts whatever is
 * behind it toward the page colour. It is also what Apple does: Photos puts its
 * viewer controls on glass over arbitrary photography for this exact reason.
 *
 * A CIRCLE, sized to the tap target, so the two read as the bar items they are
 * — the same shape UIKit gives a real `headerLeft`/`headerRight` glyph.
 */
const BAR_GLASS = PLAYER_BAR_TARGET;

/**
 * The collapse glyph. It is NOT in `TransportGlyphs.ios` — that module is the
 * four transport symbols and a chevron is not one of them — and it states its
 * box for the same reason everything else in this row does.
 */
function CollapseGlyph({ color }: { color: string }) {
  return (
    <SwiftUIHost style={styles.barGlyphHost} ignoreSafeArea="all">
      <Image systemName="chevron.down" size={BAR_GLYPH_SIZE} color={color} />
    </SwiftUIHost>
  );
}

/** The glass disc under a bar glyph. Decorative and pointer-transparent — the
 *  glyph's own control sits above it and keeps the touch. */
function BarGlass() {
  return (
    <View pointerEvents="none" style={styles.barGlass}>
      <GlassSurfaceIos width={BAR_GLASS} height={BAR_GLASS} shape="capsule" />
    </View>
  );
}

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
const GLASS_FOOTER_ICON = 22;
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
  width: number;
};

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
function GlassFooter({ cards, width }: FooterProps) {
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
      </View>
    </View>
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
          <AppText
            doNotTranslate
            text={card.label}
            variant="bodyMedium"
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
  duration,
  expanded,
  neighbours,
  onClipCancel,
  onClipPreview,
  onClipRangeChange,
  onClipSave,
  onCollapse,
  onEdit,
  onInfo,
  onNext,
  onPrevious,
  onScrub,
  onScrubEnd,
  onToggle,
  pagerStyle,
  playing,
  position,
  subtitle,
  title,
  titleGesture,
  topGesture,
  totalDuration,
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
      style={[styles.console, consoleStyle]}
      pointerEvents={expanded ? 'auto' : 'none'}
    >
      {/* One full-width drag-to-close zone spanning everything above the
          console — the bar row and the gutters beside the art. The art and
          the bar glyphs render above it and keep their own touches. */}
      <GestureDetector gesture={topGesture}>
        <View style={[styles.dragZone, { height: contentTop }]} />
      </GestureDetector>

      {/* The bar row. `chevron.down` puts the player away — the same job the
          drag does, said as a button, which is also the only thing VoiceOver
          and Switch Control can reach (this is not a real UIKit sheet, so
          nothing publishes a dismiss action on its behalf). */}
      <View style={[styles.barRow, { paddingTop: insets.top }]}>
        <View style={styles.barItem}>
          <BarGlass />
          <GlyphButton
            accessibilityLabel={t('common.back')}
            hitSlop={0}
            onPress={onCollapse}
            style={styles.barSlot}
          >
            <CollapseGlyph color={colors.onSurface} />
          </GlyphButton>
        </View>
        <View style={styles.barItem}>
          <BarGlass />
          <PlayerMenuButton onInfo={onInfo} onEdit={onEdit} />
        </View>
      </View>

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
            colour rather than the accent. While framing, the trim brackets
            ride on top: edges resize, the tinted middle slides the clip. */}
        <View
          style={[styles.sliderBlock, clipMode && styles.sliderBlockFraming]}
        >
          <PlayerScrubber
            copyInset={copyInset}
            position={position}
            duration={duration}
            totalDuration={totalDuration}
            clipLabel={
              clipMode
                ? `${formatTime(clipRange.startS)} – ${formatTime(clipRange.endS)}`
                : null
            }
            onDrag={onScrub}
            onDragEnd={onScrubEnd}
          />
          {clipMode ? (
            <View style={styles.handlesRegion} pointerEvents="box-none">
              <ClipHandles
                durationS={trimmerDuration}
                startS={clipRange.startS}
                endS={clipRange.endS}
                onChange={onClipRangeChange}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.spacer} />

        <View style={styles.transportRow}>
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
          <GlyphButton
            onPress={onToggle}
            hitSlop={12}
            accessibilityLabel={t(playing ? 'player.pause' : 'player.play')}
          >
            {playing ? (
              <PauseGlyph color={colors.onSurface} size={TRANSPORT_PLAY_SIZE} />
            ) : (
              <PlayGlyph color={colors.onSurface} size={TRANSPORT_PLAY_SIZE} />
            )}
          </GlyphButton>
          <GlyphButton
            onPress={onNext}
            hitSlop={12}
            accessibilityLabel={t('player.next')}
          >
            <NextGlyph color={colors.onSurface} size={TRANSPORT_SKIP_SIZE} />
          </GlyphButton>
        </View>

        <View style={styles.spacer} />

        {/* While framing a clip, the action row takes the footer's place —
            whichever footer that is. */}
        {clipMode ? (
          <ClipActionsRow
            onCancel={onClipCancel}
            onPreview={onClipPreview}
            onSave={onClipSave}
          />
        ) : (
          <GlassFooter cards={cards} width={contentWidth} />
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
  barRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: PLAYER_SIDE_PADDING,
    position: 'absolute',
    right: 0,
  },
  barGlyphHost: { height: PLAYER_BAR_TARGET, width: PLAYER_BAR_TARGET },
  barItem: {
    alignItems: 'center',
    height: BAR_GLASS,
    justifyContent: 'center',
    width: BAR_GLASS,
  },
  barGlass: { height: BAR_GLASS, position: 'absolute', width: BAR_GLASS },
  barSlot: {
    alignItems: 'center',
    height: PLAYER_BAR_TARGET,
    justifyContent: 'center',
    width: PLAYER_BAR_TARGET,
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
  titleSlot: { width: '100%' },
  titleBlock: { paddingBottom: 20, width: '100%' },
  titleGhost: { position: 'absolute', top: 0 },
  title: {
    fontSize: TITLE_SIZE,
    fontWeight: '700',
    lineHeight: TITLE_LEADING,
  },
  artist: { fontSize: ARTIST_SIZE, lineHeight: ARTIST_LEADING },
  sliderBlock: { position: 'relative', width: '100%' },
  sliderBlockFraming: { marginBottom: CLIP_FRAMING_GAP },
  handlesRegion: {
    height: HANDLES_REGION_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
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
  glassHalfPress: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    height: '100%',
    paddingHorizontal: 14,
  },
  glassIconHost: {
    height: GLASS_FOOTER_ICON_BOX,
    width: GLASS_FOOTER_ICON_BOX,
  },
  glassCopy: { flex: 1, gap: 1 },
});
