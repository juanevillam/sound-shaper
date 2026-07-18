import { useCallback, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import {
  ExtendedFloatingActionButton,
  Icon,
  IconButton,
  Text,
} from '@expo/ui/jetpack-compose';
import { DestructiveConfirmDialog, iconSource } from '@portfolio/mobile-ui';
import { FlashList } from '@shopify/flash-list';
import { Stack, router } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { MiniPlayer, MINI_PLAYER_HEIGHT } from '@/components/player/MiniPlayer';
import { EditPlaylistSheet } from '@/components/playlists/EditPlaylistSheet';
import { PlaylistActionsSheet } from '@/components/playlists/PlaylistActionsSheet';
import { PlaylistCard } from '@/components/playlists/PlaylistCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import {
  PlaylistCardSkeleton,
  SKELETON_DELAY_MS,
} from '@/components/ui/Skeleton';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDelayedShow } from '@/hooks/useDelayedShow';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { deletePlaylist, type Playlist } from '@/services/firebase/playlists';
import { usePlayerStore } from '@/store/player';
import { usePlaylistsStore } from '@/store/playlists';

const FAB_MARGIN = 16;
const CARD_GAP = 12;
const LIST_PADDING = 16;
const SCROLL_THROTTLE_MS = 64;
// Clears the floating action button (16dp offset + 56dp FAB + gap).
const FAB_CLEARANCE = 88;

// The app's single root screen — a personal sound shaper has no tabs and no
// social surface: just your playlists, the mini-player, and a Settings gear
// in the app bar. Everything else (playlist detail, now-playing, settings)
// pushes from here.
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
  const { scrolled, onScroll } = useHeaderScroll();

  const [createVisible, setCreateVisible] = useState(false);
  // The playlist whose long-press action sheet (Edit / Delete) is open.
  const [menuPlaylist, setMenuPlaylist] = useState<Playlist | null>(null);
  // Set by the action sheet's "Edit" → mounts EditPlaylistSheet for it.
  const [editPlaylistId, setEditPlaylistId] = useState<string | null>(null);
  // Set by the action sheet's "Delete" → the destructive confirm dialog.
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

  const renderPlaylist = useCallback(
    ({ item }: { item: Playlist }) => (
      <View style={styles.cardWrap}>
        <PlaylistCard
          playlist={item}
          onPress={() => goToPlaylist(item.id)}
          onLongPress={() => setMenuPlaylist(item)}
        />
      </View>
    ),
    [goToPlaylist],
  );

  // Bottom clearance: system nav + FAB, plus the mini-player when docked.
  const listBottomPadding =
    insets.bottom + FAB_CLEARANCE + (miniVisible ? MINI_PLAYER_HEIGHT : 0);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: t('app.title'),
          // Settings lives behind the app bar gear — with no profile tab,
          // this is its one entry point.
          headerRight: () => (
            <ThemedHost matchContents>
              <IconButton onClick={() => router.push('/settings')}>
                <Icon
                  source={iconSource('settings')}
                  tint={colors.onSurface}
                  contentDescription={t('app.settings')}
                />
              </IconButton>
            </ThemedHost>
          ),
        }}
      />

      <SafeAreaView style={styles.safeArea} edges={[]}>
        {firstLoad ? (
          // Delay-gated: a cached first load settles inside the window, so the
          // screen stays blank rather than flashing a skeleton it won't need.
          showSkeleton ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2].map(row => (
                <PlaylistCardSkeleton key={row} />
              ))}
            </View>
          ) : null
        ) : error ? (
          <EmptyState
            title={t('home.error.title')}
            subtitle={t('home.error.subtitle')}
            action={{ label: t('common.retry'), onPress: retry }}
          />
        ) : playlists.length === 0 ? (
          <EmptyState
            emoji="🎵"
            title={t('home.empty.title')}
            subtitle={t('home.empty.subtitle')}
            action={{
              label: t('home.empty.cta'),
              onPress: () => setCreateVisible(true),
            }}
          />
        ) : (
          <FlashList
            style={styles.list}
            data={playlists}
            keyExtractor={playlist => playlist.id}
            renderItem={renderPlaylist}
            onScroll={onScroll}
            scrollEventThrottle={SCROLL_THROTTLE_MS}
            contentContainerStyle={{
              paddingHorizontal: LIST_PADDING,
              paddingTop: CARD_GAP,
              paddingBottom: listBottomPadding,
            }}
          />
        )}

        {/* Same FAB anchoring as Topper's detail screen: absolute against the
            screen edge, the bottom inset added by hand — plus the docked
            mini-player's height when it's up. */}
        <View
          style={[
            styles.fab,
            {
              bottom:
                insets.bottom +
                FAB_MARGIN +
                (miniVisible ? MINI_PLAYER_HEIGHT : 0),
            },
          ]}
        >
          <ThemedHost matchContents>
            <ExtendedFloatingActionButton
              expanded={!scrolled}
              containerColor={colors.primaryContainer}
              onClick={() => setCreateVisible(true)}
            >
              <ExtendedFloatingActionButton.Icon>
                <Icon
                  source={iconSource('add')}
                  tint={colors.onPrimaryContainer}
                />
              </ExtendedFloatingActionButton.Icon>
              <ExtendedFloatingActionButton.Text>
                <Text color={colors.onPrimaryContainer}>
                  {t('home.fab.newPlaylist')}
                </Text>
              </ExtendedFloatingActionButton.Text>
            </ExtendedFloatingActionButton>
          </ThemedHost>
        </View>

        {/* The persistent mini-player, pinned to the bottom edge (it pads
            itself past the system nav). */}
        {miniVisible ? (
          <View style={styles.miniPlayer}>
            <MiniPlayer />
          </View>
        ) : null}

        {createVisible && (
          <EditPlaylistSheet onClose={() => setCreateVisible(false)} />
        )}

        {/* Edit a playlist from the card's long-press menu. */}
        {editPlaylistId && (
          <EditPlaylistSheet
            playlistId={editPlaylistId}
            onClose={() => setEditPlaylistId(null)}
          />
        )}

        {/* Quick actions for a long-pressed card. */}
        {menuPlaylist && (
          <PlaylistActionsSheet
            playlistName={menuPlaylist.name}
            onClose={() => setMenuPlaylist(null)}
            onEdit={() => setEditPlaylistId(menuPlaylist.id)}
            onDelete={() => setDeleteTarget(menuPlaylist)}
          />
        )}

        {/* Deleting a playlist is a REAL delete (its songs go with it), so it
            confirms. Own Host (dialogs corrupt Compose siblings). */}
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
  list: { flex: 1 },
  cardWrap: { marginBottom: CARD_GAP },
  skeletonList: {
    gap: CARD_GAP,
    paddingHorizontal: LIST_PADDING,
    paddingTop: CARD_GAP,
  },
  fab: {
    position: 'absolute',
    right: FAB_MARGIN,
  },
  miniPlayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
