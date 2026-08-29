import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  artworkRadius,
  emptyMediaColor,
  emptyMediaPlusStyle,
  EMPTY_MEDIA_CAPTION_GAP,
  EMPTY_MEDIA_PLUS,
  TEXT_VARIANTS,
} from '@portfolio/mobile-ui';

import { NowPlayingBars } from '@/components/sounds/NowPlayingBars';
import { SoundArt } from '@/components/ui/SoundArt';
import { SquashPressable } from '@/components/ui/SquashPressable';
import { Text, type TextVariant } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { type Sound } from '@/services/firebase/sounds';
import { opticalTextInset, SCREEN_PADDING, TILE_GAP } from '@/styles/metrics';
import { CONTINUOUS_CURVE, SHAPE_MD } from '@/styles/shape';

// The home grid cell: a square artwork tile (the sound's embedded cover, or the
// music glyph) with the title + artist under it — YT Music's album-tile
// language, one sound per tile. Tap = play, long-press = edit.

const IS_IOS = Platform.OS === 'ios';

/**
 * THE GRID CELL — DERIVED FROM THE WINDOW, NOT MEASURED AND NOT A CONSTANT.
 *
 * It was a stated 178 (402 screen − 2 × 16 gutter − 14 gap, halved) whose own
 * comment promised that making it dynamic was the one change "everything below
 * follows". This is that change, and it was forced by a real cost rather than
 * by tidiness.
 *
 * THE TILE USED TO MEASURE ITS OWN ART BOX (`useState(0)` + `onLayout`), so the
 * FIRST frame handed `SoundArt` a `displayWidth` of `undefined` — and
 * `ArtImage` reads `displayWidth ? thumbUrl(...) : uri`, so that frame pointed
 * the native view at the RAW Cloudinary original. The measurement arrived a
 * frame later and the tile re-requested `w_356`, changing `recyclingKey` with
 * it.
 *
 * WHAT THAT ACTUALLY COST, MEASURED, because the obvious guess is wrong and
 * the next person will make it too. It looks like a full-size download per
 * tile, and it is NOT: expo-image cancels the in-flight load when the source
 * prop changes, and the re-render lands within milliseconds. Verified by
 * clearing expo-image's disk cache, cold-starting on the OLD code and matching
 * every file by MD5 against each candidate url — 19 files, 192,754 bytes, all
 * of them `w_356` tiles plus one `w_92` banner, and NOT ONE raw original. The
 * raw originals sitting in a day-old cache came from the three slots that
 * passed no `displayWidth` at all (the editor previews and the idle banner),
 * fixed separately in f125517. Do not re-attribute those here.
 *
 * So what this removes is a request started and abandoned per tile per mount,
 * a `recyclingKey` churn, and a second render — not bytes. Worth doing, worth
 * being honest about the size of.
 *
 * THE OTHER HALF IS CORRECTNESS, and it is the part that is not a micro-win: a
 * window width is available synchronously, so there is nothing to wait for.
 * This is the shape `chrome.ts` already uses for the player's artwork
 * (`playerArtSize(winW)`), and the root AGENTS.md's rule that a measurement
 * must never sit on the layout path of its own first frame. It reproduces the
 * old 178.0 exactly at 402pt and is simply correct on every other width, where
 * the frozen 178 had the cover, its corner and its bone all disagreeing with
 * the box they were in.
 */
export const soundGridCell = (winW: number): number =>
  (winW - SCREEN_PADDING * 2 - TILE_GAP) / 2;

