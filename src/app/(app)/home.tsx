import { useCallback, useEffect, useRef, useState } from 'react';

import { Platform, StyleSheet, View } from 'react-native';

import * as DocumentPicker from 'expo-document-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Animated, {
  useAnimatedRef,
  useReducedMotion,
} from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Sortable, {
  type SortableGridDragEndParams,
  type SortableGridRenderItem,
} from 'react-native-sortables';

import {
  bannerBottomOffset,
  MINI_PLAYER_HEIGHT,
} from '@/components/player/bannerMetrics';
import { PlayerSheet } from '@/components/player/PlayerSheet';
import {
  EditSoundSheet,
  type PickedSoundFile,
} from '@/components/sounds/EditSoundSheet';
import { AddSoundTile, SoundTile } from '@/components/sounds/SoundTile';
import { HeaderSettingsButton } from '@/components/ui/HeaderSettingsButton';
// DEV LAB — delete with `src/dev/uiStateLab`.
import { Screen } from '@/components/ui/Screen';
import { SKELETON_DELAY_MS, SoundTileSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useAppTheme, TILE_GAP, SCREEN_PADDING } from '@/core';
import { UI_STATE_LAB, useUiStateLab } from '@/dev/uiStateLab';
import { UiStateLabBar } from '@/dev/UiStateLabBar';
import { useDelayedShow } from '@/hooks/useDelayedShow';
import { useI18n } from '@/i18n';
import {
  needsPositionRepair,
  positionForMove,
  renormalized,
} from '@/lib/gridOrder';
import { haptics } from '@/lib/haptics';
import { readId3Tags } from '@/lib/id3';
import {
  backfillSoundPositions,
  moveSound,
  renormalizeSoundPositions,
  type Sound,
} from '@/services/firebase/sounds';
import { setAddTilePosition } from '@/services/firebase/users';
import { useAuthStore } from '@/store/auth';
import { stashPendingUpload } from '@/store/pendingUpload';
import { usePlayerStore } from '@/store/player';
import { useProfileStore } from '@/store/profile';
import { useSoundsStore } from '@/store/sounds';
import {
  DRAG_ACTIVE_SCALE,
  StateWrap,
  EmptyState,
  HeaderIconButton,
  useHeaderScroll,
  useSnackbar,
} from '@/ui';

/**
 * ONE GRID CELL — a sound, or the add tile.
 *
 * THE ADD TILE IS AN ENTRY IN THE ORDER, NOT A HEADER. It used to lead
 * unconditionally, "so it stays reachable no matter how long the library
 * grows", and Juan reversed that on 2026-09-11: the grid reorders in both
 * directions and the add tile goes wherever you park it. Its slot is a real
 * position in the same fractional keyspace the sounds use — see
 * `lib/gridOrder.ts` — and it lives on the USER document, because it is the
 * one tile with no sound behind it.
 *
 * A library that has never been reordered still opens with the add tile first:
 * `addTilePosition` is `null` until somebody moves it, which sorts ahead of
 * the backfill's `0`.
 */
export const ADD_TILE_KEY = '__add__';

export type GridCell =
  | (Sound & { kind: 'sound' })
  | { id: typeof ADD_TILE_KEY; kind: 'add'; position: number | null };

const IS_IOS = Platform.OS === 'ios';
// M3's small top app bar. Android only — iOS draws the collapsing header.
const APP_BAR_HEIGHT = 64;
/**
 * Clearance above the first grid row.
 *
 * iOS: `contentInsetAdjustmentBehavior="automatic"` hands the list the large
 * title's height as a content inset, but UIKit leaves only ~11pt of its own
 * under the title's ink — band-scanned at 10.67 here, with the first cover
 * starting at 168.00pt against a title whose ink ends at 157.33. That is the
 * bare value Topper measured and REJECTED as "the first section glued to the
 * title", and it spends 24 on top of it (`TITLE_TO_FIRST_SECTION`). The same
 * 24 lands this grid's first cover 34.67pt below the title ink, against
 * Topper's section header box at ~35 — the two screens' first content then
 * starts at the same place, which is the thing to keep true. Topper's number
 * reads as a bigger gap only because a text row has leading above its ink and
 * a cover has none.
 *
 * Android's app bar sits directly on the content, so this IS the gap, and it
 * is set to match Topper: copying the outcome is the only way to actually
 * match it — Topper reaches its figure by accident (list padding plus the
 * header text's own leading) — and it DRIFTS when Topper's home is reworked:
 * this was 29.5 against a measured 31.6 until the 2026-09-04 rail-tile rework
 * moved Topper's first ink, found 3.9dp adrift on 2026-09-08. A retune
 * re-measures Topper first.
 *
 * 21.6, since the 2026-09-08 screen-top halving that followed the on-scroll
 * bar (Topper's list top went 12 → 8, so its "Your Tops" ink gap went
 * 25.6 → 21.6 — measured on the A54: ink 347px → 336px below one fixed bar,
 * exactly the 4dp).
 */
