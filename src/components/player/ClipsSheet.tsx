import { useRef, useState } from 'react';

import {
  CircularWavyProgressIndicator,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  IconButton,
  ModalBottomSheet,
  Row,
  Text,
  type ModalBottomSheetRef,
} from '@expo/ui/jetpack-compose';
import {
  background,
  clickable,
  clip,
  fillMaxHeight,
  fillMaxWidth,
  padding,
  size,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClipTrimSheet } from '@/components/player/ClipTrimSheet';
import { ShaperSheet } from '@/components/player/ShaperSheet';
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
import {
  AppIcon,
  COMPOSE_SHEET_GUTTER,
  COMPOSE_SHEET_HEADER_TO_CONTENT,
  composeSheetBottomPadding,
  DestructiveConfirmDialog,
  EMPTY_STATE_STEPS,
  GROUP_ROW_GAP,
  groupRowShape,
  menuContainer,
  SheetBar,
  SheetBarAction,
  sheetContainer,
  SheetDragHandle,
} from '@/ui';

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

const NO_CLIPS: never[] = [];

/** The M3 loading indicator's box, matching `SheetBar`'s commit spinner. */
const SPINNER_SIZE = 20;
const MENU_ICON_SIZE = 24;

export type ClipsSheetProps = {
  onClose: () => void;
};

/**
 * THE CLIP EDITOR STACKS OVER THIS SHEET — `ClipTrimSheet`, mounted here
 * exactly as `ShaperSheet` is, so the list stays standing underneath and
 * dismissing the editor uncovers it. That is what iOS gets by pushing
 * `clip-trim` over `clips`.
 *
 * IT TOOK THE LONG WAY ROUND, on one claim nobody re-tested: that a Compose
 * `ModalBottomSheet` is its own window above the RN root and so the two could
 * not stack. The editor was a pushed route, then a hand-built RN sheet over
 * the player, then a MODE this sheet swapped into — each one working around a
 * window it was never barred from. The Shape sheet had been stacking over both
 * of these surfaces the whole time, which is how Juan spotted it (2026-09-10).
 * A stacked sheet also needs no back affordance: BACK and the scrim dismiss
 * the top sheet and reveal the list, which is what a person expects.
 */
