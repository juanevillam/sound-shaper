import { useEffect, useRef } from 'react';

import { Pressable, StyleSheet, View } from 'react-native';

import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bannerBottomOffset } from '@/components/player/bannerMetrics';
import { GlyphButton } from '@/components/player/GlyphButton';
import { PlayerScrubberLive } from '@/components/player/PlayerScrubberLive';
import {
  NextGlyph,
  PauseGlyph,
  PlayGlyph,
  PreviousGlyph,
} from '@/components/player/TransportGlyphs';
import { Text as AppText } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { withAlpha, useAppTheme } from '@/core';
import { useI18n } from '@/i18n';
import {
  AppIcon,
  FLOATING_RADIUS,
  MINI_PLAYER_HEIGHT,
  usePressSquash,
  HAIRLINE,
} from '@/ui';

import {
  PLAYER_SIDE_PADDING,
  playerArtSize,
  registerPlayerTransportMeasurer,
  setPlayerTransportAnchor,
  TRANSPORT_GAP,
  TRANSPORT_GLYPH_BOX_RATIO,
  TRANSPORT_PLAY_SIZE,
  TRANSPORT_SKIP_SIZE,
  type PlayerCard,
  type PlayerConsoleProps,
} from './chrome';

// ---------------------------------------------------------------------------
// ANDROID'S EXPANDED CONSOLE — the iOS console's RESULT, said in Material.
//
// What stood here until 2026-09-08 was the old Material now-playing screen the
// iOS rewrite describes and rejects: a 64dp filled-primary FAB, two outlined
// cards, an overflow menu behind a chevron bar row, and in-place clip framing
// on the scrubber. Juan asked for the iOS arrangement on both platforms, so
// this file now mirrors `PlayerConsole.ios.tsx` rule for rule:
//
// 1. ONE CONTENT BOX — artwork, title, scrubber, transport and footer all run
//    to the same two edges (`PLAYER_SIDE_PADDING`, the app's screen gutter and
//    the collapsed banner's inset). See `chrome.ts`.
// 2. THE COLUMN FILLS THE SCREEN — two flexible spacers distribute the air,
//    the lower one heavier (the optical-centre rule measured on iOS).
// 3. NO ACCENT — the backdrop wash carries the colour; every control takes
//    `onSurface`. The old FAB and the slider's theme tint were both the
//    framework's default saying nothing (the monochrome rule's first bucket).
// 4. NO BAR ROW — nothing above the artwork but the artwork. The overflow's
//    two entries went where iOS sent them: Edit is the footer's third
//    compartment, and Get Info is deleted (nothing left to say — see the iOS
//    file). BACK and the drag both still put the player away.
//
// What stays Material: the footer is the collapsed banner's own tonal chrome
// (surfaceContainer + elevation) rather than Liquid Glass — the
// same split `BannerGlass` documents — and the transport glyphs are the
// hand-drawn Android set.
//
// Clip framing is GONE from this console on Android too: a clip is made in
// the dedicated `clip-trim` editor, which the Clips sheet pushes.
// ---------------------------------------------------------------------------

/**
 * The title pair steps the ladder exactly as iOS's does: the console is the
 * one surface where the sound is the SCREEN'S subject, so it takes
 * `titleLarge` (22/28 — the same 22/28 iOS lands on) over `bodyLarge` muted.
 */
const TITLE_VARIANT = 'titleLarge' as const;
const ARTIST_VARIANT = 'bodyLarge' as const;

/** See `SPACER_LOWER_WEIGHT` in the iOS file — the optical centre. */
const SPACER_LOWER_WEIGHT = 1.55;

/**
 * THE FOOTER IS THE COLLAPSED BANNER'S BOX, EXACTLY — same width, height,
 * corner and place on screen, so expanding reads as the bar staying put while
 * its contents change. Same statement the iOS file makes; the CHROME is the
 * Android banner's own (tonal fill, elevation) instead of glass.
 * `FOOTER_ELEVATION` is the banner's `BANNER_ELEVATION`; neither wears an
 * outline any more — tone + shadow only (Juan, 2026-09-08).
 */
const FOOTER_HEIGHT = MINI_PLAYER_HEIGHT;
const FOOTER_ELEVATION = 8;
const FOOTER_ICON = 24;
/** The compartments' end padding — the iOS bar's `GLASS_ROW_PADDING`. */
const FOOTER_ROW_PADDING = 16;

