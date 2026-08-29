import { useState } from 'react';

import {
  CircularWavyProgressIndicator,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  IconButton,
  ModalBottomSheet,
  Row,
  Shape,
  Surface,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  size,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import {
  AppIcon,
  composeSheetBottomPadding,
  DestructiveConfirmDialog,
} from '@portfolio/mobile-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetErrorLine } from '@/components/ui/SheetErrorLine';
import { SKELETON_DELAY_MS } from '@/components/ui/Skeleton';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDelayedShow } from '@/hooks/useDelayedShow';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { formatTime } from '@/lib/player';
import { deleteClip } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';
import { usePlayerStore } from '@/store/player';

// The saved-clips manager (the Shape sheet's sibling): play, re-frame or delete
// what you've framed, or jump into framing a new one — the framing itself
// happens ON the player's scrubber, where the sound is.
//
// THE TWIN IS `app/(app)/clips.tsx`, and it has the same parts under the same
// names: a title with an ADD action (never a commit — this sheet saves nothing),
// a spinner while the first snapshot is in flight, a real empty state, and rows
// that play, edit and delete. What differs is the language. iOS puts edit and
// delete on opposed swipe edges because that is where iOS hides row actions;
// Material puts them in an overflow menu, which is also what removes the
// unguarded single-tap delete this sheet used to carry.

const CLIP_ROW_SHAPE = Shape.RoundedCorner({
  cornerRadii: {
    topStart: 12,
    topEnd: 12,
    bottomStart: 12,
    bottomEnd: 12,
  },
});

const NO_CLIPS: never[] = [];

/** The M3 loading indicator's box, matching `SheetBar`'s commit spinner. */
const SPINNER_SIZE = 20;
/** The empty state's mark. `EmptyState`'s own step, which it draws at 48. */
const EMPTY_EMOJI_SIZE = 48;
const MENU_ICON_SIZE = 24;
/** Vertical air around the two state branches, so neither sits on the bar. */
const STATE_PADDING = 32;

export type ClipsSheetProps = {
  /** Close the sheet and drop the trim brackets on the player's scrubber. */
  onNewClip: () => void;
  /**
   * Re-frame an existing clip: close the sheet and drop the brackets on ITS
   * range rather than around the playhead. Saving updates that clip instead of
   * creating another — one anatomy for framing and re-framing, which is the
   * same thing iOS's leading swipe reaches.
   */
  onEditClip: (clip: { id: string; startMs: number; endMs: number }) => void;
  onClose: () => void;
};

