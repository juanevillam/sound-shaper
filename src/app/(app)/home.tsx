import { useCallback, useState } from 'react';

import { Platform, StyleSheet, View } from 'react-native';

import { StateWrap, EmptyState } from '@portfolio/mobile-ui';
import { FlashList } from '@shopify/flash-list';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, router } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

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
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { HeaderSettingsButton } from '@/components/ui/HeaderSettingsButton';
// DEV LAB — delete with `src/dev/uiStateLab`.
import { Screen } from '@/components/ui/Screen';
import { SKELETON_DELAY_MS, SoundTileSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { UI_STATE_LAB, useUiStateLab } from '@/dev/uiStateLab';
import { UiStateLabBar } from '@/dev/UiStateLabBar';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDelayedShow } from '@/hooks/useDelayedShow';
import { useI18n } from '@/i18n';
import { readId3Tags } from '@/lib/id3';
import { type Sound } from '@/services/firebase/sounds';
import { stashPendingUpload } from '@/store/pendingUpload';
import { usePlayerStore } from '@/store/player';
import { useSoundsStore } from '@/store/sounds';
import { TILE_GAP, SCREEN_PADDING } from '@/styles/metrics';

// The grid rows FlashList renders: the add tile plus the sounds, pre-paired
// into 2-column rows (FlashList's numColumns + varying tile heights fight each
// other; hand-pairing keeps rows aligned). The add tile leads so it stays
// reachable no matter how long the library grows.
type GridRow = {
  id: string;
  left: Sound | 'add';
  right: Sound | 'add' | null;
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
 * and it is set to match Topper: band-scanned on the A54, Topper's bar bottom
 * is 97.78dp and the "Your Tops" ink starts 123.38 — 25.6dp of gap. Topper
 * reaches that figure by accident — list padding plus the header text's own
 * leading — so copying the outcome is the only way to actually match it, and
 * it DRIFTS when Topper's home is reworked: this was 29.5 against a measured
 * 31.6 until the 2026-09-04 rail-tile rework moved Topper's first ink, found
 * 3.9dp adrift on 2026-09-08. A retune re-measures Topper first.
 */
const GRID_TOP_GAP = IS_IOS ? 24 : 25.6;

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

const toGridRows = (sounds: Sound[]): GridRow[] => {
  const cells: (Sound | 'add')[] = ['add', ...sounds];
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

  const firstLoad = lab ? labState === 'skeleton' : !hasSettled;
  const error = lab ? labState === 'error' : rawError;
  const rows = toGridRows(sounds);

  const renderCell = useCallback(
    (cell: Sound | 'add' | null) => {
      if (cell === null) return <View style={styles.cell} />;

      if (cell === 'add')
        return (
          <View style={styles.cell}>
            <AddSoundTile onPress={openAddSound} />
          </View>
        );

      return (
        <View style={styles.cell}>
          <SoundTile
            sound={cell}
            isCurrent={cell.id === currentSoundId}
            isPlaying={cell.id === currentSoundId && isPlaying}
            rate={rate}
            onPress={() => onPressSound(cell)}
            onLongPress={() =>
              Platform.OS === 'ios'
                ? router.push({
                    pathname: '/edit-sound',
                    params: { soundId: cell.id },
                  })
                : setEditingSoundId(cell.id)
            }
          />
        </View>
      );
    },
    [openAddSound, onPressSound, currentSoundId, isPlaying, rate],
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
          `CollapsingHeaderTitle` — deleted from @portfolio/mobile-ui
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
                // ONE GROUND, AND IT DOES NOT MOVE — `surface`, the same
                // static bar every other Android screen in the portfolio
                // wears (the family retired the on-scroll step; see
                // `useHeaderScroll` in @portfolio/mobile-ui and this app's
                // own stack `headerStyle`). This bar stepped
                // background → surfaceContainer on scroll for a while after
                // that, the one holdout because it is hand-drawn (Juan,
                // 2026-09-08: always elevated, like the other apps' bars).
                backgroundColor: colors.surface,
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
  // The navigator's own Android header type, which Topper and Expo UI Starter get
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
