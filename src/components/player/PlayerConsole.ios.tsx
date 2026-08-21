import { Pressable, StyleSheet, View } from 'react-native';

import { withAlpha } from '@portfolio/core';
import {
  AppIcon,
  FLOATING_EDGE_GAP,
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
import { CONTINUOUS_CURVE, HAIRLINE } from '@/styles/shape';

import {
  CLIP_FRAMING_GAP,
  HANDLES_REGION_HEIGHT,
  PLAYER_GRABBER_HEIGHT,
  PLAYER_SIDE_PADDING,
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
// 4. NO TOP BAR. The chevron row is gone. Its job — say this can be dismissed
//    — is the GRABBER's, which is the iOS sheet's own affordance and advertises
//    the drag-to-collapse gesture that until now had nothing to announce it.
//    The overflow moved down to the title, where the thing it acts on is.
//    Deleting that row also deletes a real defect: it was built from
//    `IconButton`, which wraps a `matchContents` Host, and a re-render moved
//    the row 79pt (measured: chevron ink centre 87.67 on a fresh launch, 166.67
//    after a live appearance change, artwork unmoved). That is the async-answer
//    -on-the-layout-path family AGENTS.md names.
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
/*  The grabber                                                               */
/* -------------------------------------------------------------------------- */

/** Apple's sheet grabber: a 36 × 5 capsule, centred. */
const GRABBER_WIDTH = 36;
/** UIKit draws it as a tint of the content colour, not as a solid rule. */
const GRABBER_ALPHA = 0.3;

/* -------------------------------------------------------------------------- */
/*  The footer                                                                 */
/* -------------------------------------------------------------------------- */

/** The glass bar's box — one merged capsule, like Home's trailing pill. */
const GLASS_FOOTER_HEIGHT = 64;
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

  const copy = (song: { artist: string; name: string }) => (
    <>
      <AppText
        doNotTranslate
        text={song.name}
        numberOfLines={1}
        style={styles.title}
      />
      <AppText
        doNotTranslate
        muted
        text={song.artist || ' '}
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
          console — the grabber and the gutters beside the art. The art
          renders above it and keeps its own touches. */}
      <GestureDetector gesture={topGesture}>
        <View style={[styles.dragZone, { height: contentTop }]} />
      </GestureDetector>

      {/* The grabber. The drag it announces is `topGesture` underneath, which
          spans the whole band rather than this 36pt pill — but the pill is
          TAPPABLE too, and that is not decoration. Apple's grabber can be inert
          because a real UIKit sheet publishes an accessibility dismiss action of
          its own; this surface is not one, so drag-only would leave VoiceOver
          and Switch Control with no way out at all. */}
      <View style={[styles.grabberRow, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
          hitSlop={16}
          onPress={onCollapse}
          style={[
            styles.grabber,
            { backgroundColor: withAlpha(colors.onSurface, GRABBER_ALPHA) },
          ]}
        />
      </View>

      <View
        style={[
          styles.body,
          { paddingBottom: insets.bottom + FLOATING_EDGE_GAP, top: contentTop },
        ]}
      >
        <GestureDetector gesture={titleGesture}>
          <View style={styles.titleSlot}>
            <Animated.View style={[styles.titleBlock, pagerStyle]}>
              {copy({ artist: subtitle, name: title })}
            </Animated.View>

            {/* The neighbours' copy rides the same pager as their artwork, so
                the title arrives WITH the swipe. Absolutely positioned, so
                they never affect the console's layout. */}
            {expanded
              ? (
                  [
                    { song: neighbours.previous, side: -1 },
                    { song: neighbours.next, side: 1 },
                  ] as const
                ).map(({ song, side }) =>
                  song ? (
                    <Animated.View
                      key={`title:${side}:${song.id}`}
                      pointerEvents="none"
                      style={[
                        styles.titleBlock,
                        styles.titleGhost,
                        { left: side * winW },
                        pagerStyle,
                      ]}
                    >
                      {copy(song)}
                    </Animated.View>
                  ) : null,
                )
              : null}

            {/* The overflow belongs to the SCREEN, not to the song, so it sits
                outside the pager and does not travel with a swipe. It is here
                rather than in a top bar because what it acts on is the title
                beside it — and because the row it used to live in was the
                console's only piece of chrome. */}
            <View style={styles.menuSlot}>
              <PlayerMenuButton onInfo={onInfo} onEdit={onEdit} />
            </View>
          </View>
        </GestureDetector>

        {/* THE scrubber — the native SwiftUI slider, tinted to the content
            colour rather than the accent. While framing, the trim brackets
            ride on top: edges resize, the tinted middle slides the clip. */}
        <View
          style={[styles.sliderBlock, clipMode && styles.sliderBlockFraming]}
        >
          <PlayerScrubber
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
  // console — the grabber band and the gutters beside the artwork.
  dragZone: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  grabberRow: { alignItems: 'center', left: 0, position: 'absolute', right: 0 },
  grabber: {
    borderRadius: PLAYER_GRABBER_HEIGHT / 2,
    height: PLAYER_GRABBER_HEIGHT,
    width: GRABBER_WIDTH,
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
  titleBlock: {
    // Clears the overflow, so a long name truncates before it rather than
    // running underneath.
    paddingRight: 44,
    paddingBottom: 20,
    width: '100%',
  },
  titleGhost: { position: 'absolute', top: 0 },
  title: {
    fontSize: TITLE_SIZE,
    fontWeight: '700',
    lineHeight: TITLE_LEADING,
  },
  artist: { fontSize: ARTIST_SIZE, lineHeight: ARTIST_LEADING },
  menuSlot: { position: 'absolute', right: -8, top: -2 },
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
