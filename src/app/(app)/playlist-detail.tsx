import { useCallback, useEffect, useState } from 'react';

import { InteractionManager, StyleSheet, View } from 'react-native';

import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  ExtendedFloatingActionButton,
  Icon,
  IconButton,
  Text,
} from '@expo/ui/jetpack-compose';
import { DestructiveConfirmDialog, iconSource } from '@portfolio/mobile-ui';
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

import { MiniPlayer, MINI_PLAYER_HEIGHT } from '@/components/player/MiniPlayer';
import { EditPlaylistSheet } from '@/components/playlists/EditPlaylistSheet';
import {
  EditSongSheet,
  type PickedSongFile,
} from '@/components/songs/EditSongSheet';
import { SongCard } from '@/components/songs/SongCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SKELETON_DELAY_MS, SongCardSkeleton } from '@/components/ui/Skeleton';
import { Text as AppText } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDelayedShow } from '@/hooks/useDelayedShow';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useSongsSubscription } from '@/hooks/useSongsSubscription';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { readId3Tags } from '@/lib/id3';
import { deletePlaylist } from '@/services/firebase/playlists';
import { reorderSongs, type Song } from '@/services/firebase/songs';
import { usePlayerStore } from '@/store/player';
import { usePlaylistsStore } from '@/store/playlists';
import { useSongsStore } from '@/store/songs';

const FAB_MARGIN = 16;
const CARD_GAP = 12;
const MENU_ICON_SIZE = 24;
const SCROLL_THROTTLE_MS = 64;

// Subtle lift for the card being dragged.
const DRAG_ACTIVE_SCALE = 1.03;

// First frame mounts only about a screenful of cards so the push transition
// starts immediately; the rest mount when it lands.
const INITIAL_RENDER_COUNT = 10;

// Content-shaped first-load placeholder for the song list.
function SongListSkeleton() {
  return (
    <View style={styles.listSkeleton}>
      {[0, 1, 2, 3, 4].map(row => (
        <SongCardSkeleton key={row} />
      ))}
    </View>
  );
}