export function ClipsSheet({ onClose }: ClipsSheetProps) {
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<ModalBottomSheetRef>(null);
  const [menuClipId, setMenuClipId] = useState<string | null>(null);
  /** The clip whose destructive confirmation is up — see `onDelete`. */
  const [confirmClipId, setConfirmClipId] = useState<string | null>(null);
  // Shape stacks over this sheet — its own Compose window, exactly as the
  // clip editor hosts it (Juan, 2026-09-08: the sound's Shape was
  // unreachable from here).
  const [shaperVisible, setShaperVisible] = useState(false);
  /**
   * The editor mode: `null` is the LIST, `{ editing: null }` is New Clip and
   * `{ editing: clip }` re-frames one. State rather than a route, because the
   * sheet never leaves the screen between the two.
   */
  const [trim, setTrim] = useState<{
    editing: { clipId: string; endMs: number; startMs: number } | null;
  } | null>(null);
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
  // A dead listener says so in the sheet's error line, where a failed delete
  // already speaks, instead of spinning forever (iOS: an `EmptyState` with
  // Retry).
  const failed = useClipsStore(s =>
    current ? (s.failedBySoundId[current.id] ?? false) : false,
  );
  const shownFailure = failure ?? (failed ? t('player.clips.loadError') : null);
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
          // The family's one ground, stated — unset, Compose picks the OEM
          // token and the RN clip editor this sheet opens cannot share the
          // answer. See `sheetContainer`.
          containerColor={sheetContainer(colors, scheme)}
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
            {/* THE FAMILY'S BAR, with contained glyph actions. This was a
                hand-rolled `Row` of bare `IconButton`s on the argument that
                `SheetBar` pairs a title with a filled Save pill and this sheet
                COMMITS NOTHING. That half still holds — there is no pill here —
                but the bar itself was never the editors' to keep: stated this
                way the title ink, the row height and the header→content gap are
                the family's, and the two glyphs are CONTAINED rather than
                floating on the sheet (Juan, 2026-09-10). */}
            <Column
              modifiers={[
                fillMaxWidth(),
                padding(
                  COMPOSE_SHEET_GUTTER,
                  0,
                  COMPOSE_SHEET_GUTTER,
                  COMPOSE_SHEET_HEADER_TO_CONTENT - 12,
                ),
              ]}
            >
              <SheetBar
                title={t('player.clips.title')}
                actions={
                  <>
                    {/* Shape beside the add — the sound stays shapeable from
                        every clip surface. */}
                    <SheetBarAction
                      icon="tune"
                      label={t('player.shape.title')}
                      onPress={() => setShaperVisible(true)}
                    />
                    <SheetBarAction
                      icon="add"
                      label={t('player.clips.new')}
                      onPress={() => setTrim({ editing: null })}
                    />
                  </>
                }
              />
            </Column>

            {shownFailure ? (
              <Column
                modifiers={[
                  fillMaxWidth(),
                  padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
                ]}
              >
                <SheetErrorLine message={shownFailure} />
              </Column>
            ) : null}

            {!settled ? (
              // CENTRED IN THE LEFTOVER HEIGHT, like the empty state below —
              // `StateWrap` centres both on iOS, and this sheet's column is
              // the full-height frame to centre in.
              <Column
                horizontalAlignment="center"
                verticalArrangement="center"
                modifiers={[
                  weight(1),
                  fillMaxWidth(),
                  padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
                ]}
              >
                {showSpinner ? (
                  <CircularWavyProgressIndicator
                    color={colors.primary}
                    modifiers={[size(SPINNER_SIZE, SPINNER_SIZE)]}
                  />
                ) : null}
              </Column>
            ) : failed && clips.length === 0 ? null : clips.length === 0 ? (
              /* A REAL EMPTY STATE, the parts `EmptyState` names — a mark, a
               title, a supporting line — rather than the lone muted sentence
               that used to stand here while iOS drew the full thing.

               It is re-drawn in Compose rather than mounted: `EmptyState` hosts
               its OWN `Host`, and a Host inside this sheet's Host is the nesting
               blow-up the RNHostView notes record. Same parts, same strings —
               and the steps are IMPORTED (`EMPTY_STATE_STEPS`) rather than
               matched by hand, which is what they were. Only the container
               differs. */
              // TWO COLUMNS, because the arrangement type is one-or-the-other:
              // `spacedBy` carries no alignment, so the WEIGHTED outer column
              // centres the block in the sheet's leftover height (what
              // `StateWrap` does for iOS's EmptyState — it sat pinned under
              // the header here; Juan, 2026-09-10) and the inner one keeps the
              // steps' gap.
              <Column
                horizontalAlignment="center"
                verticalArrangement="center"
                modifiers={[
                  weight(1),
                  fillMaxWidth(),
                  padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
                ]}
              >
                <Column
                  horizontalAlignment="center"
                  verticalArrangement={{ spacedBy: EMPTY_STATE_STEPS.gap }}
                  modifiers={[fillMaxWidth()]}
                >
                  {/* The Material twin of iOS's `scissors` mark, at the shared
                    steps — the 2026-09-04 sweep retired emoji unavailable
                    states portfolio-wide and this sheet was still carrying
                    one (Juan, 2026-09-08). */}
                  <AppIcon
                    name="content-cut"
                    size={EMPTY_STATE_STEPS.iconSize}
                    tint={colors.onSurfaceMuted}
                    modifiers={[padding(0, 0, 0, EMPTY_STATE_STEPS.iconGap)]}
                  />
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
              </Column>
            ) : (
              /* GROUPED CARD ROWS — the follow sheets' recipe verbatim
                 (clip → sheetField → clickable, 2dp seams, first/last
                 corners): iOS lists the clips in a native grouped List, and
                 this is that statement in Material (Juan, 2026-09-08). The
                 stack is inset to the gutter, so the ripple is the card's —
                 bounded — rather than the old edge-to-edge transparent row. */
              <Column
                verticalArrangement={{ spacedBy: GROUP_ROW_GAP }}
                modifiers={[
                  fillMaxWidth(),
                  padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
                ]}
              >
                {clips.map((rowClip, rowIndex) => {
                  const isActive = activeClip?.clipId === rowClip.id;
                  const range = `${formatTime(rowClip.startMs / 1000)} – ${formatTime(rowClip.endMs / 1000)}`;

                  return (
                    <Row
                      key={rowClip.id}
                      verticalAlignment="center"
                      horizontalArrangement={{ spacedBy: 12 }}
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
                      // PRESSING A CLIP LEAVES THE SHEET, exactly as iOS's
                      // twin does — the sound starts BEFORE the hide so the
                      // answer never waits on the animation (full reasoning
                      // in git history).
                      modifiers={[
                        fillMaxWidth(),
                        clip(groupRowShape(rowIndex, clips.length)),
                        background(colors.sheetField),
                        clickable(() => {
                          playClip(rowClip.id, rowClip.startMs, rowClip.endMs);
                          void leave(onClose);
                        }),
                        padding(16, 4, 8, 4),
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
                        // The portfolio's one menu surface — every overflow
                        // menu takes `menuContainer`; unset, Compose draws the
                        // raw One UI token this term exists to repair.
                        color={menuContainer(colors, scheme)}
                        expanded={menuClipId === rowClip.id}
                        onDismissRequest={() => setMenuClipId(null)}
                      >
                        <DropdownMenu.Trigger>
                          <IconButton onClick={() => setMenuClipId(rowClip.id)}>
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
                              // NO `leave` — the sheet stays and swaps to the
                              // editor mode. That closing hide is exactly what
                              // made the two surfaces read as a trade rather
                              // than a step deeper.
                              setTrim({
                                editing: {
                                  clipId: rowClip.id,
                                  startMs: rowClip.startMs,
                                  endMs: rowClip.endMs,
                                },
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
                              setConfirmClipId(rowClip.id);
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
      {/* STACKED OVER THIS SHEET, exactly as Shape stacks over both — so the
          list stays standing underneath and dismissing the editor uncovers it,
          which is what iOS gets by pushing `clip-trim` over `clips`. It was a
          MODE of this sheet for one commit, on the belief that Compose sheets
          could not stack; the Shape sheet had been disproving that all along
          (Juan, 2026-09-10). */}
      {trim && (
        <ClipTrimSheet editing={trim.editing} onClose={() => setTrim(null)} />
      )}

      {shaperVisible && <ShaperSheet onClose={() => setShaperVisible(false)} />}

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