function FooterHalf({ card }: { card: PlayerCard }) {
  const { colors } = useAppTheme();
  const squash = usePressSquash();

  return (
    <Animated.View style={[styles.footerHalf, squash.style]}>
      <Pressable
        accessibilityLabel={`${card.label}, ${card.summary}`}
        accessibilityRole="button"
        onPress={card.onPress}
        onPressIn={squash.onPressIn}
        onPressOut={squash.onPressOut}
        style={styles.footerHalfPress}
      >
        <ThemedHost pointerEvents="none" style={styles.footerIconHost}>
          <AppIcon
            name={card.icon}
            size={FOOTER_ICON}
            tint={colors.onSurface}
          />
        </ThemedHost>
        <View style={styles.footerCopy}>
          {/* bodyLarge over bodySmall — the Android ladder's read of the iOS
              Body-over-Footnote split: the LABEL keeps its presence, the
              SUMMARY (the long string) takes the small step and buys the
              width. */}
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

function FooterEdit({
  a11yLabel,
  label,
  onPress,
}: {
  a11yLabel: string;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const squash = usePressSquash();

  return (
    <Animated.View style={[styles.footerHalf, squash.style]}>
      <Pressable
        accessibilityLabel={a11yLabel}
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={squash.onPressIn}
        onPressOut={squash.onPressOut}
        style={styles.footerEditPress}
      >
        <ThemedHost pointerEvents="none" style={styles.footerIconHost}>
          <AppIcon name="edit" size={FOOTER_ICON} tint={colors.onSurface} />
        </ThemedHost>
        {/* One line, vertically centred — the compartment has no live state to
            put on a second one, which is what separates it from the two cards
            (the iOS file's argument, unchanged). */}
        <AppText doNotTranslate text={label} variant="bodyLarge" />
      </Pressable>
    </Animated.View>
  );
}

function Footer({
  cards,
  editA11yLabel,
  editLabel,
  onEdit,
  width,
}: {
  cards: readonly PlayerCard[];
  editA11yLabel: string;
  editLabel: string;
  onEdit: () => void;
  width: number;
}) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.footer,
        {
          backgroundColor: colors.surfaceContainer,
          height: FOOTER_HEIGHT,
          width,
        },
      ]}
    >
      <View style={styles.footerRow}>
        {cards.map((card, index) => (
          <View key={card.key} style={styles.footerHalfSlot}>
            {index > 0 ? (
              <View
                style={[
                  styles.footerDivider,
                  { backgroundColor: withAlpha(colors.onSurface, 0.12) },
                ]}
              />
            ) : null}
            <FooterHalf card={card} />
          </View>
        ))}

        <View style={styles.footerEditSlot}>
          <View
            style={[
              styles.footerDivider,
              { backgroundColor: withAlpha(colors.onSurface, 0.12) },
            ]}
          />
          <FooterEdit
            a11yLabel={editA11yLabel}
            label={editLabel}
            onPress={onEdit}
          />
        </View>
      </View>
    </View>
  );
}

