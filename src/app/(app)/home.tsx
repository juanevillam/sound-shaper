import { useCallback, useState } from 'react';

import { Platform, StyleSheet, View } from 'react-native';

import { FlashList } from '@shopify/flash-list';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, router } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { MINI_PLAYER_HEIGHT } from '@/components/player/PlayerSheet';
import {
  EditSongSheet,
  type PickedSongFile,
} from '@/components/songs/EditSongSheet';
import { AddSongTile, SongTile } from '@/components/songs/SongTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { RippleIconButton } from '@/components/ui/RippleIconButton';
import { Screen } from '@/components/ui/Screen';
import { SKELETON_DELAY_MS, SongTileSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useDelayedShow } from '@/hooks/useDelayedShow';
import { useI18n } from '@/i18n';
import { readId3Tags } from '@/lib/id3';
import { type Song } from '@/services/firebase/songs';
import { stashPendingUpload } from '@/store/pendingUpload';
import { usePlayerStore } from '@/store/player';
import { useSongsStore } from '@/store/songs';

const LIST_PADDING = 16;
const GRID_GAP = 16;

// The grid rows FlashList renders: the add tile plus the songs, pre-paired
// into 2-column rows (FlashList's numColumns + varying tile heights fight each
// other; hand-pairing keeps rows aligned). The add tile leads so it stays
// reachable no matter how long the library grows.
type GridRow = {
  id: string;
  left: Song | 'add';
  right: Song | 'add' | null;
};

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

// The whole library on one screen: a wordmark row (app name + settings gear)
// over a 2-column grid of song tiles — YT Music's album-tile language, one
// song per tile. No playlists: you upload a song and it's just... there.
// Tap = play (and the player opens); long-press = edit/delete; the add tile
// closes the grid.
export default function HomeScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
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

  // The banner is always parked at the bottom now, so always clear it.
  const listBottomPadding = insets.bottom + 24 + MINI_PLAYER_HEIGHT;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={[]}>
        {/* Wordmark row where the app bar would be — the YT Music idiom. */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text text="app.title" variant="titleLarge" style={styles.wordmark} />
          <View style={styles.headerActions}>
            <RippleIconButton
              name="settings"
              onPress={() => router.push('/settings')}
              accessibilityLabel={t('app.settings')}
            />
          </View>
        </View>

        {firstLoad ? (
          showSkeleton ? (
            <View style={styles.skeletonGrid}>
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
            contentContainerStyle={{
              paddingHorizontal: LIST_PADDING,
              paddingTop: 8,
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 4,
    paddingLeft: LIST_PADDING,
    // The gear should read as inset the same as the wordmark. Android's
    // Material icon is 24dp centred in a 48dp box, so 4 lands its glyph at
    // LIST_PADDING; iOS packs a tighter-bearing SF Symbol into a 44pt target
    // and the same 4 leaves it visibly closer to the edge, so it needs more.
    paddingRight: Platform.select({ ios: 7, default: 4 }),
  },
  wordmark: { fontWeight: '700' },
  headerActions: { alignItems: 'center', flexDirection: 'row' },
  list: { flex: 1 },
  gridRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
    marginBottom: 20,
  },
  cell: { flex: 1 },
  skeletonGrid: { paddingHorizontal: LIST_PADDING, paddingTop: 8 },
});
