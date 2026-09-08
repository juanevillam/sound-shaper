import { useRef, useState } from 'react';

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
  type ModalBottomSheetRef,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxHeight,
  fillMaxWidth,
  padding,
  size,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import {
  AppIcon,
  COMPOSE_SHEET_GLYPH_INSET,
  COMPOSE_SHEET_GUTTER,
  COMPOSE_SHEET_HEADER_TO_CONTENT,
  composeSheetBottomPadding,
  DestructiveConfirmDialog,
  EMPTY_STATE_STEPS,
  SheetDragHandle,
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
// what you've framed, or jump into the dedicated `clip-trim` editor for a new
// one — the same editor iOS pushes; in-place framing left with the console
// rework (2026-09-08).
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
const MENU_ICON_SIZE = 24;
/** Vertical air around the two state branches, so neither sits on the bar. */
const STATE_PADDING = 32;

export type ClipsSheetProps = {
  /** Close the sheet and push the `clip-trim` editor. */
  onNewClip: () => void;
  /**
   * Re-frame an existing clip: close the sheet and push the editor seeded
   * with ITS range. Saving updates that clip instead of creating another —
   * one anatomy for framing and re-framing.
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
  const sheetRef = useRef<ModalBottomSheetRef>(null);
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
  /**
   * EVERY EXIT ANIMATES, INCLUDING THE THREE THAT ARE NOT A SWIPE.
   *
   * A swipe or a scrim tap is Compose's own: it runs the slide-down and THEN
   * fires `onDismissRequest`. The three actions inside this sheet — play a
   * clip, +, Edit — went straight to a parent callback that flips
   * `clipsVisible` false, and unmounting a `ModalBottomSheet` tears its window
   * down where it stands. Screen-recorded on the A54 at 30fps: the sheet's top
   * edge held 482.13dp for six consecutive frames and was simply gone on the
   * seventh. No slide, on the three exits people actually use.
   *
   * `hide()` is the imperative half of the same animation, which is what
   * `EditSoundSheet` has always awaited before calling `onClose`. Same shape
   * here, so the sheet leaves the same way however you leave it.
   */
  const leave = async (action: () => void) => {
    await sheetRef.current?.hide();
    action();
  };

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
        {/* `onDismissRequest` is the swipe/scrim path, which Compose has
            already animated by the time it fires. The three in-sheet actions
            go through `leave` — see it. */}
        <ModalBottomSheet
          ref={sheetRef}
          onDismissRequest={onClose}
          skipPartiallyExpanded
          showDragHandle={false}
        >
          <SheetDragHandle />
          <Column
            verticalArrangement={{ spacedBy: 12 }}
            // NO HORIZONTAL PADDING HERE — each section states its own, which
            // is what lets a clip row run to the sheet's EDGES and take the
            // gutter as a content inset instead. A pressable list row whose
            // ripple stops short of the edge is not a Material list row, and
            // the same arrangement is already one file over, on the Shape
            // sheet's chips row. The bottom clears the navigation bar — a
            // Compose sheet's window runs to the screen edge. See
            // `composeSheetBottomPadding`.
            // FULL HEIGHT — every list sheet in the portfolio is: iOS's [1]
            // (an empty list at 0.6 left three quarters of the sheet dead the
            // moment it filled), Topper's follow sheets on Android.
            modifiers={[
              padding(0, 0, 0, composeSheetBottomPadding(insets.bottom)),
              fillMaxHeight(),
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
              modifiers={[
                fillMaxWidth(),
                // Bottom: the family's header→content gap
                // (`COMPOSE_SHEET_HEADER_TO_CONTENT`), less the column's own
                // 12 — the same statement the editors make around `SheetBar`.
                padding(
                  COMPOSE_SHEET_GUTTER,
                  4,
                  COMPOSE_SHEET_GLYPH_INSET,
                  COMPOSE_SHEET_HEADER_TO_CONTENT - 12,
                ),
              ]}
            >
              <Text
                color={colors.onSurface}
                style={{ typography: 'titleLarge' }}
                maxLines={1}
                modifiers={[weight(1)]}
              >
                {t('player.clips.title')}
              </Text>
              <IconButton onClick={() => void leave(onNewClip)}>
                <AppIcon
                  name="add"
                  tint={colors.onSurface}
                  contentDescription={t('player.clips.new')}
                />
              </IconButton>
            </Row>

            {failure ? (
              <Column
                modifiers={[
                  fillMaxWidth(),
                  padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
                ]}
              >
                <SheetErrorLine message={failure} />
              </Column>
            ) : null}

            {!settled ? (
              <Column
                horizontalAlignment="center"
                modifiers={[
                  fillMaxWidth(),
                  padding(
                    COMPOSE_SHEET_GUTTER,
                    STATE_PADDING,
                    COMPOSE_SHEET_GUTTER,
                    STATE_PADDING,
                  ),
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
               blow-up the RNHostView notes record. Same parts, same strings —
               and the steps are IMPORTED (`EMPTY_STATE_STEPS`) rather than
               matched by hand, which is what they were. Only the container
               differs. */
              <Column
                horizontalAlignment="center"
                verticalArrangement={{ spacedBy: EMPTY_STATE_STEPS.gap }}
                modifiers={[
                  fillMaxWidth(),
                  padding(
                    COMPOSE_SHEET_GUTTER,
                    STATE_PADDING,
                    COMPOSE_SHEET_GUTTER,
                    STATE_PADDING,
                  ),
                ]}
              >
                <Text style={{ fontSize: EMPTY_STATE_STEPS.emojiSize }}>
                  ✂️
                </Text>
                <Text
                  color={colors.onSurface}
                  style={{
                    typography: EMPTY_STATE_STEPS.title,
                    textAlign: 'center',
                  }}
                >
                  {t('player.clips.none')}
                </Text>
                <Text
                  color={colors.onSurfaceMuted}
                  style={{
                    typography: EMPTY_STATE_STEPS.subtitle,
                    textAlign: 'center',
                  }}
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
                      // The sound starts BEFORE the hide, not after it: the
                      // press is a request to HEAR this, and the answer should
                      // not wait on an animation. The sheet then slides away
                      // over a player that is already playing.
                      onClick={() => {
                        playClip(clip.id, clip.startMs, clip.endMs);
                        void leave(onClose);
                      }}
                      color="transparent"
                      shape={CLIP_ROW_SHAPE}
                      modifiers={[fillMaxWidth()]}
                    >
                      <Row
                        verticalAlignment="center"
                        horizontalArrangement={{ spacedBy: 12 }}
                        // The ROW is inset, not the Surface around it, so the
                        // press ripple reaches the sheet's edges the way
                        // Material's own list rows do — and the range lands on
                        // the same gutter as the title above it. It used to
                        // carry a bare 12 inside a Column already padded 24,
                        // which put the text 11.73dp inboard of that title
                        // (measured 25.60 against 37.33 on the A54) and bought
                        // no bleed in return.
                        modifiers={[
                          fillMaxWidth(),
                          padding(
                            COMPOSE_SHEET_GUTTER,
                            4,
                            COMPOSE_SHEET_GLYPH_INSET,
                            4,
                          ),
                        ]}
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
                                void leave(() =>
                                  onEditClip({
                                    id: clip.id,
                                    startMs: clip.startMs,
                                    endMs: clip.endMs,
                                  }),
                                );
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
            colors={{
              danger: colors.danger,
              primary: colors.primary,
              surfaceDialog: colors.surfaceDialog,
            }}
            onConfirm={() => onDelete(confirmClipId)}
            onDismiss={() => setConfirmClipId(null)}
          />
        </ThemedHost>
      ) : null}
    </>
  );
}