/**
 * CAPTION TYPE, sized against the COVER rather than taken from the shared
 * scale — and stepped, not scaled.
 *
 * The shared `bodyMedium` / `bodySmall` (14 / 12) is what Topper's rail tile
 * uses, and it is right THERE: a 124pt cover with a 14pt title puts the caption
 * at 0.113 of the artwork. Under this app's 178pt grid cover the same 14 falls
 * to 0.079 and reads dwarfed — the tile is 44% wider and the words under it are
 * not, which is the disproportion Juan called out (2026-08-20). The 15 / 13
 * this file already carried only half-closed it, at 0.084.
 *
 * SO WHY NOT A RATIO, the way the artwork corner and the add tile's plus are?
 * Because type is not geometry. iOS text styles are a fixed, named ladder that
 * Dynamic Type scales as a unit; deriving a point size from a container's width
 * leaves that ladder, ships a size Apple never draws, and breaks the moment
 * someone raises their text size. The right move is to step UP the ladder, not
 * off it.
 *
 * 17 / 15 is `body` / `subheadline` — both real styles, and the pairing Apple
 * captions a large artwork cell with. It lands at 0.096 of the cover: not
 * Topper's 0.113, and it should not be, because a smaller tile carries a
 * proportionally larger caption. Compared on device against 15/13 and 16/14
 * (16 is `callout`, but 14 is nothing on the ladder — that pair was off it).
 *
 * WEIGHT STAYS REGULAR, and the split with the banner is deliberate. The same
 * sound name is semibold in the collapsed banner (`miniTitle`) and bold in the
 * expanded console, and one rule explains all three: WHERE THE ANCHOR IS. The
 * banner and the console have no artwork to carry the message, so the name IS
 * the message and takes the weight. Here the message is 178pt of cover and the
 * name is its label — which is also why Topper's rail tile captions regular,
 * and this grid should not drift off that.
 *
 * Rendered against Medium and Semibold in both appearances (2026-08-20). 17/600
 * is `headline`, so it is on the ladder and it does read more deliberate, but
 * it turns a calm library into a store listing and puts the caption in
 * competition with the cover. 17/500 was rejected outright: Medium is not a
 * named iOS style, the same defect that ruled out 16/14 above.
 *
 * The `+ 5` leading below is not a house rule either: it reproduces Apple's own
 * for both, 17/22 and 15/20. If either size moves off this pair, check the
 * leading against the real style rather than keeping the arithmetic.
 *
 * ANDROID STEPS TOO, AND FOR THE SAME MEASURED REASON — it was left on the
 * shared scale while iOS moved, and so sat at exactly the ratio this note
 * records as the half-measure. Its cell is (384 − 32 − 16) / 2 = 168dp on the
 * A54, and `bodyMedium`'s 14 under it is **0.083** — the 0.084 called out
 * above, one device over.
 *
 * The move is the same shape as iOS's and lands in the same place: STEP UP THE
 * PLATFORM'S OWN LADDER rather than scale. `bodyLarge` / `bodyMedium` (16 / 14)
 * are named Material roles, Dynamic-Type-equivalent under Android's font-size
 * setting, and 16/168 = **0.095** against iOS's 0.096 — the two twins now
 * caption a large cover at the same proportion, each in its own type language.
 */
const CAPTION_TITLE = 17;
const CAPTION_SUB = 15;

/**
 * Android's caption steps, named once so the tile and its skeleton cannot
 * disagree — `LINES` reads its line boxes straight off these.
 */
const ANDROID_CAPTION_TITLE = 'bodyLarge' as const;
const ANDROID_CAPTION_SUB = 'bodyMedium' as const;

/**
 * THE TWO VARIANTS THE CAPTIONS ARE TYPESET IN, resolved per platform and
 * EXPORTED — the tile renders them and `SoundTileSkeleton` stands an invisible
 * `Text` at the same two to reserve its line boxes.
 *
 * It is the variant that is shared rather than the line height, and that is the
 * whole point: an Android `Text` does not render at its stated `lineHeight`,
 * so a bone built from the number was 3.91dp short per row even though the
 * number itself was correctly imported. See `CaptionLine`.
 */
