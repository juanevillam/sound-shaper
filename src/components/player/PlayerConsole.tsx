import { StyleSheet, View } from 'react-native';

import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClipActionsRow } from '@/components/player/ClipActionsRow';
import { ClipHandles } from '@/components/player/ClipHandles';
import { GlyphButton } from '@/components/player/GlyphButton';
import { PlayerCards } from '@/components/player/PlayerCards';
import { PlayerMenuButton } from '@/components/player/PlayerMenuButton';
import { PlayerScrubberLive } from '@/components/player/PlayerScrubberLive';
import {
  NextGlyph,
  PauseGlyph,
  PlayGlyph,
  PreviousGlyph,
} from '@/components/player/TransportGlyphs';
import { IconButton } from '@/components/ui/IconButton';
import { Text as AppText } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { formatTime } from '@/lib/player';

import {
  CARDS_HEIGHT,
  CLIP_FRAMING_GAP,
  HANDLES_REGION_HEIGHT,
  type PlayerConsoleProps,
} from './chrome';

// ---------------------------------------------------------------------------
// ANDROID'S EXPANDED CONSOLE — moved here verbatim from `PlayerSheet` when the
// iOS twin was written. Nothing in this file changed in the move; if it reads
// as Material, that is because it is Material and is meant to be. The iOS
// surface is `PlayerConsole.ios.tsx`.
//
// IT IS VERIFIED NOW. This file spent months carrying a note saying nothing
// Android was installed and so nothing here could be checked; that stopped
// being true on 2026-08-28, when the A54 became the standing target and this
// console was walked on it. The RELEASE freeze still stands — features and
// flows need an explicit ask — but feel does not, and "written but unverified"
// is no longer an acceptable state for anything in here.
//
// A fixed column, nothing scrolls, so nothing can fight the drag-to-close
// gesture: art (owned by the sheet, above), title with an overflow menu, the
// scrubber, transport, and two cards — Shape and Clips — that open their own
// bottom sheets.
// ---------------------------------------------------------------------------

const PLAY_BUTTON_SIZE = 64;
const SIDE_PADDING = 24;

