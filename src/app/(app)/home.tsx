import { useCallback, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { Icon, IconButton } from '@expo/ui/jetpack-compose';
import { DestructiveConfirmDialog, iconSource } from '@portfolio/mobile-ui';
import { FlashList } from '@shopify/flash-list';
import { Stack, router } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { MINI_PLAYER_HEIGHT } from '@/components/player/PlayerSheet';
import { EditPlaylistSheet } from '@/components/playlists/EditPlaylistSheet';
import { PlaylistActionsSheet } from '@/components/playlists/PlaylistActionsSheet';
import {
  NewPlaylistTile,
  PlaylistTile,
} from '@/components/playlists/PlaylistTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import {
  PlaylistTileSkeleton,
  SKELETON_DELAY_MS,
} from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDelayedShow } from '@/hooks/useDelayedShow';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { deletePlaylist, type Playlist } from '@/services/firebase/playlists';
import { usePlayerStore } from '@/store/player';
import { usePlaylistsStore } from '@/store/playlists';

const LIST_PADDING = 16;
const GRID_GAP = 16;

// The grid rows FlashList renders: real playlists plus the trailing create
// tile, pre-paired into 2-column rows (FlashList's numColumns + varying tile
// heights fight each other; hand-pairing keeps rows aligned).
type GridRow = {
  id: string;
  left: Playlist | 'new';
  right: Playlist | 'new' | null;
};

const toGridRows = (playlists: Playlist[]): GridRow[] => {
  const cells: (Playlist | 'new')[] = [...playlists, 'new'];
  const rows: GridRow[] = [];

  for (let index = 0; index < cells.length; index += 2) {
    const left = cells[index];
    rows.push({
      id: typeof left === 'string' ? 'new' : left.id,
      left,
      right: cells[index + 1] ?? null,
    });
  }

  return rows;
};

// YT-Music-ized home: no app bar — an in-screen wordmark row (app name +
// settings gear) over a 2-column grid of artwork tiles. The create tile lives
// IN the grid (no FAB): the library is the whole screen.
export default function HomeScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();
  const insets = useSafeAreaInsets();
  const playlists = usePlaylistsStore(s => s.playlists);
  const error = usePlaylistsStore(s => s.error);
  const retry = usePlaylistsStore(s => s.retry);
  const hasSettled = usePlaylistsStore(s => s.hasSettled);
  const miniVisible = usePlayerStore(s => s.current !== null);
  const showSkeleton = useDelayedShow(SKELETON_DELAY_MS);

  const [createVisible, setCreateVisible] = useState(false);
  // The playlist whose long-press action sheet (Edit / Delete) is open.
  const [menuPlaylist, setMenuPlaylist] = useState<Playlist | null>(null);
  const [editPlaylistId, setEditPlaylistId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null);

  const goToPlaylist = useCallback(
    (playlistId: string) =>
      router.push({ pathname: '/playlist-detail', params: { playlistId } }),
    [],
  );

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;

    haptics.medium();
    setDeleteTarget(null);

    deletePlaylist(deleteTarget.id)
      .then(() => showSnackbar(t('snackbar.playlist-deleted')))
      .catch(() => showSnackbar(t('snackbar.playlist-delete-failed')));
  }, [deleteTarget, showSnackbar, t]);

  const firstLoad = !hasSettled;
  const rows = toGridRows(playlists);

  const renderCell = useCallback(
    (cell: Playlist | 'new' | null, index: number) => {
      if (cell === null) return <View style={styles.cell} />;

      if (cell === 'new')
        return (
          <View style={styles.cell}>
            <NewPlaylistTile onPress={() => setCreateVisible(true)} />
          </View>
        );

      return (
        <View style={styles.cell}>
          <PlaylistTile
            playlist={cell}
            index={index}
            onPress={() => goToPlaylist(cell.id)}
            onLongPress={() => setMenuPlaylist(cell)}
          />
        </View>
      );
    },
    [goToPlaylist],
  );

  const renderRow = useCallback(
    ({ item, index }: { item: GridRow; index: number }) => (
      <View style={styles.gridRow}>
        {renderCell(item.left, index * 2)}
        {renderCell(item.right, index * 2 + 1)}
      </View>
    ),
    [renderCell],
  );

  const listBottomPadding =
    insets.bottom + 24 + (miniVisible ? MINI_PLAYER_HEIGHT : 0);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={[]}>
        {/* Wordmark row where the app bar would be — the YT Music idiom. */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text text="app.title" variant="titleLarge" style={styles.wordmark} />
          <ThemedHost matchContents>
            <IconButton onClick={() => router.push('/settings')}>
              <Icon
                source={iconSource('settings')}
                tint={colors.onSurface}
                contentDescription={t('app.settings')}
              />
            </IconButton>
          </ThemedHost>
        </View>

        {firstLoad ? (
          showSkeleton ? (
            <View style={styles.skeletonGrid}>
              <View style={styles.gridRow}>
                <View style={styles.cell}>
                  <PlaylistTileSkeleton />
                </View>
                <View style={styles.cell}>
                  <PlaylistTileSkeleton />
                </View>
              </View>
              <View style={styles.gridRow}>
                <View style={styles.cell}>
                  <PlaylistTileSkeleton />
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

        {createVisible && (
          <EditPlaylistSheet onClose={() => setCreateVisible(false)} />
        )}
        {editPlaylistId && (
          <EditPlaylistSheet
            playlistId={editPlaylistId}
            onClose={() => setEditPlaylistId(null)}
          />
        )}
        {menuPlaylist && (
          <PlaylistActionsSheet
            playlistName={menuPlaylist.name}
            onClose={() => setMenuPlaylist(null)}
            onEdit={() => setEditPlaylistId(menuPlaylist.id)}
            onDelete={() => setDeleteTarget(menuPlaylist)}
          />
        )}
        {deleteTarget && (
          <ThemedHost matchContents>
            <DestructiveConfirmDialog
              dialog={{
                title: t('playlistDetail.deleteConfirm.title'),
                message: t('playlistDetail.deleteConfirm.message'),
                confirm: t('playlistDetail.deleteConfirm.confirm'),
                cancel: t('playlistDetail.deleteConfirm.cancel'),
              }}
              colors={{ danger: colors.danger }}
              onConfirm={confirmDelete}
              onDismiss={() => setDeleteTarget(null)}
            />
          </ThemedHost>
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
    paddingRight: 4,
  },
  wordmark: { fontWeight: '700' },
  list: { flex: 1 },
  gridRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
    marginBottom: 20,
  },
  cell: { flex: 1 },
  skeletonGrid: { paddingHorizontal: LIST_PADDING, paddingTop: 8 },
});
