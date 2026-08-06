import { useCallback, useState } from 'react';

import { Platform, StyleSheet, View } from 'react-native';

import {
  CollapsingHeaderBar,
  CollapsingHeaderTitle,
  useCollapsingHeader,
} from '@portfolio/mobile-ui';
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
import { BarIconButton } from '@/components/ui/BarIconButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { Screen } from '@/components/ui/Screen';
import { SKELETON_DELAY_MS, SongTileSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
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
 * iOS needs none — there the heading is the list's own first row and carries
 * its own gap (see `HEADING_TO_TILE_GAP`).
 *
 * Android's static app bar sits directly on the content, so this IS the gap,
 * and it is set to match Topper: measured on device, Topper leaves 31.6dp
 * between its app bar and the first thing drawn under it, where 8 left this
 * screen's tiles crowding the bar at 8.8dp. Topper reaches that figure by
 * accident — list padding plus a section row's own centring — so copying the
 * outcome is the only way to actually match it.
 */
const GRID_TOP_GAP = IS_IOS ? 0 : 29.5;

/**
 * EXTRA air under the heading, so the gap you SEE here equals the one in
 * Topper: 34pt from the heading's ink to the next thing drawn.
 *
 * Topper's next element is a 52pt section row whose label is centred inside it,
 * so ~18pt of that row is blank before any ink appears. This grid's tiles start
 * drawing at their own box edge, with nothing in front. Adding that difference
 * back here is what made the two read identically.
 *
 * ⚠️ STALE ON iOS, 2026-08-06. This was derived when BOTH screens drew the
 * shared `CollapsingHeaderTitle`, and the original note said as much ("both
 * screens already share the same header token"). Topper's iOS home has since
 * moved to the SYSTEM large title, so UIKit — not this token — owns the space
 * under its heading, and the premise no longer holds. Topper's iOS gap measures
 * 24.7pt ink-to-ink today, not 34. Android still shares the header and is
 * unaffected.
 *
 * RE-DERIVE against the system large title when Sound Shaper's iOS pass runs;
 * it could not be measured here because Sound Shaper is not installed. Do not
 * trust the 34 for iOS until then.
 */
const HEADING_TO_TILE_GAP = 15;

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

// The whole library on one screen: the shared collapsing header (app name +
// settings gear) over a 2-column grid of song tiles — YT Music's album-tile
// language, one song per tile. No playlists: you upload one and it's there.
// Tap = play (and the player opens); long-press = edit/delete; the add tile
// closes the grid.
export default function HomeScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const header = useCollapsingHeader();
  const songs = useSongsStore(s => s.songs);
  const error = useSongsStore(s => s.error);
  const retry = useSongsStore(s => s.retry);
  const hasSettled = useSongsStore(s => s.hasSettled);
  const playSong = usePlayerStore(s => s.playSong);
  const requestExpand = usePlayerStore(s => s.requestExpand);
  const currentSongId = usePlayerStore(s => s.current?.id);
  const isPlaying = usePlayerStore(s => s.playing);
  const rate = usePlayerStore(s => s.rate);
  const showSkeleton = useDelayedShow(SKELETON_DELAY_MS);

  const [pickedFile, setPickedFile] = useState<PickedSongFile | null>(null);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

  const openAddSong = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
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

  const firstLoad = !hasSettled;
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
      {/* NEITHER platform uses the navigator's header here, and Android's
          absence is load-bearing: the navigator draws its header ABOVE the
          screen, so the expanded player — which is mounted inside this screen
          and is meant to be full-bleed — came up underneath the app bar. The
          static Material bar below is the same bar, drawn as content, so the
          player simply covers it like it covers everything else. */}
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={[]}>
        {/* iOS: the portfolio's app-root header (`@portfolio/mobile-ui`) —
            this bar plus the big heading that scrolls under it from inside the
            list. The same component and the same collapse Topper's iOS home
            uses, so the two apps read as one family there. */}
        {IS_IOS ? (
          <CollapsingHeaderBar
            title={t('app.title')}
            scrollY={header.scrollY}
            // Account, then Settings. Account lives on the HOME header in this
            // app because the portfolio's rule is that its entry sits where
            // the user's identity already lives — the Profile tab in Topper,
            // and here, with no profile tab, the home bar. Settings itself is
            // app CONFIGURATION only and identical in every app.
            right={
              <View style={styles.barActions}>
                <BarIconButton
                  name="manage-accounts"
                  systemName="person.crop.circle"
                  onPress={() => router.push('/manage-account')}
                  tint={colors.primary}
                  accessibilityLabel={t('settings.account.title')}
                />
                <BarIconButton
                  name="settings"
                  systemName="gearshape"
                  onPress={() => router.push('/settings')}
                  tint={colors.primary}
                  accessibilityLabel={t('app.settings')}
                />
              </View>
            }
          />
        ) : (
          /* Android: M3's small top app bar, drawn as content. Same tonal
             container, same 64dp, same 22sp title on the grid margin, and the
             gear is still a real Compose action — the only thing that changed
             is who owns the view, which is what lets the player cover it. */
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
            <View style={styles.skeletonGrid}>
              {IS_IOS ? (
                <View style={styles.headingBlock}>
                  <CollapsingHeaderTitle text={t('app.title')} />
                </View>
              ) : null}
              <View style={styles.gridRow}>
                <View style={styles.cell}>
                  <SongTileSkeleton />
                </View>
                <View style={styles.cell}>
                  <SongTileSkeleton />
                </View>
              </View>
              <View style={styles.gridRow}>
                <View style={styles.cell}>
                  <SongTileSkeleton />
                </View>
                <View style={styles.cell} />
              </View>
            </View>
          ) : null
        ) : error ? (
          <EmptyState
            title={t('home.error.title')}
            subtitle={t('home.error.subtitle')}
            action={{ label: t('common.retry'), onPress: retry }}
          />
        ) : (
          <FlashList
            style={styles.list}
            data={rows}
            keyExtractor={row => row.id}
            renderItem={renderRow}
            // The heading is the list's first row, not chrome — which is what
            // lets it scroll away under the bar with no overlay or inset
            // trickery. No paddingTop: it sits directly under the (empty at
            // rest) bar, where a native expanded large title starts.
            ListHeaderComponent={
              IS_IOS ? (
                <View style={styles.headingBlock}>
                  <CollapsingHeaderTitle text={t('app.title')} />
                </View>
              ) : null
            }
            onScroll={header.onScroll}
            scrollEventThrottle={header.scrollEventThrottle}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Two bar items sit in a row; the bar's own slot positions the pair.
  barActions: { alignItems: 'center', flexDirection: 'row', gap: 4 },
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
  headingBlock: { paddingBottom: HEADING_TO_TILE_GAP },
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