export function ClipsSheet({
  onNewClip,
  onEditClip,
  onClose,
}: ClipsSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [menuClipId, setMenuClipId] = useState<string | null>(null);
  /** The clip whose destructive confirmation is up — see `onDelete`. */
  const [confirmClipId, setConfirmClipId] = useState<string | null>(null);
  /** A delete that failed, said here because the toast cannot be seen from
   *  inside a Compose sheet — see `SheetErrorLine`. */
  const [failure, setFailure] = useState<string | null>(null);

  const current = usePlayerStore(s => s.current);
  const playClip = usePlayerStore(s => s.playClip);
  const activeClip = usePlayerStore(s => s.activeClip);

  const clips = useClipsStore(s =>
    current ? (s.bySoundId[current.id] ?? NO_CLIPS) : NO_CLIPS,
  );
  /**
   * SETTLED, because an unloaded sound and a sound with no clips look
   * identical in `clips` — see the iOS twin (`app/(app)/clips.tsx`), which
   * carries the full write-up. `settledBySoundId` was put in the store for
   * this branch and had never been read by either platform.
   */
  const settled = useClipsStore(s =>
    current ? (s.settledBySoundId[current.id] ?? false) : false,
  );
  /**
   * A SPINNER, NOT A LINE OF TEXT — the same call iOS made, in Material. The
   * rule (root AGENTS.md → "Waiting has two shapes") sends predictable shapes
   * to a bone and unpredictable ones to a spinner, and nothing knows how many
   * clips a sound has until the snapshot lands. This shipped as a muted
   * `bodySmall` reading "Loading clips…" on the argument that a bottom sheet
   * which has just animated in has no empty box to centre a control in; it has
   * one, and a sentence where every other waiting surface in the portfolio
   * shows a control was the odd one out. Delayed by the same 400ms every other
   * first-load surface uses, so the usual instant cache hit shows nothing at
   * all rather than a flash.
   */
  const showSpinner = useDelayedShow(SKELETON_DELAY_MS);

  if (!current) return null;

  /**
   * A CONFIRMATION, AND IT HAS TO BE A DIALOG — the one thing this sheet cannot
   * use is a toast.
   *
   * Deleting was a single unguarded tap on a trailing trash glyph, where iOS
   * hides the same action behind a swipe; one mis-tap and a clip was gone. An
   * undo snackbar was built first, because a reversible destructive list action
   * is Material's own idiom for exactly this — and it is INVISIBLE HERE.
   * Verified on the A54: a Compose `ModalBottomSheet` is its own window above
   * the RN root, so the toast drew behind it and the row simply vanished with
   * no explanation and no way back. That is not new — the plain `clip-deleted`
   * toast this sheet has always fired was never visible either, for the same
   * reason; nobody had looked. (iOS solves it with `SnackbarOutlet`; Android
   * has no outlet inside a Compose window.)
   *
   * So the confirmation goes in a window of its own, which is what the sound
   * editor's delete already does one sheet over — same component, same shape.
   * The toast still fires on FAILURE, and by then the sheet is beside the
   * point.
   */
  const onDelete = (clipId: string) => {
    haptics.medium();
    setConfirmClipId(null);
    setFailure(null);

    // This sheet stays open, so the failure is said IN it rather than in a
    // toast that would draw behind its window.
    deleteClip({ clipId, soundId: current.id }).catch(() =>
      setFailure(t('snackbar.clip-delete-failed')),
    );
  };

  return (
    <>
      <ThemedHost matchContents>
        {/* No ref: a row press closes through `onClose` like every other exit,
            so there is nothing here to dismiss imperatively. */}
        <ModalBottomSheet onDismissRequest={onClose} skipPartiallyExpanded>
          <Column
            verticalArrangement={{ spacedBy: 12 }}
            // The bottom clears the navigation bar — a Compose sheet's window
            // runs to the screen edge. See `composeSheetBottomPadding`.
            modifiers={[
              padding(24, 0, 24, composeSheetBottomPadding(insets.bottom)),
              fillMaxWidth(),
            ]}
          >
            {/* NOT `SheetBar`. That bar pairs a title with a filled Save pill,
              and this sheet commits NOTHING — it lists what exists and its
              trailing action ADDS one. A prominent filled button is Material's
              primary-commit shape, so it said "done" about a form there is
              none of; iOS reached the same conclusion and draws a `plus`. An
              M3 icon button is that glyph in Material. */}
            <Row
              verticalAlignment="center"
              modifiers={[fillMaxWidth(), padding(0, 4, 0, 0)]}
            >
              <Text
                color={colors.onSurface}
                style={{ typography: 'titleLarge' }}
                maxLines={1}
                modifiers={[weight(1)]}
              >
                {t('player.clips.title')}
              </Text>
              <IconButton onClick={onNewClip}>
                <AppIcon
                  name="add"
                  tint={colors.onSurface}
                  contentDescription={t('player.clips.new')}
                />
              </IconButton>
            </Row>

            {failure ? <SheetErrorLine message={failure} /> : null}

            {!settled ? (
              <Column
                horizontalAlignment="center"
                modifiers={[
                  fillMaxWidth(),
                  padding(0, STATE_PADDING, 0, STATE_PADDING),
                ]}
              >
                {showSpinner ? (
                  <CircularWavyProgressIndicator
                    color={colors.primary}
                    modifiers={[size(SPINNER_SIZE, SPINNER_SIZE)]}
                  />
                ) : null}
              </Column>
            ) : clips.length === 0 ? (
              /* A REAL EMPTY STATE, the parts `EmptyState` names — a mark, a
               title, a supporting line — rather than the lone muted sentence
               that used to stand here while iOS drew the full thing.

               It is re-drawn in Compose rather than mounted: `EmptyState` hosts
               its OWN `Host`, and a Host inside this sheet's Host is the nesting
               blow-up the RNHostView notes record. Same parts, same steps, same
               strings; only the container differs. */
              <Column
                horizontalAlignment="center"
                verticalArrangement={{ spacedBy: 8 }}
                modifiers={[
                  fillMaxWidth(),
                  padding(0, STATE_PADDING, 0, STATE_PADDING),
                ]}
              >
                <Text style={{ fontSize: EMPTY_EMOJI_SIZE }}>✂️</Text>
                <Text
                  color={colors.onSurface}
                  style={{ typography: 'titleLarge', textAlign: 'center' }}
                >
                  {t('player.clips.none')}
                </Text>
                <Text
                  color={colors.onSurfaceMuted}
                  style={{ typography: 'bodyMedium', textAlign: 'center' }}
                >
                  {t('player.clips.empty')}
                </Text>
              </Column>
            ) : (
              <Column
                verticalArrangement={{ spacedBy: 2 }}
                modifiers={[fillMaxWidth()]}
              >
                {clips.map(clip => {
                  const isActive = activeClip?.clipId === clip.id;
                  const range = `${formatTime(clip.startMs / 1000)} – ${formatTime(clip.endMs / 1000)}`;

                  return (
                    <Surface
                      key={clip.id}
                      // PRESSING A CLIP LEAVES THE SHEET, exactly as iOS's twin
                      // does. Playing one is a request to HEAR it, and the thing
                      // that shows what is sounding — the artwork, the scrubber,
                      // the frame's own range — is the player underneath.
                      // Staying put left the person looking at a list while the
                      // sound they asked for played somewhere they could not see.
                      onClick={() => {
                        playClip(clip.id, clip.startMs, clip.endMs);
                        onClose();
                      }}
                      color="transparent"
                      shape={CLIP_ROW_SHAPE}
                      modifiers={[fillMaxWidth()]}
                    >
                      <Row
                        verticalAlignment="center"
                        horizontalArrangement={{ spacedBy: 12 }}
                        modifiers={[fillMaxWidth(), padding(12, 4, 0, 4)]}
                      >
                        <Column
                          verticalArrangement={{ spacedBy: 1 }}
                          modifiers={[weight(1)]}
                        >
                          <Text
                            color={isActive ? colors.primary : colors.onSurface}
                            style={{ typography: 'bodyLarge' }}
                            maxLines={1}
                          >
                            {range}
                          </Text>
                        </Column>
                        {/* THE SOUNDING ROW TAKES A GLYPH AS WELL AS THE ACCENT.
                          Material marks an active list item with the accent and
                          that stays, but COLOUR ALONE IS NOT AN INDICATOR for
                          anyone who cannot see this particular colour — the
                          accent was the only marker here, where iOS has always
                          paired it with a mark. Music does the same. */}
                        {isActive ? (
                          <AppIcon
                            name="graphic-eq"
                            size={MENU_ICON_SIZE}
                            tint={colors.primary}
                            contentDescription={t('player.clips.playing')}
                          />
                        ) : null}
                        <DropdownMenu
                          expanded={menuClipId === clip.id}
                          onDismissRequest={() => setMenuClipId(null)}
                        >
                          <DropdownMenu.Trigger>
                            <IconButton onClick={() => setMenuClipId(clip.id)}>
                              <AppIcon
                                name="more-vert"
                                tint={colors.onSurfaceMuted}
                                contentDescription={t('player.menu.label')}
                              />
                            </IconButton>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Items>
                            <DropdownMenuItem
                              onClick={() => {
                                setMenuClipId(null);
                                onEditClip({
                                  id: clip.id,
                                  startMs: clip.startMs,
                                  endMs: clip.endMs,
                                });
                              }}
                            >
                              <DropdownMenuItem.Text>
                                <Text color={colors.onSurface}>
                                  {t('player.clips.editAction')}
                                </Text>
                              </DropdownMenuItem.Text>
                              <DropdownMenuItem.LeadingIcon>
                                <AppIcon
                                  name="edit"
                                  size={MENU_ICON_SIZE}
                                  tint={colors.onSurface}
                                />
                              </DropdownMenuItem.LeadingIcon>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setMenuClipId(null);
                                setConfirmClipId(clip.id);
                              }}
                            >
                              <DropdownMenuItem.Text>
                                <Text color={colors.danger}>
                                  {t('player.clips.delete')}
                                </Text>
                              </DropdownMenuItem.Text>
                              <DropdownMenuItem.LeadingIcon>
                                <AppIcon
                                  name="delete"
                                  size={MENU_ICON_SIZE}
                                  tint={colors.danger}
                                />
                              </DropdownMenuItem.LeadingIcon>
                            </DropdownMenuItem>
                          </DropdownMenu.Items>
                        </DropdownMenu>
                      </Row>
                    </Surface>
                  );
                })}
              </Column>
            )}
          </Column>
        </ModalBottomSheet>
      </ThemedHost>

      {/* Its OWN Host — a dialog mounted beside other Compose content in one
          Host flickers the siblings, which is the note `EditSoundSheet` records
          for the identical arrangement. */}
      {confirmClipId ? (
        <ThemedHost matchContents>
          <DestructiveConfirmDialog
            dialog={{
              title: t('player.clips.deleteConfirm.title'),
              message: t('player.clips.deleteConfirm.message'),
              confirm: t('player.clips.deleteConfirm.confirm'),
              cancel: t('player.clips.deleteConfirm.cancel'),
            }}
            colors={{ danger: colors.danger }}
            onConfirm={() => onDelete(confirmClipId)}
            onDismiss={() => setConfirmClipId(null)}
          />
        </ThemedHost>
      ) : null}
    </>
  );
}