export const CAPTION_VARIANTS = {
  title: (IS_IOS ? 'bodyMedium' : ANDROID_CAPTION_TITLE) as TextVariant,
  subtitle: (IS_IOS ? 'bodySmall' : ANDROID_CAPTION_SUB) as TextVariant,
};

/**
 * TYPE IS NOT GEOMETRY, so these do NOT follow the cell — see `CAPTION_TITLE`.
 * They are the only terms below that stay fixed while the box moves.
 */
const LINES = Platform.select({
  ios: { title: CAPTION_TITLE + 5, subtitle: CAPTION_SUB + 5 },
  default: {
    title: TEXT_VARIANTS[ANDROID_CAPTION_TITLE].lineHeight as number,
    subtitle: TEXT_VARIANTS[ANDROID_CAPTION_SUB].lineHeight as number,
  },
}) as { title: number; subtitle: number };

/**
 * THE TILE'S GEOMETRY, EXPORTED FOR ITS SKELETON — style objects, not a copy of
 * their numbers.
 *
 * `SoundTileSkeleton` stood a hand-copied set that had rotted: a 26 radius
 * against this file's 27, and a caption block of 16 + 6 + 12 = 34pt against the
 * real 22 + 1 + 20 = 43. Nine points of jump per row on settle, invisible in
 * the skeleton itself. Topper's rail hit the identical bug (its labels traced
 * 15/13 against 20/18 line boxes and left the rail 10pt short) and its
 * `Skeleton.tsx` records the rule this now follows: reserve the LINE BOX, draw
 * the bar thinner inside it.
 */
export type SoundTileMetrics = {
  /** The cell's side — the artwork is square and fills it. */
  cell: number;
  /**
   * ARTWORK, so the shared RATIO rather than the grouped-container constant
   * this used to pass. `TILE_RADIUS` is 26 — the iOS grouped-list radius, which
   * is correct for a card and wrong in kind for a cover — and it agreed with
   * the ratio only by coincidence at the old fixed cell size (0.15 × 178 = 27).
   * Topper's rail tile draws its cover from the same function at 124pt; that is
   * what keeps the two apps' artwork one shape family instead of two that
   * happen to match. (`artworkRadius` returns the Android STEP unchanged on
   * Android, so only iOS's corner moves with the box.)
   */
  artRadius: number;
  artToCaption: number;
  /**
   * The optical nudge the captions take to clear the artwork's rounded corner.
   * The BONES need it too, and did not have it: they sat flush at the tile's
   * left edge while the real text starts 6pt in, so every caption jumped right
   * on settle. Vertical geometry was shared here and horizontal was not, which
   * is the same defect one axis over. Topper's rail skeleton had it right
   * (`railBodyIos`), which is why the jump showed up in one app and not the
   * other.
   */
  captionInset: number;
  /** The gap the title's own `marginBottom` opens under it. */
  titleGap: number;
  lines: { title: number; subtitle: number };
};

/**
 * THE TILE'S GEOMETRY, DERIVED FROM ITS BOX AND SHARED WITH ITS SKELETON —
 * style objects, not a copy of their numbers.
 *
 * `SoundTileSkeleton` stood a hand-copied set that had rotted: a 26 radius
 * against this file's 27, and a caption block of 16 + 6 + 12 = 34pt against the
 * real 22 + 1 + 20 = 43. Nine points of jump per row on settle, invisible in
 * the skeleton itself. Topper's rail hit the identical bug (its labels traced
 * 15/13 against 20/18 line boxes and left the rail 10pt short) and its
 * `Skeleton.tsx` records the rule this now follows: reserve the LINE BOX, draw
 * the bar thinner inside it.
 *
 * It is a FUNCTION now rather than a frozen object, because the cell it is
 * derived from is. Both surfaces take it through `useSoundTileMetrics` so the
 * bone and the tile cannot land on different widths.
 */
