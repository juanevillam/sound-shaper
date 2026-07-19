import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BackHandler,
  InteractionManager,
  StyleSheet,
  View,
} from 'react-native';

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
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Sortable, {
  type SortableGridDragEndParams,
  type SortableGridRenderItem,
} from 'react-native-sortables';

import { MINI_PLAYER_HEIGHT } from '@/components/player/PlayerSheet';
import { EditPlaylistSheet } from '@/components/playlists/EditPlaylistSheet';
import {
  EditSongSheet,
  type PickedSongFile,
} from '@/components/songs/EditSongSheet';
import { SongRow } from '@/components/songs/SongRow';
import { EmptyState } from '@/components/ui/EmptyState';
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
import { ART_EMOJI_RATIO, useArtTransitionStore } from '@/store/artTransition';
import { usePlayerStore } from '@/store/player';
import { usePlaylistsStore } from '@/store/playlists';
import { useSongsStore } from '@/store/songs';
import { TILE_RADIUS } from '@/styles/shape';

const MENU_ICON_SIZE = 24;
// FIXED so the hero's Y is deterministic from the first layout: the bar's
// Compose icon hosts (matchContents) report 0 height, then expand a beat
// later — measuring the hero while they're collapsed captured its target rect
// too high, so the flight landed high and snapped down (and up, in reverse).
const TOP_BAR_HEIGHT = 56;
const HERO_ART_SIZE = 148;
// The shared ratio: the flying tile's uniform scale lands its emoji exactly
// on this (no size jump at the handover).
const HERO_EMOJI_SIZE = Math.round(HERO_ART_SIZE * ART_EMOJI_RATIO);
const ROW_GAP = 4;
// The tile→hero art morph: a beat at the source (continuity with the tap),
// then the flight. On landing the real hero and the overlay hard-swap in ONE
// commit (they're pixel-identical there) — a cross-fade raced the hero reveal
// and dipped the art.
const MORPH_HOLD_MS = 40;
const MORPH_MS = 300;
// The screen's own scrim/content fade (home stays live underneath — this
// screen is a transparent overlay, so both directions play over it).
const SCREEN_IN_MS = 240;
const SCREEN_OUT_MS = 200;
// Exit flight back to the tile, then the pop.
const EXIT_MORPH_MS = 280;

