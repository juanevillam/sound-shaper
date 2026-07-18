import { useCallback, useEffect, useState } from 'react';

import { InteractionManager, StyleSheet, View } from 'react-native';

import {
  Button,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  IconButton,
  OutlinedButton,
  Row,
  Text as ComposeText,
} from '@expo/ui/jetpack-compose';
import { DestructiveConfirmDialog, iconSource } from '@portfolio/mobile-ui';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
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
import { SongRow } from '@/components/songs/SongRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SKELETON_DELAY_MS, SongRowSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDelayedShow } from '@/hooks/useDelayedShow';
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
import { TILE_RADIUS } from '@/styles/shape';

const MENU_ICON_SIZE = 24;
const HERO_ART_SIZE = 148;
const HERO_EMOJI_SIZE = 72;
const ROW_GAP = 4;

// First frame mounts only about a screenful of rows so the push transition
// starts immediately; the rest mount when it lands.
const INITIAL_RENDER_COUNT = 12;

// Fisher–Yates over a copy — the shuffle button hands the player a shuffled
// QUEUE, so next/previous walk the shuffled order too.
const shuffled = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
};

function SongListSkeleton() {
  return (
    <View style={styles.listSkeleton}>
      {[0, 1, 2, 3, 4, 5].map(row => (
        <SongRowSkeleton key={row} />
      ))}
    </View>
  );
}

