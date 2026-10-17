import { View } from 'react-native';

import {
  Button,
  HStack,
  Image,
  Section,
  Spacer,
  SwipeActions,
  Text as SwiftUIText,
} from '@expo/ui/swift-ui';
import { foregroundStyle, tint } from '@expo/ui/swift-ui/modifiers';

import { router, Stack } from 'expo-router';

import { SheetScreen } from '@/components/ui/SheetScreenIos';
import { SKELETON_DELAY_MS } from '@/components/ui/Skeleton';
import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDelayedShow } from '@/hooks/useDelayedShow';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { formatTime } from '@/lib/player';
import { deleteClip } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';
import { usePlayerStore } from '@/store/player';
import {
  EmptyState,
  HeaderGlyphButtonIos,
  HeaderGlyphGroupIos,
  ProgressViewIos,
  SheetFormBodyIos,
  StateWrap,
} from '@/ui';

const NO_CLIPS: never[] = [];

// iOS-only route: the saved-clips manager as a native form sheet (Android
// presents the Compose `ClipsSheet` in place). "New clip" pushes the Voice
// Memos-style editor sheet on top; it saves and pops back here.
function ClipsSheetScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();

  const current = usePlayerStore(s => s.current);
  const playClip = usePlayerStore(s => s.playClip);
  const activeClip = usePlayerStore(s => s.activeClip);

  const clips = useClipsStore(s =>
    current ? (s.bySoundId[current.id] ?? NO_CLIPS) : NO_CLIPS,
  );
  /**
   * "NO CLIPS" IS A CLAIM, AND THIS SCREEN WAS MAKING IT BEFORE IT KNEW.
   *
   * The branch below was `clips.length === 0`, which is also what an unloaded
   * sound looks like — so a first open on a cold cache asserted the sound had
   * no clips and then popped a list in underneath the sentence. The store has
   * carried `settledBySoundId` for exactly this since it was written ("so the
   * clips section can branch between loading and genuinely empty") and nothing
   * had ever read it.
   *
   * The window is small — `useClipsSubscription` mounts when the PLAYER
   * expands, not when this sheet opens, so the snapshot has usually landed
   * before anyone can tap through — but small is not never, and the empty state
   * is the one branch that must not be guessed.
   */
  const settled = useClipsStore(s =>
    current ? (s.settledBySoundId[current.id] ?? false) : false,
  );
  /**
   * A SPINNER, NOT A BONE, and it is the call Explore's search already made.
   * The rule (AGENTS.md → "Waiting has two shapes") sends predictable shapes to
   * a bone and unpredictable ones to a spinner: nothing knows how many clips a
   * sound has until the snapshot lands, so a set of bones promises a row count
   * it cannot keep. Delayed by the same 400ms every other first-load surface
   * uses, so the usual instant cache hit shows nothing at all rather than a
   * flash.
   */
  const showSpinner = useDelayedShow(SKELETON_DELAY_MS);

  if (!current) return <View style={{ backgroundColor: colors.sheet }} />;

  const onDelete = (clipId: string) => {
    haptics.medium();
    deleteClip({ clipId, soundId: current.id })
      .then(() => showSnackbar(t('snackbar.clip-deleted')))
      .catch(() => showSnackbar(t('snackbar.clip-delete-failed')));
  };

  // The editor stacks OVER this sheet (trophies-over-account), so saving or
  // cancelling lands back on the list — with the new clip already in it.
  // Framing-on-the-scrubber was the old iOS entry; the nonce path it used
  // stays for Android's in-place sheet.
  const onNewClip = () => router.push('/clip-trim');

  return (
    // `SheetScreen` for the toast — see `SnackbarOutlet`. Deleting a clip
    // confirms with a snackbar that drew behind this sheet.
    <SheetScreen>
      {/* Real UIKit bar, Topper's standard — but NOT the commit-modal pair.
          This sheet commits nothing: it lists what exists and its trailing
          action ADDS one, so the glyph is `plus`. A ✓ would say "done" about a
          form there is none of. Both slots are stated here, because a
          screen-level `headerRight` REPLACES the close glyph the route table
          supplies — the trap `HeaderGlyphGroupIos` records. */}
      <Stack.Screen
        options={{
          headerLeft: () => (
            <HeaderGlyphButtonIos
              systemName="xmark"
              label={t('common.close')}
              onPress={() => router.back()}
            />
          ),
          // Shape beside the add, one merged pill — the clip editor's own
          // trailing arrangement, so the sound stays shapeable from every
          // clip surface (Juan, 2026-09-08: Shape was unreachable from
          // here).
          headerRight: () => (
            <HeaderGlyphGroupIos
              glyphs={[
                {
                  systemName: 'slider.horizontal.3',
                  label: t('player.shape.title'),
                  onPress: () => router.push('/shaper'),
                },
                {
                  systemName: 'plus',
                  label: t('player.clips.new'),
                  onPress: onNewClip,
                },
              ]}
            />
          ),
        }}
      />
      {/**
       * THE EMPTY BRANCH REPLACES THE FORM, it does not sit inside one —
       * Topper's `trash` pattern, and what makes a full-height list sheet read
       * as a screen rather than as emptiness.
       *
       * It was a grouped ROW holding one instructional line, pinned to the top.
       * That was tolerable while the sheet was 0.6 of the screen and plainly
       * wrong once it went to [1]: the surface grew and the empty branch did
       * not, so a stray row sat above 600pt of nothing. `EmptyState` is the
       * portfolio's answer and has fourteen call sites; this was not one of
       * them — the same term-added-after-the-surface miss the player kept
       * producing.
       *
       * IT MUST SIT OUTSIDE `SheetFormBodyIos`. Placed inside, the Form wraps
       * it in a section row and it renders as an empty white capsule with the
       * glyph clipped — built that way first and caught on screen.
       */}
      {!settled ? (
        <StateWrap>{showSpinner ? <ProgressViewIos /> : null}</StateWrap>
      ) : clips.length === 0 ? (
        <StateWrap>
          <EmptyState
            systemImage="scissors"
            title={t('player.clips.none')}
            subtitle={t('player.clips.empty')}
          />
        </StateWrap>
      ) : (
        <SheetFormBodyIos fullHeight>
          <Section>
            {clips.map(clip => {
              const isActive = activeClip?.clipId === clip.id;
              const range = `${formatTime(clip.startMs / 1000)} – ${formatTime(clip.endMs / 1000)}`;

              return (
                // Delete is a SWIPE action now, not a trailing trash icon: two
                // tap targets in one row is an Android table idiom, and iOS
                // hides row destruction behind the swipe (Mail, Reminders).
                <SwipeActions key={clip.id}>
                  {/* PRESSING A CLIP LEAVES THE SHEET. Playing one is a
                      request to HEAR it, and the thing that shows what is
                      sounding — the artwork, the scrubber, the frame's own
                      range — is the player underneath. Staying put left the
                      person looking at a list while the sound they asked for
                      played somewhere they could not see. `onNewClip` above
                      already dismisses for the same reason.

                      THE ACTIVE ROW IS THE MUSIC IDIOM, NOT A CHECKMARK. A
                      trailing ✓ is Apple's SELECTION accessory — the chosen
                      ringtone, the current AirPlay output — and it says "this
                      is set", which is not what is true here: `activeClip` is
                      transient playback state that a seek, a sound change or
                      the clip simply ending all clear. Music marks the
                      sounding row instead, with the accent AND a glyph, and
                      the glyph is the half that matters: colour alone is not
                      an indicator for anyone who cannot see this particular
                      colour. */}
                  <Button
                    onPress={() => {
                      router.back();
                      playClip(clip.id, clip.startMs, clip.endMs);
                    }}
                  >
                    <HStack>
                      <SwiftUIText
                        modifiers={[
                          foregroundStyle(
                            isActive ? colors.primary : colors.onSurface,
                          ),
                        ]}
                      >
                        {range}
                      </SwiftUIText>
                      <Spacer />
                      {isActive ? (
                        <Image
                          systemName="speaker.wave.2.fill"
                          size={15}
                          color={colors.primary}
                        />
                      ) : null}
                    </HStack>
                  </Button>
                  {/* EDIT RE-FRAMES — it pushes the same editor New Clip
                      uses, seeded with this clip's range: one anatomy for
                      framing and re-framing. On the LEADING edge, which is
                      the portfolio's standard for opposed verbs on one row:
                      `TopItemListIos` (edit leading / delete trailing) and
                      `TrashListIos` (recover leading / delete trailing) both
                      split them, so the two directions cannot be mistaken
                      for each other — stacking Edit beside Delete on one
                      edge was built first and is exactly the misclick
                      adjacency Juan called (2026-08-27). `allowsFullSwipe`
                      off, the reference's own setting: a full swipe is a
                      committed gesture and editing is not a commitment. A
                      non-destructive swipe action KEEPS THE ACCENT (root
                      AGENTS.md: its label draws white whatever the tint, and
                      the greys read as disabled). */}
                  <SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
                    <Button
                      label={t('player.clips.editAction')}
                      systemImage="pencil"
                      modifiers={[tint(colors.primary)]}
                      onPress={() =>
                        router.push({
                          pathname: '/clip-trim',
                          params: {
                            clipId: clip.id,
                            startMs: String(clip.startMs),
                            endMs: String(clip.endMs),
                          },
                        })
                      }
                    />
                  </SwipeActions.Actions>
                  <SwipeActions.Actions edge="trailing" allowsFullSwipe>
                    {/* LABELLED, like every swipe action in the portfolio.
                      This was glyph-only on the grounds that a worded action
                      pushes this row's short time range off the leading edge
                      and leaves an empty pill — which happens, and is what
                      APPLE ships: Reminders on iOS 26.5, swiped on a row whose
                      whole content is "Hi", draws icon AND label at ~88pt and
                      pushes the text completely away. The old note also cited
                      Mail as glyph-only and put a labelled action at ~110pt;
                      neither survived measurement. */}
                    {/* TINTED EXPLICITLY — a swipe action takes its background
                        from the inherited `tint`, and `SheetFormBodyIos` tints
                        the Form `primary`, so `role="destructive"` alone
                        rendered this BLUE. */}
                    <Button
                      role="destructive"
                      label={t('player.clips.delete')}
                      systemImage="trash"
                      modifiers={[tint(colors.danger)]}
                      onPress={() => onDelete(clip.id)}
                    />
                  </SwipeActions.Actions>
                </SwipeActions>
              );
            })}
          </Section>
        </SheetFormBodyIos>
      )}
    </SheetScreen>
  );
}

export default iosOnlyRoute(ClipsSheetScreen);