type MorphRects = {
  from: { x: number; y: number; size: number };
  to: { x: number; y: number; size: number };
};

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

  // --- Container transform (this screen is a transparent overlay) ----------
  // Consume the pressed tile's measured rect exactly once, at first render.
  const reduceMotion = useReducedMotion();
  const [handoff] = useState(() => useArtTransitionStore.getState().consume());
  const [morph, setMorph] = useState<MorphRects | null>(null);
  // The real hero art stays invisible until the overlay lands on it.
  const [heroShown, setHeroShown] = useState(!handoff || reduceMotion);
  const rootRef = useRef<View>(null);
  const heroArtRef = useRef<View>(null);
  const morphProgress = useSharedValue(0);
  const morphOpacity = useSharedValue(1);
  // Rects survive the enter morph so the EXIT can fly the art back.
  const rectsRef = useRef<MorphRects | null>(null);
  // Scrim + content fade over the live home underneath, both directions.
  const screenProgress = useSharedValue(0);
  const closingRef = useRef(false);

  useEffect(() => {
    screenProgress.value = reduceMotion
      ? 1
      : withTiming(1, { duration: SCREEN_IN_MS });
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The animated exit: content fades, the artwork flies back into its grid
  // slot, THEN the screen actually pops (with no native animation of its own).
  const runClose = useCallback(() => {
    if (closingRef.current) return;

    closingRef.current = true;

    const rects = rectsRef.current;

    if (reduceMotion || !rects) {
      screenProgress.value = withTiming(
        0,
        { duration: reduceMotion ? 0 : SCREEN_OUT_MS },
        () => runOnJS(router.back)(),
      );
      return;
    }

    // Re-arm the overlay at the hero and fly it home.
    setHeroShown(false);
    setMorph(rects);
    morphOpacity.value = 1;
    morphProgress.value = 1;
    screenProgress.value = withTiming(0, { duration: SCREEN_OUT_MS });
    morphProgress.value = withTiming(
      0,
      { duration: EXIT_MORPH_MS, easing: Easing.in(Easing.cubic) },
      finished => {
        if (finished) runOnJS(router.back)();
      },
    );
  }, [morphOpacity, morphProgress, reduceMotion, screenProgress]);

  // Android back plays the same exit — unless the player sheet is expanded
  // (its own handler collapses it; ours yields).
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (usePlayerStore.getState().sheetExpanded) return false;

        runClose();
        return true;
      },
    );

    return () => subscription.remove();
  }, [runClose]);

  // Reveal the real hero and drop the overlay together, so the handover is a
  // single invisible commit instead of a fade that can outrun the reveal.
  const landMorph = useCallback(() => {
    setHeroShown(true);
    setMorph(null);
  }, []);

  useEffect(() => {
    if (!handoff || reduceMotion) return;

    // Layout is committed by the time effects run — measure immediately (a
    // deferred frame here was most of the perceived flicker).
    const root = rootRef.current;
    const hero = heroArtRef.current;

    if (!root || !hero) {
      setHeroShown(true);
      return;
    }

    root.measureInWindow((rootX, rootY) => {
      hero.measureInWindow((heroX, heroY, heroWidth) => {
        if (!heroWidth) {
          setHeroShown(true);
          return;
        }

        // Both rects re-based into this screen's coordinate space; kept in
        // the ref so the exit can replay the flight in reverse.
        const rects: MorphRects = {
          from: {
            x: handoff.x - rootX,
            y: handoff.y - rootY,
            size: handoff.size,
          },
          to: { x: heroX - rootX, y: heroY - rootY, size: heroWidth },
        };
        rectsRef.current = rects;
        setMorph(rects);

        // A short hold at the source keeps continuity with the tapped tile
        // while the screen fades in under the overlay, then the flight.
        morphProgress.value = withDelay(
          MORPH_HOLD_MS,
          withTiming(
            1,
            { duration: MORPH_MS, easing: Easing.out(Easing.cubic) },
            finished => {
              if (finished) runOnJS(landMorph)();
            },
          ),
        );
      });
    });
    // Mount-only: the handoff is consumed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const morphStyle = useAnimatedStyle(() => {
    if (!morph) return { opacity: 0 };

    const progress = morphProgress.value;
    const scale = morph.to.size / morph.from.size;
    const travelX =
      morph.to.x + morph.to.size / 2 - (morph.from.x + morph.from.size / 2);
    const travelY =
      morph.to.y + morph.to.size / 2 - (morph.from.y + morph.from.size / 2);

    return {
      opacity: morphOpacity.value,
      transform: [
        { translateX: travelX * progress },
        { translateY: travelY * progress },
        { scale: 1 + (scale - 1) * progress },
      ],
    };
  }, [morph]);
  // -------------------------------------------------------------------------

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

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenProgress.value,
  }));

  return (
    <View ref={rootRef} style={styles.root}>
      {/* Scrim: home stays live underneath the transparent modal; this layer
          fades it toward the screen background in both directions. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.background },
          screenStyle,
        ]}
      />

      <Animated.View style={[styles.content, screenStyle]}>
        {/* Self-drawn header (no native bar): back plays the exit morph. Its
            height is FIXED (icons center in the region below the status bar) so
            the hero below it never shifts as the Compose icons settle. */}
        <View
          style={[
            styles.topBar,
            { height: insets.top + TOP_BAR_HEIGHT, paddingTop: insets.top },
          ]}
        >
          <ThemedHost matchContents>
            <IconButton onClick={runClose}>
              <Icon
                source={iconSource('arrow-back')}
                tint={colors.onSurface}
                contentDescription={t('common.back')}
              />
            </IconButton>
          </ThemedHost>
          {playlist ? (
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
          ) : null}
        </View>
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
            {/* Hero: the artwork IS the header. Invisible until the morph
                  overlay (if any) lands on it. */}
            <View style={styles.hero}>
              <View
                ref={heroArtRef}
                style={[
                  styles.heroArt,
                  { backgroundColor: colors.surfaceContainer },
                  !heroShown && styles.heroArtHidden,
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
                  (playlist?.songCount ?? 0) === 1 ? 'home.song' : 'home.songs',
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
      </Animated.View>

      {/* The flying artwork: a copy of the pressed tile, translated+scaled
            from where it was tapped onto the hero slot. */}
      {morph && handoff ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.morphOverlay,
            {
              backgroundColor: colors.surfaceContainer,
              height: morph.from.size,
              left: morph.from.x,
              top: morph.from.y,
              width: morph.from.size,
            },
            morphStyle,
          ]}
        >
          <Text
            doNotTranslate
            text={handoff.emoji}
            // Ratio-sized to the overlay's own square: after the uniform
            // scale it lands at exactly the hero's emoji size.
            style={{
              fontSize: handoff.size * ART_EMOJI_RATIO,
              lineHeight: handoff.size * ART_EMOJI_RATIO * 1.4,
            }}
          />
        </Animated.View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
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
  heroArtHidden: { opacity: 0 },
  morphOverlay: {
    alignItems: 'center',
    borderRadius: TILE_RADIUS,
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 10,
  },
  heroName: { fontWeight: '700', marginBottom: 2, textAlign: 'center' },
  heroDescription: { marginTop: 10, textAlign: 'center' },
  actions: { alignSelf: 'stretch', height: 48, marginTop: 16 },
  emptyWrap: { minHeight: 260 },
  listSkeleton: { gap: ROW_GAP },
});