const GRID_TOP_GAP = IS_IOS ? 24 : 21.6;

/**
 * ROWS OF BONES the first-load skeleton stands.
 *
 * EXPORTED because the dev lab's note describes it in prose, and prose about a
 * number drifts the moment the number does — this went "three bones" → "two
 * full rows" → "three full rows" in one sitting, and was wrong at each step
 * until someone noticed. The note now counts these rows rather than restating
 * them (see `HOME_STATES`).
 *
 * Three because two stop at 690pt on an 874pt screen, leaving a blank band
 * above the player banner that reads as "this is all there is" rather than as
 * content still arriving. At a 249pt row pitch the third runs off the bottom
 * edge, which is what filling the screen means here.
 */
export const SKELETON_ROWS = 3;

/**
 * THE GRID'S TWO GAPS, SHARED BY THE SORTABLE AND THE SKELETON.
 *
 * They were one StyleSheet rule (`gridRow`) while the grid was hand-paired
 * rows, and the Sortable states them as props instead — so the moment the two
 * stopped being the same object they could drift, which is this repo's most
 * recurrent layout bug and the reason `SoundTileSkeleton` shares
 * `soundTileMetrics` in the first place. Stated once, read by both.
 *
 * The row gap is four points wider than the column gap and always has been: a
 * caption sits under every tile, so the vertical boundary carries text-to-art
 * where the horizontal one carries art-to-art. Band-scanned before and after
 * the Sortable landed — artwork row two starts at the same place.
 */
export const GRID_COLUMN_GAP = TILE_GAP;
export const GRID_ROW_GAP = TILE_GAP + 4;

/**
 * The grid's cells in display order: the library (already grid-ordered by the
 * store) with the add tile slotted in at its own position.
 *
 * The sounds are NOT re-sorted here — `useSoundsStore` holds them in order, so
 * doing it again would be the second copy of one rule. Only the add tile has
 * to be placed, and a `null` position means it has never been moved, which
 * puts it first.
 */
const toGridCells = (
  sounds: Sound[],
  addTilePosition: number | null,
): GridCell[] => {
  const cells: GridCell[] = sounds.map(sound => ({ ...sound, kind: 'sound' }));
  const addTile: GridCell = {
    id: ADD_TILE_KEY,
    kind: 'add',
    position: addTilePosition,
  };

  if (addTilePosition === null) return [addTile, ...cells];

  const slot = cells.findIndex(
    cell => cell.position !== null && cell.position > addTilePosition,
  );

  if (slot === -1) return [...cells, addTile];

  return [...cells.slice(0, slot), addTile, ...cells.slice(slot)];
};