// YT-Music-ized playlist screen: a transparent app bar (back + overflow only),
// then a hero block — big artwork, name, count — with Play/Shuffle pills, and
// the songs as FLAT rows. Long-press a row to reorder; the row's ⋮ edits it.
export default function PlaylistDetailScreen() {
  const { playlistId } = useLocalSearchParams<{ playlistId: string }>();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();
  const insets = useSafeAreaInsets();

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
  const [pickedFile, setPickedFile] = useState<PickedSongFile | null>(null);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

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
  // synced DURING render so a settled-but-empty frame never flashes the empty
  // state on entry.
  const [songs, setSongs] = useState(storeSongs);
  const [syncedStoreSongs, setSyncedStoreSongs] = useState(storeSongs);

  if (storeSongs !== syncedStoreSongs) {
    setSyncedStoreSongs(storeSongs);
    setSongs(storeSongs);
  }

  const scrollableRef = useAnimatedRef<Animated.ScrollView>();

  useSongsSubscription(playlistId);

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

  const playAll = useCallback(() => {
    if (!playlistId || !songs || songs.length === 0) return;

    playSong(songs[0], songs, playlistId);
  }, [playlistId, songs, playSong]);

  const playShuffled = useCallback(() => {
    if (!playlistId || !songs || songs.length === 0) return;

    const order = shuffled(songs);
    playSong(order[0], order, playlistId);
  }, [playlistId, songs, playSong]);

  const renderSong = useCallback<SortableGridRenderItem<Song>>(
    ({ item, index }) => (
      <SongRow
        song={item}
        index={index}
        shouldEnter={isTransitionDone}
        isCurrent={item.id === currentSongId}
        onPress={() => {
          if (playlistId && songs) playSong(item, songs, playlistId);
        }}
        onPressMenu={() => setEditingSongId(item.id)}
      />
    ),
    [isTransitionDone, currentSongId, playSong, playlistId, songs],
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          // Transparent bar riding the content (YT Music's playlist screen):
          // just the back arrow + overflow, the identity lives in the hero.
          title: '',
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
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
                          <ComposeText color={colors.onSurface}>
                            {t('playlistDetail.menu.edit')}
                          </ComposeText>
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
                          <ComposeText color={colors.danger}>
                            {t('playlistDetail.menu.delete')}
                          </ComposeText>
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
          ) : (
            <Animated.ScrollView
              ref={scrollableRef}
              style={styles.list}
              contentContainerStyle={{
                paddingBottom:
                  insets.bottom + 96 + (miniVisible ? MINI_PLAYER_HEIGHT : 0),
              }}
            >
              {/* Hero: the artwork IS the header. */}
              <View style={styles.hero}>
                <View
                  style={[
                    styles.heroArt,
                    { backgroundColor: colors.surfaceContainer },
                  ]}
                >
                  <Text
                    doNotTranslate
                    text={playlist?.emoji || '🎵'}
                    style={styles.heroEmoji}
                  />
                </View>
                <Text
                  doNotTranslate
                  text={playlist?.name ?? ''}
                  variant="titleLarge"
                  numberOfLines={2}
                  style={styles.heroName}
                />
                <Text
                  doNotTranslate
                  muted
                  text={`${playlist?.songCount ?? 0} ${t(
                    (playlist?.songCount ?? 0) === 1
                      ? 'home.song'
                      : 'home.songs',
                  )}`}
                  variant="bodySmall"
                />
                {playlist && playlist.description.length > 0 ? (
                  <Text
                    doNotTranslate
                    muted
                    text={playlist.description}
                    variant="bodyMedium"
                    style={styles.heroDescription}
                  />
                ) : null}

                {displaySongs && displaySongs.length > 0 ? (
                  // FIXED height, not matchContents: a vertically-matching
                  // Host on the scroll axis of this ScrollView mis-measures
                  // (see expo-ui-matchcontents-scrollable notes).
                  <ThemedHost style={styles.actions}>
                    <Column horizontalAlignment="center">
                      <Row
                        horizontalArrangement={{ spacedBy: 12 }}
                        verticalAlignment="center"
                      >
                        <Button onClick={playAll}>
                          <ComposeText>{t('playlistDetail.play')}</ComposeText>
                        </Button>
                        <OutlinedButton onClick={playShuffled}>
                          <ComposeText color={colors.onSurface}>
                            {t('playlistDetail.shuffle')}
                          </ComposeText>
                        </OutlinedButton>
                        <OutlinedButton onClick={openCreateSong}>
                          <ComposeText color={colors.onSurface}>
                            {t('playlistDetail.fab.addSong')}
                          </ComposeText>
                        </OutlinedButton>
                      </Row>
                    </Column>
                  </ThemedHost>
                ) : null}
              </View>

              {!displaySongs || displaySongs.length === 0 ? (
                !hasSettled ? (
                  showSkeleton ? (
                    <SongListSkeleton />
                  ) : null
                ) : (
                  <View style={styles.emptyWrap}>
                    <EmptyState
                      emoji={playlist?.emoji ?? '🎵'}
                      title={t('playlistDetail.empty.title')}
                      subtitle={t('playlistDetail.empty.subtitle')}
                      action={{
                        label: t('playlistDetail.empty.cta'),
                        onPress: openCreateSong,
                      }}
                    />
                  </View>
                )
              ) : (
                <Sortable.Grid
                  columns={1}
                  data={displaySongs}
                  keyExtractor={song => song.id}
                  renderItem={renderSong}
                  rowGap={ROW_GAP}
                  scrollableRef={scrollableRef}
                  overDrag="vertical"
                  onDragStart={handleDragStart}
                  onOrderChange={handleOrderChange}
                  onDragEnd={handleDragEnd}
                />
              )}
            </Animated.ScrollView>
          )}
        </View>

        {miniVisible ? (
          <View style={styles.miniPlayer}>
            <MiniPlayer />
          </View>
        ) : null}

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
  list: { flex: 1 },
  hero: {
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  heroArt: {
    alignItems: 'center',
    borderRadius: TILE_RADIUS,
    height: HERO_ART_SIZE,
    justifyContent: 'center',
    marginBottom: 16,
    width: HERO_ART_SIZE,
  },
  // Explicit line height so Android doesn't clip the large emoji glyph.
  heroEmoji: { fontSize: HERO_EMOJI_SIZE, lineHeight: HERO_EMOJI_SIZE * 1.4 },
  heroName: { fontWeight: '700', marginBottom: 2, textAlign: 'center' },
  heroDescription: { marginTop: 10, textAlign: 'center' },
  actions: { alignSelf: 'stretch', height: 48, marginTop: 16 },
  emptyWrap: { minHeight: 260 },
  listSkeleton: { gap: ROW_GAP },
  miniPlayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