export function PlayerConsole({
  cards,
  consoleStyle,
  contentTop,
  expanded,
  neighbours,
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
  winW,
}: PlayerConsoleProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const contentWidth = playerArtSize(winW);

  const copy = (sound: { artist: string; name: string }) => (
    <>
      <AppText
        doNotTranslate
        text={sound.name}
        variant={TITLE_VARIANT}
        numberOfLines={1}
        style={styles.title}
      />
      <AppText
        doNotTranslate
        muted
        text={sound.artist || ' '}
        variant={ARTIST_VARIANT}
        numberOfLines={1}
      />
    </>
  );

  /**
   * THE TRANSPORT ANCHOR'S WRITER — same contract as the iOS console (see
   * `chrome.ts`): the clip editor pins its own transport to this spot so the
   * two surfaces share one play button with zero shift.
   */
  const transportRowRef = useRef<View>(null);
  useEffect(() => {
    registerPlayerTransportMeasurer(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          transportRowRef.current?.measureInWindow((_x, y, _w, h) => {
            if (h > 0) setPlayerTransportAnchor(y + h / 2);
          });
        }),
      );
    });
    return () => registerPlayerTransportMeasurer(null);
  }, [transportRowRef]);

  return (
    <Animated.View
      style={[styles.console, consoleStyle]}
      pointerEvents={expanded ? 'auto' : 'none'}
    >
      {/* The drag-to-close zone — the gutters beside the artwork and the air
          over it. Labelled, so accessibility keeps a dismiss control now that
          the chevron row is gone (BACK works too, but a target on screen
          costs nothing). */}
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
            // The BANNER's clearance — the footer must stand on the collapsed
            // banner's own line or the same-object statement is false.
            paddingBottom: bannerBottomOffset(insets.bottom),
            top: contentTop,
          },
        ]}
      >
        <GestureDetector gesture={titleGesture}>
          <View style={styles.titleSlot}>
            <Animated.View style={[styles.titleBlock, pagerStyle]}>
              {copy({ artist: subtitle, name: title })}
            </Animated.View>

            {/* The neighbours' copy rides the same pager as their artwork, so
                the title arrives WITH the swipe. */}
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
                      {copy(sound)}
                    </Animated.View>
                  ) : null,
                )
              : null}
          </View>
        </GestureDetector>

        <View style={styles.sliderBlock}>
          <PlayerScrubberLive onSeek={onSeek} />
        </View>

        <View style={styles.spacer} />

        {/* Plain glyphs, equal weight, hierarchy by SIZE — the FAB is gone
            with the accent it wore. Same sizes as the iOS transport, from the
            shared terms. EACH GLYPH STANDS IN A STATED BOX
            (`TRANSPORT_GLYPH_BOX_RATIO`, the iOS hosts' own contract): the
            drawn play and pause glyphs have different intrinsic widths, so an
            unboxed row re-laid the skips sideways on every toggle — the
            horizontal CLS iOS never had, because its hosts always stated
            their boxes (Juan, 2026-09-08). */}
        <View ref={transportRowRef} style={styles.transportRow}>
          <GlyphButton
            onPress={onPrevious}
            hitSlop={12}
            style={styles.skipBox}
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
            style={styles.playBox}
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
            style={styles.skipBox}
            accessibilityLabel={t('player.next')}
          >
            <NextGlyph color={colors.onSurface} size={TRANSPORT_SKIP_SIZE} />
          </GlyphButton>
        </View>

        <View style={styles.spacerLower} />

        <Footer
          cards={cards}
          editA11yLabel={t('player.menu.edit')}
          editLabel={t('player.menu.editShort')}
          onEdit={onEdit}
          width={contentWidth}
        />
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
  dragZone: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // A flex column from the artwork's bottom edge to the banner's line, so the
  // spacers can distribute what used to be dead screen.
  body: {
    bottom: 0,
    left: 0,
    paddingHorizontal: PLAYER_SIDE_PADDING,
    position: 'absolute',
    right: 0,
  },
  spacer: { flex: 1 },
  spacerLower: { flex: SPACER_LOWER_WEIGHT },
  titleSlot: { width: '100%' },
  // The copy's breathing room — the iOS file's one hand-placed gap.
  titleBlock: { paddingBottom: 30, width: '100%' },
  titleGhost: { position: 'absolute', top: 0 },
  title: { fontWeight: '700' },
  sliderBlock: { position: 'relative', width: '100%' },
  transportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: TRANSPORT_GAP,
    justifyContent: 'center',
    width: '100%',
  },
  // Stated glyph boxes — see the transport comment above.
  skipBox: {
    alignItems: 'center',
    height: Math.round(TRANSPORT_SKIP_SIZE * TRANSPORT_GLYPH_BOX_RATIO),
    justifyContent: 'center',
    width: Math.round(TRANSPORT_SKIP_SIZE * TRANSPORT_GLYPH_BOX_RATIO),
  },
  playBox: {
    alignItems: 'center',
    height: Math.round(TRANSPORT_PLAY_SIZE * TRANSPORT_GLYPH_BOX_RATIO),
    justifyContent: 'center',
    width: Math.round(TRANSPORT_PLAY_SIZE * TRANSPORT_GLYPH_BOX_RATIO),
  },
  // The footer bar — the banner's chrome, stated (see `Footer`). No outline:
  // tone + the elevation shadow are Material's floating grammar (Juan,
  // 2026-09-08, retiring the hairline here and on the banner in one breath).
  footer: {
    borderRadius: FLOATING_RADIUS,
    elevation: FOOTER_ELEVATION,
  },
  footerRow: { flexDirection: 'row', height: '100%', width: '100%' },
  footerHalfSlot: { flex: 1 },
  footerDivider: {
    bottom: 12,
    left: 0,
    position: 'absolute',
    top: 12,
    width: HAIRLINE,
  },
  footerHalf: { height: '100%', width: '100%' },
  // Leading-aligned rows — the iOS file's argument about where slack reads
  // as emptiness.
  footerHalfPress: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: '100%',
    paddingHorizontal: FOOTER_ROW_PADDING,
  },
  footerIconHost: { height: FOOTER_ICON, width: FOOTER_ICON },
  footerCopy: { flex: 1, gap: 1 },
  footerEditSlot: { flexShrink: 0 },
  footerEditPress: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: '100%',
    paddingHorizontal: FOOTER_ROW_PADDING,
  },
});
