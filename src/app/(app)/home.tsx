import { useCallback, useState } from 'react';

import { Platform, StyleSheet, View } from 'react-native';

import { StateWrapIos as StateWrap, EmptyState } from '@portfolio/mobile-ui';
import { FlashList } from '@shopify/flash-list';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, router } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  BANNER_BOTTOM_GAP,
  MINI_PLAYER_HEIGHT,
  PlayerSheet,
} from '@/components/player/PlayerSheet';
import {
  EditSongSheet,
  type PickedSongFile,
} from '@/components/songs/EditSongSheet';
import { AddSongTile, SongTile } from '@/components/songs/SongTile';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { HomeBarGlyphsIos } from '@/components/ui/HomeBarGlyphsIos';
// DEV LAB — delete with `src/dev/uiStateLab`.
import { Screen } from '@/components/ui/Screen';
import { SKELETON_DELAY_MS, SongTileSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { UI_STATE_LAB, useUiStateLab } from '@/dev/uiStateLab';
import { UiStateLabBar } from '@/dev/UiStateLabBar';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDelayedShow } from '@/hooks/useDelayedShow';
import { useI18n } from '@/i18n';
import { readId3Tags } from '@/lib/id3';
import { type Song } from '@/services/firebase/songs';
import { stashPendingUpload } from '@/store/pendingUpload';
import { usePlayerStore } from '@/store/player';
import { useSongsStore } from '@/store/songs';
import { TILE_GAP, SCREEN_PADDING } from '@/styles/metrics';

// The grid rows FlashList renders: the add tile plus the songs, pre-paired
// into 2-column rows (FlashList's numColumns + varying tile heights fight each
// other; hand-pairing keeps rows aligned). The add tile leads so it stays
// reachable no matter how long the library grows.
type GridRow = {
  id: string;
  left: Song | 'add';
  right: Song | 'add' | null;
};

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
 * Android's static app bar sits directly on the content, so this IS the gap,
 * and it is set to match Topper: measured on device, Topper leaves 31.6dp
 * between its app bar and the first thing drawn under it, where 8 left this
 * screen's tiles crowding the bar at 8.8dp. Topper reaches that figure by
 * accident — list padding plus a section row's own centring — so copying the
 * outcome is the only way to actually match it.
 */
const GRID_TOP_GAP = IS_IOS ? 24 : 29.5;

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

const toGridRows = (songs: Song[]): GridRow[] => {
  const cells: (Song | 'add')[] = ['add', ...songs];
  const rows: GridRow[] = [];

  for (let index = 0; index < cells.length; index += 2) {
    const left = cells[index];
    rows.push({
      id: typeof left === 'string' ? 'add' : left.id,
      left,
      right: cells[index + 1] ?? null,
    });
  }

  return rows;
};