export const soundTileMetrics = (cell: number): SoundTileMetrics => {
  const artRadius = artworkRadius(cell, SHAPE_MD);

  return {
    cell,
    artRadius,
    artToCaption: EMPTY_MEDIA_CAPTION_GAP,
    captionInset: Platform.select({
      ios: opticalTextInset(artRadius),
      default: 0,
    }) as number,
    titleGap: 1,
    lines: LINES,
  };
};

/** The grid's geometry for the current window — tile and bone read the same. */
export const useSoundTileMetrics = (): SoundTileMetrics =>
  soundTileMetrics(soundGridCell(useWindowDimensions().width));

type SoundTileProps = {
  sound: Sound;
  /** Tinted primary while this sound is the loaded one. */
  isCurrent: boolean;
  /** Drives the now-playing bars: animating while playing, frozen paused. */
  isPlaying: boolean;
  /** Playback speed, so the bars beat in time with the music. */
  rate: number;
  onPress: () => void;
  onLongPress: () => void;
};

export function SoundTile({
  sound,
  isCurrent,
  isPlaying,
  rate,
  onPress,
  onLongPress,
}: SoundTileProps) {
  const { colors } = useAppTheme();
  // Derived, never measured — the first frame must already know this, or the
  // cover is fetched at its stored size. See `soundGridCell`.
  const { artRadius, captionInset, cell } = useSoundTileMetrics();

  return (
    <SquashPressable onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.art}>
        <SoundArt
          artUrl={sound.artUrl || undefined}
          displayWidth={cell}
          size={cell}
          title={sound.name}
          style={[styles.artMedia, { borderRadius: artRadius }]}
        />
        {isCurrent ? (
          <View style={styles.nowPlaying} pointerEvents="none">
            <NowPlayingBars playing={isPlaying} rate={rate} />
          </View>
        ) : null}
      </View>
      {/* ACTIVE IS NOT TINTED ON iOS, and the reason is in the sentence this
          comment used to end with: the state is ALREADY carried
          non-chromatically by the bars over the artwork. That made the tint a
          second encoding of one fact, and redundant chroma is exactly what the
          portfolio's monochrome rule removes — the bars are white hairlines on
          a scrim precisely because a brand-coloured badge "reads like a sticker
          slapped on the cover", and a brand-coloured TITLE is the same
          instinct one line down.

          ANDROID KEEPS THE TINT: Material marks an active list item with the
          accent, and that is what a Material surface should draw.

          Weight is not the alternative — it re-truncates. "Nightmare" measures
          77.00pt regular against 82.00pt semibold, 6.5% wider, so a name that
          just fits would ellipsize the moment it started playing. */}
      <Text
        doNotTranslate
        text={sound.name}
        variant={CAPTION_VARIANTS.title}
        numberOfLines={1}
        style={[
          styles.name,
          { paddingLeft: captionInset },
          isCurrent && Platform.OS !== 'ios' && { color: colors.primary },
        ]}
      />
      <Text
        doNotTranslate
        muted
        text={sound.artist || ' '}
        variant={CAPTION_VARIANTS.subtitle}
        numberOfLines={1}
        style={[styles.artist, { paddingLeft: captionInset }]}
      />
    </SquashPressable>
  );
}

