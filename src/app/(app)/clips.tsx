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
import {
  EmptyState,
  HeaderGlyphButtonIos,
  SheetFormBodyIos,
  StateWrapIos as StateWrap,
} from '@portfolio/mobile-ui';
import { router, Stack } from 'expo-router';

import { SheetScreen } from '@/components/ui/SheetScreenIos';
import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { formatTime } from '@/lib/player';
import { deleteClip } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';
import { usePlayerStore } from '@/store/player';

const NO_CLIPS: never[] = [];

// iOS-only route: the saved-clips manager as a content-hugging native form
// sheet (Android presents the Compose `ClipsSheet` in place). "New clip"
// dismisses the sheet and bumps the framing nonce — the PlayerSheet (still
// mounted under this native presentation) picks it up and drops the trim
// brackets on its scrubber.
function ClipsSheetScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();

  const current = usePlayerStore(s => s.current);
  const playClip = usePlayerStore(s => s.playClip);
  const activeClip = usePlayerStore(s => s.activeClip);
  const requestClipFraming = usePlayerStore(s => s.requestClipFraming);

  const clips = useClipsStore(s =>
    current ? (s.bySoundId[current.id] ?? NO_CLIPS) : NO_CLIPS,
  );

  if (!current) return <View style={{ backgroundColor: colors.sheet }} />;

  const onDelete = (clipId: string) => {
    haptics.medium();
    deleteClip({ clipId, soundId: current.id })
      .then(() => showSnackbar(t('snackbar.clip-deleted')))
      .catch(() => showSnackbar(t('snackbar.clip-delete-failed')));
  };

  const onNewClip = () => {
    router.back();
    requestClipFraming();
  };

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
          headerRight: () => (
            <HeaderGlyphButtonIos
              systemName="plus"
              label={t('player.clips.new')}
              onPress={onNewClip}
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
      {clips.length === 0 ? (
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
                  <SwipeActions.Actions edge="trailing">
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