// The whole library on one screen: the app's header (Account + Settings) over a
// 2-column grid of song tiles — YT Music's album-tile
// language, one song per tile. No playlists: you upload one and it's there.
// Tap = play (and the player opens); long-press = edit/delete; the add tile
// closes the grid.
export default function HomeScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const songs = useSongsStore(s => s.songs);
  const rawError = useSongsStore(s => s.error);
  const retry = useSongsStore(s => s.retry);
  const hasSettled = useSongsStore(s => s.hasSettled);
  const playSong = usePlayerStore(s => s.playSong);
  const requestExpand = usePlayerStore(s => s.requestExpand);
  const currentSongId = usePlayerStore(s => s.current?.id);
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

  const [pickedFile, setPickedFile] = useState<PickedSongFile | null>(null);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

  const openAddSong = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      /**
       * MP3, NOT `audio/*`. The picker used to offer every audio type while
       * the pipeline behind it takes exactly one: `uploadSongAudio` labels
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

  const onPressSong = useCallback(
    (song: Song) => {
      playSong(song, songs);
      // Tapping a tile is "listen to this now" — open the full player on it.
      requestExpand();
    },
    [playSong, requestExpand, songs],
  );

  const firstLoad = lab ? labState === 'skeleton' : !hasSettled;
  const error = lab ? labState === 'error' : rawError;
  const rows = toGridRows(songs);

  const renderCell = useCallback(
    (cell: Song | 'add' | null) => {
      if (cell === null) return <View style={styles.cell} />;

      if (cell === 'add')
        return (
          <View style={styles.cell}>
            <AddSongTile onPress={openAddSong} />
          </View>
        );

      return (
        <View style={styles.cell}>
          <SongTile
            song={cell}
            isCurrent={cell.id === currentSongId}
            isPlaying={cell.id === currentSongId && isPlaying}
            rate={rate}
            onPress={() => onPressSong(cell)}
            onLongPress={() =>
              Platform.OS === 'ios'
                ? router.push({
                    pathname: '/edit-sound',
                    params: { songId: cell.id },
                  })
                : setEditingSongId(cell.id)
            }
          />
        </View>
      );
    },
    [openAddSong, onPressSong, currentSongId, isPlaying, rate],
  );

  const renderRow = useCallback(
    ({ item }: { item: GridRow }) => (
      <View style={styles.gridRow}>
        {renderCell(item.left)}
        {renderCell(item.right)}
      </View>
    ),
    [renderCell],
  );

  // The banner is always parked at the bottom, so the grid always clears it —
  // and it is a DETACHED pill, so "clearing it" means its own bottom gap plus
  // its height plus one grid gutter, not a guessed number.
  const listBottomPadding =
    insets.bottom + BANNER_BOTTOM_GAP + MINI_PLAYER_HEIGHT + TILE_GAP;

  return (
    <Screen>
      {/* iOS: the SYSTEM LARGE TITLE — the 34pt heading in the content that
          settles into the 17pt inline bar as you scroll, with the trailing
          glyphs staying put in the bar the whole way. Same bar Topper's iOS
          home runs, which is what makes the two read as one family; it
          replaced a hand-built Reanimated collapse (`CollapsingHeaderBar` +
          `CollapsingHeaderTitle`, still shared with Android) whose bar buttons
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
                  : () => <HomeBarGlyphsIos />,
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
                backgroundColor: colors.surfaceContainer,
                height: insets.top + APP_BAR_HEIGHT,
                paddingTop: insets.top,
              },
            ]}
          >
            <Text
              text="app.title"
              variant="titleLarge"
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
                  grid holding an ODD NUMBER of songs, a statement about the
                  data a skeleton cannot know and has no business making. How
                  many rows, and why, is `SKELETON_ROWS`. */}
              <View style={styles.skeletonGrid}>
                {Array.from({ length: SKELETON_ROWS }, (_, row) => (
                  <View key={row} style={styles.gridRow}>
                    <View style={styles.cell}>
                      <SongTileSkeleton />
                    </View>
                    <View style={styles.cell}>
                      <SongTileSkeleton />
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
          // `StateWrapIos`.
          <StateWrap>
            <EmptyState
              systemImage="exclamationmark.triangle"
              title={t('home.error.title')}
              subtitle={t('home.error.subtitle')}
              action={{ label: t('common.retry'), onPress: retry }}
            />
          </StateWrap>
        ) : (
          <FlashList
            style={styles.list}
            data={rows}
            keyExtractor={row => row.id}
            renderItem={renderRow}
            // No in-content heading: the stack's native large title owns it.
            // `automatic` is what hands the list that title's height as a
            // content inset and drives the collapse — without it the first row
            // starts under the expanded title. Android ignores the prop.
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{
              paddingHorizontal: SCREEN_PADDING,
              paddingTop: GRID_TOP_GAP,
              paddingBottom: listBottomPadding,
            }}
          />
        )}

        {pickedFile && (
          <EditSongSheet
            pickedFile={pickedFile}
            onClose={() => setPickedFile(null)}
          />
        )}
        {editingSongId && (
          <EditSongSheet
            songId={editingSongId}
            onClose={() => setEditingSongId(null)}
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
  // The navigator's own Android header type, which Topper and Expo UI Starter get
  // for free by using its header — 20sp medium, NOT the M3 titleLarge token
  // (22sp regular). Drawing this bar ourselves means matching it by hand, and
  // matching the other two apps beats being closer to the spec on this one
  // screen: measured side by side, 22/400 read 9% larger AND lighter.
  appBarTitle: { flexShrink: 1, fontSize: 20, fontWeight: '500' },
  list: { flex: 1 },
  gridRow: {
    flexDirection: 'row',
    gap: TILE_GAP,
    marginBottom: TILE_GAP + 4,
  },
  cell: { flex: 1 },
  // Matches the list's own content inset, so the skeleton lands exactly where
  // the real grid does and nothing shifts when data arrives.
  skeletonGrid: { paddingHorizontal: SCREEN_PADDING, paddingTop: GRID_TOP_GAP },
});