/** The trailing "add a sound" cell — a dashed square with a plus. */
export function AddSoundTile({ onPress }: { onPress: () => void }) {
  const { colors, scheme } = useAppTheme();
  const { t } = useI18n();
  const { artRadius, captionInset, cell } = useSoundTileMetrics();

  return (
    <SquashPressable onPress={onPress} accessibilityLabel={t('home.addSound')}>
      <View
        style={[
          styles.art,
          styles.addBox,
          { borderRadius: artRadius },
          // A FILLED placeholder, on BOTH platforms now. A dashed border reads
          // as a web/Material dropzone — Material has no dashed drop target in
          // its own component set either — and Apple's nearest equivalent, the
          // iWork document manager's "Create Document" cell, is a filled tile.
          // A fill keeps the grid's rhythm by reading as "another tile, empty"
          // rather than as a hole in it. Matched with Topper's rail, which made
          // the same move.
          //
          // ANDROID'S DASHED OUTLINE WAS INVISIBLE IN LIGHT — a `border`
          // hairline on the #F1F1F3 page, so the leading cell of the grid read
          // as empty space rather than as the app's one create affordance. It
          // survived only because this file was frozen while iOS moved.
          //
          // `emptyMediaColor` is the portfolio's ONE material for an art-less
          // box, and it already answers per platform: `surfaceContainer` (the
          // solid systemGray5) on iOS, `surfaceVariant` on Android. That is
          // also exactly what the art-less SOUND tiles beside this one draw, so
          // the two placeholders on one grid are now one material instead of
          // two different ideas.
          { backgroundColor: emptyMediaColor({ colors, scheme }) },
        ]}
      >
        {/* THE SHARED PLUS SPEC, on both platforms. Android hard-coded 40 on a
            cell that is now derived — 0.238 of a 168dp box, which is precisely
            the 0.225 Topper's rail tile was moved OFF for reading as "a small
            mark in a large empty square" (Juan, 2026-08-16). The ratio is 0.3
            and it belongs to `emptyMediaPlusStyle`, which also carries the
            explicit line height the glyph needs at this size. */}
        <Text
          doNotTranslate
          text={EMPTY_MEDIA_PLUS}
          style={emptyMediaPlusStyle(cell)}
        />
      </View>
      {/* TWO CAPTION LINES, like every real tile — and the second one is not
          filler. Sound Shaper's add tile goes STRAIGHT to the file picker
          (Topper's opens an editor, which is why its create tile needs no
          second line), so what belongs here is what the picker wants. That is
          MP3 and only MP3: `uploadSoundAudio` labels every upload `audio/mpeg`
          and `readId3Tags` reads ID3v2, so anything else arrives mislabelled
          and untagged. Saying so on the tile is cheaper than finding out after
          the upload. Muted, like the artist line it stands in for. */}
      <Text
        text="home.addSound"
        variant={CAPTION_VARIANTS.title}
        style={[styles.name, { paddingLeft: captionInset }]}
      />
      <Text
        muted
        text="home.addSoundFormat"
        variant={CAPTION_VARIANTS.subtitle}
        style={[styles.artist, { paddingLeft: captionInset }]}
      />
    </SquashPressable>
  );
}

const styles = StyleSheet.create({
  nowPlaying: { bottom: 8, left: 8, position: 'absolute' },
  // The shared artwork-to-caption gap, which Topper's create tile and the item
  // editor's picker also take — it was a bare 10 here, the value that spec was
  // written from.
  art: { aspectRatio: 1, marginBottom: EMPTY_MEDIA_CAPTION_GAP, width: '100%' },
  artMedia: { height: '100%', width: '100%', ...CONTINUOUS_CURVE },
  addBox: {
    alignItems: 'center',
    justifyContent: 'center',
    ...CONTINUOUS_CURVE,
  },
  // iOS's sizes come from CAPTION_TITLE / CAPTION_SUB above; Android's come
  // from its variant (`ANDROID_CAPTION_TITLE` / `_SUB`), so nothing is stated
  // twice.
  // The optical nudge stays iOS-only: the caption sits under the artwork's
  // rounded bottom corners, which curve the edge inward right where the text
  // starts, so flush to the true edge it reads as hanging past the cover.
  // Android's corner is the flat M3 step rather than a continuous curve, so
  // there is far less edge to compensate for and it keeps the flush edge.
  name: {
    marginBottom: 1,
    ...Platform.select({
      ios: { fontSize: CAPTION_TITLE, lineHeight: CAPTION_TITLE + 5 },
    }),
  },
  artist:
    Platform.select({
      ios: { fontSize: CAPTION_SUB, lineHeight: CAPTION_SUB + 5 },
    }) ?? {},
});