export function PlayerConsole({
  cards,
  clipEditing,
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
  onInfo,
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

  return (
    <Animated.View
      style={[styles.expanded, consoleStyle]}
      pointerEvents={expanded ? 'auto' : 'none'}
    >
      {/* One full-width drag-to-close zone spanning everything above the
          console (header row, the gutters beside the art). Buttons and
          the art render ABOVE it, so they keep their own touches. */}
      <GestureDetector gesture={topGesture}>
        <View style={[styles.dragZone, { height: contentTop }]} />
      </GestureDetector>

      <View style={[styles.expandedTop, { paddingTop: insets.top + 4 }]}>
        <IconButton
          name="chevron-down"
          onPress={onCollapse}
          accessibilityLabel={t('common.back')}
        />
        {/* Sound overflow: metadata + the same edit/delete sheet the
            library's long-press opens. Compose anchors a dropdown to the
            trigger. Both twins size their own touch target, so there is no
            wrapper here — one would only decentre the smaller of the two. */}
        <PlayerMenuButton onInfo={onInfo} onEdit={onEdit} />
      </View>

      {/* The console below the art — a fixed column, nothing scrolls. */}
      <View style={[styles.expandedBody, { top: contentTop }]}>
        <GestureDetector gesture={titleGesture}>
          <View style={styles.titleSlot}>
            <Animated.View style={[styles.titleBlock, pagerStyle]}>
              <AppText
                doNotTranslate
                text={title}
                variant="titleLarge"
                numberOfLines={1}
                style={styles.titleText}
              />
              <AppText
                doNotTranslate
                muted
                text={subtitle}
                variant="bodyMedium"
                numberOfLines={1}
              />
            </Animated.View>

            {/* The neighbours' text rides the same pager as their artwork,
                so the title arrives WITH the swipe. Absolutely positioned,
                so they never affect the console's layout. */}
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
                        { left: side * winW },
                        pagerStyle,
                      ]}
                    >
                      <AppText
                        doNotTranslate
                        text={sound.name}
                        variant="titleLarge"
                        numberOfLines={1}
                        style={styles.titleText}
                      />
                      <AppText
                        doNotTranslate
                        muted
                        text={sound.artist || ' '}
                        variant="bodyMedium"
                        numberOfLines={1}
                      />
                    </Animated.View>
                  ) : null,
                )
              : null}
          </View>
        </GestureDetector>

        {/* THE scrubber — always the native slider. While framing, the
            tertiary trim brackets ride on top (Google Photos): edges
            resize, the tinted middle slides the whole clip. */}
        <View
          style={[styles.sliderBlock, clipMode && styles.sliderBlockFraming]}
        >
          <PlayerScrubberLive
            clipLabel={
              clipMode
                ? `${formatTime(clipRange.startS)} – ${formatTime(clipRange.endS)}`
                : null
            }
            onSeek={onSeek}
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

        {/* Transport in RN, not Compose: a Compose IconButton's state
            layer is invisible on this dark surface. Feedback is the app's
            squash, which — unlike the ripple these used to carry — also
            exists on iOS. */}
        <View style={styles.transportRow}>
          <GlyphButton
            onPress={onPrevious}
            hitSlop={12}
            style={styles.transportSide}
            accessibilityLabel={t('player.previous')}
          >
            <PreviousGlyph color={colors.onSurface} />
          </GlyphButton>
          <GlyphButton
            onPress={onToggle}
            hitSlop={12}
            style={[styles.transportPlay, { backgroundColor: colors.primary }]}
            accessibilityLabel={t(playing ? 'player.pause' : 'player.play')}
          >
            {playing ? (
              <PauseGlyph color={colors.onPrimary} />
            ) : (
              <PlayGlyph color={colors.onPrimary} />
            )}
          </GlyphButton>
          <GlyphButton
            onPress={onNext}
            hitSlop={12}
            style={styles.transportSide}
            accessibilityLabel={t('player.next')}
          >
            <NextGlyph color={colors.onSurface} />
          </GlyphButton>
        </View>

        {/* While framing a clip, the action row takes the cards' place. */}
        {clipMode ? (
          <View style={styles.firstCardHost}>
            <ClipActionsRow
              editing={clipEditing}
              onCancel={onClipCancel}
              onPreview={onClipPreview}
              onSave={onClipSave}
            />
          </View>
        ) : (
          /* Shape + Clips — the two studios, side by side as the
             console's footer. Outlined, not filled: a filled surface sat
             as two slabs on top of the artwork wash and cut the gradient
             in half. A hairline outline keeps the wash running edge to
             edge, and one row of two instead of two stacked rows gives
             ~90dp of it back. */
          <View style={[styles.cardHost, styles.firstCardHost]}>
            <PlayerCards cards={cards} />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  expanded: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  expandedTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 12,
    paddingRight: 12,
  },
  // The invisible drag-to-close surface behind the whole header region.
  dragZone: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  expandedBody: {
    bottom: 0,
    left: 0,
    paddingHorizontal: SIDE_PADDING,
    position: 'absolute',
    right: 0,
  },
  titleSlot: { width: '100%' },
  titleBlock: {
    gap: 3,
    paddingBottom: 18,
    width: '100%',
  },
  // Overlays the real title block, so a neighbour's text costs no layout.
  titleGhost: { position: 'absolute', top: 0 },
  titleText: { fontWeight: '700' },
  transportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 28,
    justifyContent: 'center',
    paddingVertical: 4,
    width: '100%',
  },
  transportSide: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  transportPlay: {
    alignItems: 'center',
    borderRadius: PLAY_BUTTON_SIZE / 2,
    height: PLAY_BUTTON_SIZE,
    justifyContent: 'center',
    width: PLAY_BUTTON_SIZE,
  },
  sliderBlock: { position: 'relative', width: '100%' },
  sliderBlockFraming: { marginBottom: CLIP_FRAMING_GAP },
  // The brackets ride the slider row — never down into the time labels.
  handlesRegion: {
    height: HANDLES_REGION_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // The cards' own height, from the term `PlayerCards` already imports — it was
  // a re-typed 96 beside it, which is the same value on Android and the wrong
  // way to say it.
  // Only ever applied together with `firstCardHost`, which is why it states no
  // top margin of its own — it carried a 12 that the 28 below always won.
  cardHost: {
    height: CARDS_HEIGHT,
    width: '100%',
  },
  // Extra air between the transport and the first card.
  firstCardHost: { marginTop: 28 },
});