export default function PlaylistDetailScreen() {
  const { playlistId } = useLocalSearchParams<{ playlistId: string }>();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();
  const insets = useSafeAreaInsets();

  const reduceMotion = useReducedMotion();
  const showSkeleton = useDelayedShow(SKELETON_DELAY_MS);

  const playlist = usePlaylistsStore(s =>
    s.playlists.find(entry => entry.id === playlistId),
  );

  const storeSongs = useSongsStore(s =>
    playlistId ? s.byPlaylistId[playlistId] : undefined,
  );
  const error = useSongsStore(s =>
    playlistId ? s.errorByPlaylistId[playlistId] : undefined,
  );
  const retrySongs = useSongsStore(s => s.retryPlaylist);
  const hasSettled = useSongsStore(s =>
    playlistId ? (s.settledByPlaylistId[playlistId] ?? false) : false,
  );

  const [editPlaylistVisible, setEditPlaylistVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  // Create mode: the picked + parsed .mp3 the song editor opens with.
  const [pickedFile, setPickedFile] = useState<PickedSongFile | null>(null);
  // Edit mode: the song whose metadata is being edited.
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

  const { scrolled, onScroll } = useHeaderScroll();

  // "Add song": pick an .mp3, read its ID3 tags, THEN open the editor already
  // prefilled — the pick comes first so a cancel never opens an empty form.
  const openCreateSong = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const tags = await readId3Tags(asset.uri);

    setPickedFile({ uri: asset.uri, fileName: asset.name, tags });
  }, []);

  // Deleting the playlist is a REAL delete (songs + files go with it) — the
  // dialog stays up (busy) through the sweep, then pops back.
  const [deleting, setDeleting] = useState(false);
  const confirmDelete = useCallback(async () => {
    if (!playlistId) return;

    setDeleting(true);
    haptics.medium();

    try {
      await deletePlaylist(playlistId);
      showSnackbar(t('snackbar.playlist-deleted'));
      router.back();
    } catch {
      showSnackbar(t('snackbar.playlist-delete-failed'));
      setDeleting(false);
      setDeleteVisible(false);
    }
  }, [playlistId, showSnackbar, t]);

  // Local mirror of the store's songs so a drag reorders optimistically —
  // synced DURING render (not in an effect) so a settled-but-empty frame never
  // flashes the empty state on entry.
  const [songs, setSongs] = useState(storeSongs);
  const [syncedStoreSongs, setSyncedStoreSongs] = useState(storeSongs);

  if (storeSongs !== syncedStoreSongs) {
    setSyncedStoreSongs(storeSongs);
    setSongs(storeSongs);
  }

  const scrollableRef = useAnimatedRef<Animated.ScrollView>();

  useSongsSubscription(playlistId);

  // Flips when the push transition lands: cards hold their entrance until
  // then, and the tail of long lists mounts only after it.
  const [isTransitionDone, setIsTransitionDone] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() =>
      setIsTransitionDone(true),
    );
    return () => task.cancel();
  }, []);

  const displaySongs = isTransitionDone
    ? songs
    : songs?.slice(0, INITIAL_RENDER_COUNT);

  // A light pulse on pickup, each reorder swap, and drop makes dragging songs
  // feel tactile.
  const handleDragStart = useCallback(() => haptics.dragPickup(), []);
  const handleOrderChange = useCallback(() => haptics.dragMove(), []);

  const handleDragEnd = useCallback(
    async ({ data }: SortableGridDragEndParams<Song>) => {
      if (!playlistId) return;

      haptics.dragDrop();
      setSongs(data);

      try {
        await reorderSongs({
          orderedSongIds: data.map(song => song.id),
          playlistId,
        });
      } catch {
        showSnackbar(t('snackbar.reorder-failed'));
        setSongs(useSongsStore.getState().byPlaylistId[playlistId]);
      }
    },
    [playlistId, showSnackbar, t],
  );

  const playSong = usePlayerStore(s => s.playSong);
  const currentSongId = usePlayerStore(s => s.current?.id);
  const miniVisible = usePlayerStore(s => s.current !== null);

  // Tap = play (the music-app native expectation); editing metadata moves to
  // the card's long-press, mirroring the home cards' management idiom.
  const renderSong = useCallback<SortableGridRenderItem<Song>>(
    ({ item, index }) => (
      <SongCard
        song={item}
        index={index}
        shouldEnter={isTransitionDone}
        isCurrent={item.id === currentSongId}
        onPress={() => {
          if (playlistId && songs) playSong(item, songs, playlistId);
        }}
        onLongPress={() => setEditingSongId(item.id)}
      />
    ),
    [isTransitionDone, currentSongId, playSong, playlistId, songs],
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: playlist
            ? `${playlist.emoji} ${playlist.name}`
            : t('app.playlistDetail'),
          headerRight: playlist
            ? () => (
                <ThemedHost matchContents>
                  <DropdownMenu
                    expanded={menuOpen}
                    onDismissRequest={() => setMenuOpen(false)}
                  >
                    <DropdownMenu.Trigger>
                      <IconButton onClick={() => setMenuOpen(true)}>
                        <Icon
                          source={iconSource('more-vert')}
                          tint={colors.onSurface}
                          contentDescription={t('common.playlistOptions')}
                        />
                      </IconButton>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Items>
                      <DropdownMenuItem
                        onClick={() => {
                          setMenuOpen(false);
                          setEditPlaylistVisible(true);
                        }}
                      >
                        <DropdownMenuItem.Text>
                          <Text color={colors.onSurface}>
                            {t('playlistDetail.menu.edit')}
                          </Text>
                        </DropdownMenuItem.Text>
                        <DropdownMenuItem.LeadingIcon>
                          <Icon
                            source={iconSource('edit')}
                            size={MENU_ICON_SIZE}
                            tint={colors.onSurface}
                          />
                        </DropdownMenuItem.LeadingIcon>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setMenuOpen(false);
                          setDeleteVisible(true);
                        }}
                      >
                        <DropdownMenuItem.Text>
                          <Text color={colors.danger}>
                            {t('playlistDetail.menu.delete')}
                          </Text>
                        </DropdownMenuItem.Text>
                        <DropdownMenuItem.LeadingIcon>
                          <Icon
                            source={iconSource('delete')}
                            size={MENU_ICON_SIZE}
                            tint={colors.danger}
                          />
                        </DropdownMenuItem.LeadingIcon>
                      </DropdownMenuItem>
                    </DropdownMenu.Items>
                  </DropdownMenu>
                </ThemedHost>
              )
            : undefined,
        }}
      />

      <SafeAreaView style={styles.safeArea} edges={[]}>
        <View style={styles.content}>
          {/* The playlist's free-text note, pinned above the songs. */}
          {playlist && playlist.description.length > 0 ? (
            <View style={styles.description}>
              <AppText
                doNotTranslate
                muted
                text={playlist.description}
                variant="bodyMedium"
                style={styles.descriptionText}
              />
            </View>
          ) : null}

          {error ? (
            <EmptyState
              title={t('playlistDetail.error.title')}
              subtitle={t('playlistDetail.error.subtitle')}
              action={
                playlistId
                  ? {
                      label: t('common.retry'),
                      onPress: () => retrySongs(playlistId),
                    }
                  : undefined
              }
            />
          ) : !displaySongs || displaySongs.length === 0 ? (
            !hasSettled ? (
              // Delay-gated so a cached snapshot settles before it shows.
              showSkeleton ? (
                <SongListSkeleton />
              ) : null
            ) : (
              <EmptyState
                emoji={playlist?.emoji ?? '🎵'}
                title={t('playlistDetail.empty.title')}
                subtitle={t('playlistDetail.empty.subtitle')}
              >
                <Button onClick={openCreateSong}>
                  <Text>{t('playlistDetail.empty.cta')}</Text>
                </Button>
              </EmptyState>
            )
          ) : (
            /* RN-side list (not LazyColumn) so each card can be a sortables
               drag target; long-press a card to pick it up — order persists
               via reorderSongs. */
            <Animated.ScrollView
              ref={scrollableRef}
              style={styles.list}
              contentContainerStyle={[
                styles.listContent,
                // System nav + FAB clearance, plus the mini-player when up
                // (the SafeAreaView no longer pads the bottom).
                {
                  paddingBottom:
                    insets.bottom + 88 + (miniVisible ? MINI_PLAYER_HEIGHT : 0),
                },
              ]}
              onScroll={onScroll}
              scrollEventThrottle={SCROLL_THROTTLE_MS}
            >
              <Sortable.Grid
                columns={1}
                data={displaySongs}
                keyExtractor={song => song.id}
                renderItem={renderSong}
                rowGap={CARD_GAP}
                scrollableRef={scrollableRef}
                activeItemScale={reduceMotion ? 1 : DRAG_ACTIVE_SCALE}
                // Pin horizontal drag so a full-width card can't slide
                // sideways; vertical over-drag stays for edge auto-scroll.
                overDrag="vertical"
                onDragStart={handleDragStart}
                onOrderChange={handleOrderChange}
                onDragEnd={handleDragEnd}
              />
            </Animated.ScrollView>
          )}
        </View>

        {/* Pushed screens cover the tab bar, so this screen hosts its own
            mini-player instance, pinned to the bottom edge. */}
        {miniVisible ? (
          <View style={styles.miniPlayer}>
            <MiniPlayer />
          </View>
        ) : null}

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
              onClick={openCreateSong}
            >
              <ExtendedFloatingActionButton.Icon>
                <Icon
                  source={iconSource('add')}
                  tint={colors.onPrimaryContainer}
                />
              </ExtendedFloatingActionButton.Icon>
              <ExtendedFloatingActionButton.Text>
                <Text color={colors.onPrimaryContainer}>
                  {t('playlistDetail.fab.addSong')}
                </Text>
              </ExtendedFloatingActionButton.Text>
            </ExtendedFloatingActionButton>
          </ThemedHost>
        </View>

        {editPlaylistVisible && (
          <EditPlaylistSheet
            playlistId={playlistId}
            onClose={() => setEditPlaylistVisible(false)}
          />
        )}
        {pickedFile && playlistId && (
          <EditSongSheet
            playlistId={playlistId}
            pickedFile={pickedFile}
            onClose={() => setPickedFile(null)}
          />
        )}
        {editingSongId && playlistId && (
          <EditSongSheet
            playlistId={playlistId}
            songId={editingSongId}
            onClose={() => setEditingSongId(null)}
          />
        )}
        {deleteVisible && (
          <ThemedHost matchContents>
            <DestructiveConfirmDialog
              dialog={{
                title: t('playlistDetail.deleteConfirm.title'),
                message: t('playlistDetail.deleteConfirm.message'),
                confirm: t('playlistDetail.deleteConfirm.confirm'),
                cancel: t('playlistDetail.deleteConfirm.cancel'),
              }}
              colors={{ danger: colors.danger }}
              busy={deleting}
              onConfirm={confirmDelete}
              onDismiss={() => setDeleteVisible(false)}
            />
          </ThemedHost>
        )}
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flex: 1 },
  description: { paddingHorizontal: 16, paddingVertical: 12 },
  descriptionText: { includeFontPadding: false },
  list: { flex: 1 },
  // Bottom clearance is computed inline (inset + FAB + mini-player).
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listSkeleton: { gap: CARD_GAP, paddingHorizontal: 16, paddingTop: 12 },
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