// The whole library on one screen: the app's header (one Settings gear — the
// same bar every app in the portfolio opens on) over a 2-column grid of sound
// tiles — YT Music's album-tile
// language, one sound per tile. No playlists: you upload one and it's there.
// Tap = play (and the player opens); long-press = edit/delete; the add tile
// closes the grid.
export default function HomeScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sounds = useSoundsStore(s => s.sounds);
  const rawError = useSoundsStore(s => s.error);
  const retry = useSoundsStore(s => s.retry);
  const hasSettled = useSoundsStore(s => s.hasSettled);
  const playSound = usePlayerStore(s => s.playSound);
  const requestExpand = usePlayerStore(s => s.requestExpand);
  const currentSoundId = usePlayerStore(s => s.current?.id);
  const isPlaying = usePlayerStore(s => s.playing);
  const rate = usePlayerStore(s => s.rate);
  const sheetExpanded = usePlayerStore(s => s.sheetExpanded);
  const showSkeleton = useDelayedShow(SKELETON_DELAY_MS);

  /**
   * DEV LAB: force a UI state. Applied to the values the screen already
   * derives, so every branch below renders for real.
   */
  const labState = useUiStateLab(state => state.home);
  const lab = UI_STATE_LAB && labState !== 'live';

  const [pickedFile, setPickedFile] = useState<PickedSoundFile | null>(null);
  const [editingSoundId, setEditingSoundId] = useState<string | null>(null);

  const openAddSound = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      /**
       * MP3, NOT `audio/*`. The picker used to offer every audio type while
       * the pipeline behind it takes exactly one: `uploadSoundAudio` labels
       * every upload `audio/mpeg` and `readId3Tags` reads ID3v2, so an .m4a
       * was accepted, uploaded mislabelled and arrived with no tags at all.
       * A picker that offers what the app cannot keep is the app lying to
       * you before you have even chosen. The Add Sound tile says MP3 for the
       * same reason; the two now agree.
       */
      type: 'audio/mpeg',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const tags = await readId3Tags(asset.uri);
    const picked = { uri: asset.uri, fileName: asset.name, tags };

    // iOS presents the editor as a native form-sheet ROUTE; the picked file
    // rides the pendingUpload handoff (too large for a route param). Android
    // mounts the Compose sheet in place.
    if (Platform.OS === 'ios') {
      stashPendingUpload(picked);
      router.push('/edit-sound');
      return;
    }

    setPickedFile(picked);
  }, []);

  const onPressSound = useCallback(
    (sound: Sound) => {
      playSound(sound, sounds);
      // Tapping a tile is "listen to this now" — open the full player on it.
      requestExpand();
    },
    [playSound, requestExpand, sounds],
  );

  /**
   * A COVER TAPPED ON THE HOME SCREEN WIDGET.
   *
   * The widget links to `soundshaper://home?play=<id>`, and the library it
   * drew is a snapshot that may be older than this session — so the id is
   * matched against the live store and simply ignored when it names a sound
   * that has since been deleted. On a cold start the grid has not arrived
   * yet; the effect re-runs when it does.
   */
  const { play } = useLocalSearchParams<{ play?: string }>();
  const handledPlay = useRef<string | null>(null);

  useEffect(() => {
    if (!play || handledPlay.current === play) return;

    const sound = sounds.find(candidate => candidate.id === play);

    if (!sound) return;

    handledPlay.current = play;
    onPressSound(sound);
  }, [onPressSound, play, sounds]);

  const firstLoad = lab ? labState === 'skeleton' : !hasSettled;
  const error = lab ? labState === 'error' : rawError;
  const addTilePosition = useProfileStore(
    s => s.profile?.addTilePosition ?? null,
  );
  const cells = toGridCells(sounds, addTilePosition);

  // Android's hand-drawn bar takes the same on-scroll step as every navigator
  // bar in the portfolio: the page's own ground at rest, `surface` once the
  // grid is behind it. The SHARED hook, with no colours — this bar is not the
  // navigator's, so the screen paints from `scrolled` itself (the omit case
  // the hook's docblock names). No-op on iOS, where the system bar owns it.
  const { scrolled, scrollProps } = useHeaderScroll();

  /**
   * OPEN THE EDITOR — the door a long-press used to be, and still is, with one
   * step in front of it (see `handleDragEnd`).
   */
  const openEditor = useCallback((soundId: string) => {
    if (Platform.OS === 'ios') {
      router.push({ pathname: '/edit-sound', params: { soundId } });

      return;
    }

    setEditingSoundId(soundId);
  }, []);

  const renderCell = useCallback<SortableGridRenderItem<GridCell>>(
    ({ item }) => (
      <View style={styles.cell}>
        {item.kind === 'add' ? (
          <AddSoundTile onPress={openAddSound} />
        ) : (
          <SoundTile
            sound={item}
            isCurrent={item.id === currentSoundId}
            isPlaying={item.id === currentSoundId && isPlaying}
            rate={rate}
            onPress={() => onPressSound(item)}
            /* The long-press belongs to the DRAG now. A hold that never moves
               still opens the editor — see `handleDragEnd` — so this stays
               wired for the platforms' own accessibility actions rather than
               being the gesture's only door. */
            onLongPress={() => openEditor(item.id)}
          />
        )}
      </View>
    ),
    [openAddSound, onPressSound, openEditor, currentSoundId, isPlaying, rate],
  );

  /**
   * THE DRAG — long-press a tile, move it anywhere in two dimensions, drop.
   *
   * ONE DOCUMENT IS WRITTEN, whatever the tile travelled past: the fractional
   * index means a move only has to state where the tile now sits, not restate
   * the whole order. That is what makes two phones dragging at once merge
   * instead of scrambling, and the argument lives in `lib/gridOrder.ts`.
   */
  const uid = useAuthStore(s => s.user?.uid);
  const setDragging = useSoundsStore(s => s.setDragging);
  const applyPosition = useSoundsStore(s => s.applyPosition);
  const setProfile = useProfileStore(s => s.setProfile);
  const { showSnackbar } = useSnackbar();
  const scrollableRef = useAnimatedRef<Animated.ScrollView>();
  const reduceMotion = useReducedMotion();

  const handleDragStart = useCallback(() => {
    haptics.dragPickup();
    setDragging(true);
  }, [setDragging]);

  const handleOrderChange = useCallback(() => haptics.dragMove(), []);

  const handleDragEnd = useCallback(
    async ({
      data,
      fromIndex,
      key,
      toIndex,
    }: SortableGridDragEndParams<GridCell>) => {
      setDragging(false);

      /**
       * A HOLD THAT NEVER MOVED IS STILL THE EDITOR'S DOOR.
       *
       * Long-press used to open the editor outright, and the drag now owns
       * that gesture — there is only one long-press to give. This is the split
       * iOS itself makes on the Home Screen: hold and release opens the menu,
       * hold and move rearranges. A tile dragged away and back to the same
       * slot lands here too, which is a harmless misfire (a dismissible sheet)
       * rather than a lost affordance.
       */
      if (fromIndex === toIndex) {
        const held = data[toIndex];
        if (held && held.kind === 'sound') openEditor(held.id);

        return;
      }

      haptics.dragDrop();

      const position = positionForMove(data, toIndex);
      const previousAddTile = addTilePosition;

      /**
       * FLOAT64 RAN OUT OF ROOM between the two neighbours — re-space the whole
       * order and stop. Rare by construction (~50 drops into one gap), and the
       * only path here that writes every document.
       */
      if (position === null) {
        try {
          const repaired = renormalized(data);
          await renormalizeSoundPositions(
            repaired.filter(entry => entry.id !== ADD_TILE_KEY),
          );

          const addTile = repaired.find(entry => entry.id === ADD_TILE_KEY);
          if (addTile && uid) {
            await setAddTilePosition({ position: addTile.position, uid });
          }
        } catch {
          showSnackbar(t('snackbar.reorder-failed'));
        }

        return;
      }

      // Optimistic, because the grid must not wait on Firestore to show where
      // the tile landed — the drop already moved it under the finger.
      if (key === ADD_TILE_KEY) {
        const profile = useProfileStore.getState().profile;
        if (profile) setProfile({ ...profile, addTilePosition: position });
      } else {
        applyPosition(key, position);
      }

      try {
        if (key === ADD_TILE_KEY) {
          if (!uid) return;
          await setAddTilePosition({ position, uid });
        } else {
          await moveSound({ position, soundId: key });
        }
      } catch {
        showSnackbar(t('snackbar.reorder-failed'));

        // Put it back. The library's own snapshot is the truth for a sound;
        // the add tile's truth is the value we just replaced.
        if (key === ADD_TILE_KEY) {
          const profile = useProfileStore.getState().profile;
          if (profile) {
            setProfile({ ...profile, addTilePosition: previousAddTile });
          }
        } else {
          const live = useSoundsStore
            .getState()
            .sounds.find(sound => sound.id === key);
          if (live?.position != null) applyPosition(key, live.position);
        }
      }
    },
    [
      addTilePosition,
      applyPosition,
      openEditor,
      setDragging,
      setProfile,
      showSnackbar,
      t,
      uid,
    ],
  );

  /**
   * MAKE THE ORDER A TOTAL ORDER — on first sight of a library that is not
   * one, and on any launch that finds it damaged.
   *
   * Two things bring it here. Sounds written before the grid could be
   * reordered carry no `position` at all (they are not hidden — `byGridOrder`
   * sorts them last, newest first, exactly the order they used to have — but
   * they cannot be dragged into a stable slot until they have one). And a
   * DUPLICATE position, which stops `positionBetween` ever finding a slot
   * between the twins, so the grid quietly refuses moves in that region.
   *
   * Both are repaired the same way: re-space the whole library across the
   * order being displayed. It is idempotent, so a run over a partial library
   * is fixed by the next full one rather than compounded — which is exactly
   * what the first version of this got wrong.
   *
   * The ref guards RE-ENTRY, not repetition: it is cleared when the write
   * settles, so a later launch can repair again if it needs to. A permanent
   * latch would have made the damage above unfixable without a reinstall.
   */
  const repairing = useRef(false);

  const fromCache = useSoundsStore(s => s.fromCache);

  useEffect(() => {
    if (repairing.current || !hasSettled || sounds.length === 0) return;
    /**
     * NEVER REPAIR FROM THE CACHE. A cold start is answered from local disk
     * first, and that snapshot can be older than what another device has
     * already fixed — repairing from it writes a stale whole order back over
     * a newer one. Measured: a drag made on the A54 was undone the instant the
     * iOS client cold-started, because its cached library still looked damaged.
     */
    if (fromCache) return;
    if (!needsPositionRepair(sounds)) return;

    repairing.current = true;
    backfillSoundPositions(sounds).finally(() => {
      repairing.current = false;
    });
  }, [fromCache, hasSettled, sounds]);

  /**
   * CLEARANCE FOR THE PLAYER BANNER — and NOT for the home indicator, which
   * `contentInsetAdjustmentBehavior="automatic"` already supplies.
   *
   * This added `insets.bottom` on top of that, so the safe area was counted
   * twice: band-scanned at the scroll's rest position, the last row came to
   * rest 47.33pt above the banner where one grid gutter (14) is wanted —
   * 33.33pt of dead space, which is `insets.bottom` to the pixel. Topper's home
   * carries the same finding one layer up (see its `listContent`), where the
   * padding could go entirely.
   *
   * IT CANNOT GO ENTIRELY HERE, and that is the real difference between the two
   * screens. Topper's tab bar is UIKit's own, so `automatic` insets the scroll
   * content for it; this banner is an RN view mounted INSIDE the screen and
   * UIKit does not know it exists. So the banner's own box still has to be
   * spent by hand — its bottom gap, its height, and one grid gutter, because it
   * is a DETACHED pill rather than a bar welded to the edge. Only the
   * safe-area term was the duplicate.
   */
  const listBottomPadding =
    bannerBottomOffset(insets.bottom) +
    MINI_PLAYER_HEIGHT +
    TILE_GAP -
    // Only iOS gets the safe area for free (see above). Android has no
    // `contentInsetAdjustmentBehavior`, so its nav-bar inset — which is already
    // inside `bannerBottomOffset` there — is the list's to spend too.
    (IS_IOS ? insets.bottom : 0);

  return (
    <Screen>
      {/* iOS: the SYSTEM LARGE TITLE — the 34pt heading in the content that
          settles into the 17pt inline bar as you scroll, with the trailing
          glyphs staying put in the bar the whole way. Same bar Topper's iOS
          home runs, which is what makes the two read as one family; it
          replaced a hand-built Reanimated collapse (`CollapsingHeaderBar` +
          `CollapsingHeaderTitle` — deleted from `src/ui`
          2026-08-27; Android's home never used it either) whose bar buttons
          had to ask SwiftUI for `.glassEffect` by hand because there was no
          real navigation bar to take the material from.

          `headerTransparent` (set stack-wide) is what arms the system
          scroll-edge effect: the bar is clear over the top of the content and
          materialises as Liquid Glass once anything is behind it.

          THE BAR EMPTIES WHILE THE PLAYER IS EXPANDED — it does NOT go away,
          and the difference is a measured bug. RNScreens draws its bar ABOVE
          the screen's content view, so the expanded player (mounted inside this
          screen, meant to be full-bleed) cannot cover it the way it covers
          everything else, and the obvious answer was `headerShown:
          !sheetExpanded`. Hiding the bar RE-LAYS-OUT the screen: the content
          view's origin shifts and the player's bottom-anchored, window-height
          container comes to rest 8.67pt low, leaving a band of the grid above
          it. Band-scanned on iPhone 17 / iOS 26.5 — 8.67pt with the toggle,
          0.67pt with the header never shown at all, so the toggle was the
          cause and not some pre-existing gap.

          Blanking the bar's CONTENTS costs no relayout: with `headerTransparent`
          it already paints nothing, so an empty title and no glyphs leave
          literally nothing on screen, and eight consecutive frames measure
          flush to y=0. The empty bar does not swallow touches either — the
          player's own ⋯ and collapse chevron sit inside its band and both were
          verified working.

          `headerLargeTitle` stays TRUE throughout rather than following
          `sheetExpanded`: toggling it off and back on left the bar showing its
          INLINE title at scroll-top until the next scroll re-armed the large
          one. Held constant, the large title is simply back the moment the
          player collapses.

          Android keeps drawing its OWN Material bar as content, below, for
          precisely the same reason stated the other way round: there the
          navigator's header cannot be hidden per-state without the layout
          jumping, so the bar was made content once and stays that way. */}
      <Stack.Screen
        options={
          IS_IOS
            ? {
                headerShown: true,
                headerLargeTitle: true,
                headerLargeTitleShadowVisible: false,
                headerTitle: sheetExpanded ? '' : t('app.title'),
                headerRight: sheetExpanded
                  ? () => null
                  : () => <HeaderSettingsButton />,
              }
            : { headerShown: false }
        }
      />

      <SafeAreaView style={styles.safeArea} edges={[]}>
        {/* Android only: M3's small top app bar, drawn as content. Same tonal
            container, same 64dp, same 22sp title on the grid margin, and the
            gear is still a real Compose action — the only thing that changed is
            who owns the view, which is what lets the player cover it. iOS takes
            the navigator's own bar instead (see the Stack.Screen above). */}
        {IS_IOS ? null : (
          <View
            style={[
              styles.appBar,
              {
                // M3's on-scroll bar, hand-drawn: the page's own ground at
                // rest — no band at all — stepping to `surface` once the grid
                // is behind it, same pair as every navigator bar in the
                // portfolio (Juan, 2026-09-08, reversing the same-day
                // "always elevated" call along with the family's static bar;
                // the shared hook's docblock carries the full history).
                backgroundColor: scrolled ? colors.surface : colors.background,
                height: insets.top + APP_BAR_HEIGHT,
                paddingTop: insets.top,
              },
            ]}
          >
            {/* No `variant`: this bar's face is stated whole in
                `appBarTitle`. */}
            <Text
              text="app.title"
              numberOfLines={1}
              style={styles.appBarTitle}
            />
            <HeaderIconButton
              name="settings"
              onPress={() => router.push('/settings')}
              accessibilityLabel={t('app.settings')}
            />
          </View>
        )}

        {firstLoad ? (
          showSkeleton ? (
            // `top`, not centred: these bones stand in for real content and
            // have to START where it will — under the large title, with the
            // inset UIKit hands the list itself. A skeleton that begins
            // anywhere else IS layout shift. (Android's `StateWrap` is a plain
            // scroller; the inset behaviour is iOS's.)
            <StateWrap top>
              {/* WHOLE ROWS — three bones and an empty cell is the shape of a
                  grid holding an ODD NUMBER of sounds, a statement about the
                  data a skeleton cannot know and has no business making. How
                  many rows, and why, is `SKELETON_ROWS`. */}
              <View style={styles.skeletonGrid}>
                {Array.from({ length: SKELETON_ROWS }, (_, row) => (
                  <View key={row} style={styles.gridRow}>
                    <View style={styles.cell}>
                      <SoundTileSkeleton />
                    </View>
                    <View style={styles.cell}>
                      <SoundTileSkeleton />
                    </View>
                  </View>
                ))}
              </View>
            </StateWrap>
          ) : null
        ) : error ? (
          // CENTRED, so no `top` — `EmptyState` centres itself in whatever box
          // it gets, and an `automatic` inset would push that centre half the
          // header too low. The contract and the measurement behind it live on
          // `StateWrap`.
          <StateWrap>
            <EmptyState
              systemImage="exclamationmark.triangle"
              title={t('home.error.title')}
              subtitle={t('home.error.subtitle')}
              action={{ label: t('common.retry'), onPress: retry }}
            />
          </StateWrap>
        ) : (
          /* THE GRID IS A SORTABLE, AND THAT COST THE FLASHLIST.
             `Sortable.Grid` reorders inside a real scroller it can drive for
             edge auto-scroll (`scrollableRef`), so the virtualized list had to
             go — the same trade Topper's profile made. A personal library is
             tens of tiles, which is what makes it affordable here and would
             not make it affordable in a feed. */
          <Animated.ScrollView
            ref={scrollableRef}
            style={styles.list}
            // No in-content heading: the stack's native large title owns it.
            // `automatic` is what hands the scroller that title's height as a
            // content inset and drives the collapse — without it the first row
            // starts under the expanded title. Android ignores the prop.
            contentInsetAdjustmentBehavior="automatic"
            // Android only: feeds the hand-drawn bar's on-scroll step above.
            // Not spread on iOS — the system bar arms its own edge effect and
            // nothing here reads `scrolled`.
            {...(IS_IOS ? null : scrollProps)}
            contentContainerStyle={{
              paddingHorizontal: SCREEN_PADDING,
              paddingTop: GRID_TOP_GAP,
              paddingBottom: listBottomPadding,
            }}
          >
            <Sortable.Grid
              columns={2}
              data={cells}
              keyExtractor={cell => cell.id}
              renderItem={renderCell}
              rowGap={GRID_ROW_GAP}
              columnGap={GRID_COLUMN_GAP}
              scrollableRef={scrollableRef}
              activeItemScale={reduceMotion ? 1 : DRAG_ACTIVE_SCALE}
              onDragStart={handleDragStart}
              onOrderChange={handleOrderChange}
              onDragEnd={handleDragEnd}
            />
          </Animated.ScrollView>
        )}

        {pickedFile && (
          <EditSoundSheet
            pickedFile={pickedFile}
            onClose={() => setPickedFile(null)}
          />
        )}
        {editingSoundId && (
          <EditSoundSheet
            soundId={editingSoundId}
            onClose={() => setEditingSoundId(null)}
          />
        )}
      </SafeAreaView>

      {/* The player is not a route: banner and full player are ONE surface
          that expands in place over this screen. It is mounted HERE rather
          than above the Stack because Home is the only screen it belongs on —
          which means it needs no per-route blocklist, and, on iOS, no wait for
          a pathname update. Mounted above the Stack it re-appeared ~430ms
          AFTER a pop back from Settings had finished: react-native-screens
          pops natively and only then tells JS, so the pathname-driven unhide
          landed a beat late. Home's subtree is already rendered underneath the
          pushed screen, so from here it is simply there. Playback is
          unaffected either way — that lives in <AudioEngine>, still mounted in
          the layout. */}
      <PlayerSheet />
      {/* DEV LAB: state picker, clear of the player banner — and GONE while the
          player is expanded. The picker floats above everything at the bottom
          of the screen, so over the full-bleed player it sat on top of the
          transport controls: a dev tool covering the surface it exists to let
          you look at. It pins Home's states, and Home is not what is on screen
          then. */}
      {UI_STATE_LAB && !sheetExpanded ? <UiStateLabBar screen="home" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  appBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    // Material aligns bar content to the grid margin; the trailing icon is
    // 24dp centred in a 48dp box, so 4 lands its glyph on that same margin.
    paddingLeft: 16,
    paddingRight: 4,
  },
  // The navigator's own Android header type, which Topper gets
  // for free by using its header — 20sp medium, NOT the M3 titleLarge token
  // (22sp regular). Drawing this bar ourselves means matching it by hand, and
  // matching the other two apps beats being closer to the spec on this one
  // screen: measured side by side, 22/400 read 9% larger AND lighter.
  //
  // ALL THREE VALUES ARE STATED HERE, and the `Text` takes no `variant`. It
  // used to pass `titleLarge` and then override two of its three properties in
  // this object, so the declaration said 22sp while the screen rendered 20 —
  // and the only thing the variant still contributed was a line box nobody had
  // chosen. The 28 below IS that line box, kept so nothing moves; it is the
  // number to re-measure if this bar's face ever changes again.
  appBarTitle: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 28,
  },
  list: { flex: 1 },
  // The SKELETON's row — the live grid states the same two gaps to
  // `Sortable.Grid` as props. Both read `GRID_ROW_GAP` / `GRID_COLUMN_GAP`.
  gridRow: {
    flexDirection: 'row',
    gap: GRID_COLUMN_GAP,
    marginBottom: GRID_ROW_GAP,
  },
  cell: { flex: 1 },
  // Matches the list's own content inset, so the skeleton lands exactly where
  // the real grid does and nothing shifts when data arrives.
  skeletonGrid: { paddingHorizontal: SCREEN_PADDING, paddingTop: GRID_TOP_GAP },
});
