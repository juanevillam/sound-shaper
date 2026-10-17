import { useCallback, useState } from 'react';

import { useWindowDimensions } from 'react-native';

import { Column, ModalBottomSheet, RNHostView } from '@expo/ui/jetpack-compose';
import {
  fillMaxHeight,
  fillMaxWidth,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClipTrimEditor } from '@/components/player/ClipTrimEditor';
import { ShaperSheet } from '@/components/player/ShaperSheet';
import { useClipTrimScreen } from '@/components/player/useClipTrimScreen';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/core';
import { useI18n } from '@/i18n';
import {
  COMPOSE_SHEET_GUTTER,
  COMPOSE_SHEET_HEADER_HEIGHT,
  COMPOSE_SHEET_HEADER_TO_CONTENT,
  composeSheetBottomPadding,
  sheetContainer,
  SHEET_DRAG_HANDLE,
  SheetBar,
  SheetBarAction,
  SheetDragHandle,
} from '@/ui';

// ---------------------------------------------------------------------------
// ANDROID'S CLIP EDITOR IS A SHEET STACKED OVER THE CLIPS LIST — the same
// arrangement iOS gets by pushing `clip-trim` over `clips`.
//
// IT TOOK THREE WRONG ANSWERS TO GET HERE, and the reason is one claim nobody
// re-tested. A Compose `ModalBottomSheet` is its own dialog WINDOW, and the
// note in this app said interactive RN inside one loses its touches — so the
// editor was first a pushed route, then a hand-built RN sheet over the player,
// then a MODE the clips sheet swapped into, each arrangement working around a
// window it was never allowed to be in. Juan asked the question that undid all
// of it (2026-09-10): the SHAPE sheet already stacks over this editor and over
// the clips list, and dismissing it uncovers whatever was underneath. Compose
// sheets stack perfectly well. Nothing ever needed working around.
//
// WHAT THE NOTE GOT RIGHT AND WRONG. Taps always landed — the transport
// toggled play/pause through the host every time. Only gesture-handler PANS
// were dead, because RNGH sees touches only under a `GestureHandlerRootView`
// in its own window and the app's root is in the other one. A root inside the
// host is the whole fix (the same one RNGH documents for RN `Modal`), and it
// is what lets this editor live in a sheet at all. Not generalised to Topper's
// comments sheet: a scrolling FlashList is a different question.
//
// WHAT STACKING BUYS, beyond matching iOS: no mode to swap, no back affordance
// to invent (BACK and the scrim dismiss THIS sheet and reveal the list, which
// is what a person expects from a stacked surface), and no hand-built chrome —
// the scrim, the corners, the handle and the drag are the sheet's.
// ---------------------------------------------------------------------------

/**
 * The editor's box — the sheet less its handle, its bar and the navigation-bar
 * clearance the column already pads. STATED, because `RNHostView` reports its
 * size after the fact and a sheet cannot take a shift on the frame its content
 * mounts (the standing rule about `matchContents` in a native container).
 */
const editorHeight = (windowHeight: number, insetBottom: number): number =>
  windowHeight -
  SHEET_DRAG_HANDLE.box -
  COMPOSE_SHEET_HEADER_HEIGHT -
  COMPOSE_SHEET_HEADER_TO_CONTENT -
  composeSheetBottomPadding(insetBottom);

export type ClipTrimSheetProps = {
  /** Re-frame an existing clip; `null` is New Clip. */
  editing: { clipId: string; endMs: number; startMs: number } | null;
  /** Dismissed — the clips list is standing underneath. */
  onClose: () => void;
};

export function ClipTrimSheet({ editing, onClose }: ClipTrimSheetProps) {
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: winH, width: winW } = useWindowDimensions();
  // Shape stacks over THIS sheet, exactly as it stacks over the list.
  const [shaperVisible, setShaperVisible] = useState(false);
  /**
   * THE SHEET STOPS COMPETING FOR THE DRAG WHILE A FINGER IS ON THE BAND.
   *
   * A Compose `ModalBottomSheet`'s drag-to-dismiss is a NATIVE gesture in
   * the window above RN's, and scrubbing is never purely horizontal — so the
   * sheet kept claiming the drag and sliding away mid-trim, on the one
   * interaction this surface exists for (Juan, 2026-09-10). The editor
   * reports touch-down and this turns `sheetGesturesEnabled` off for its
   * duration; swipe-to-dismiss is untouched everywhere else on the sheet,
   * and BACK and the scrim never depended on it.
   */
  const [bandTouched, setBandTouched] = useState(false);
  const onBandTouch = useCallback((down: boolean) => setBandTouched(down), []);

  const { current, editingClipId, onSave, range, saving, setRange } =
    useClipTrimScreen({ editing, onDone: onClose });

  if (!current) return null;

  return (
    <>
      <ThemedHost matchContents>
        <ModalBottomSheet
          containerColor={sheetContainer(colors, scheme)}
          onDismissRequest={onClose}
          // See `bandTouched` — the editor's drag and the sheet's were
          // racing for the same finger.
          sheetGesturesEnabled={!bandTouched}
          skipPartiallyExpanded
          showDragHandle={false}
        >
          <SheetDragHandle />
          <Column
            modifiers={[
              padding(0, 0, 0, composeSheetBottomPadding(insets.bottom)),
              fillMaxHeight(),
              fillMaxWidth(),
            ]}
          >
            <Column
              modifiers={[
                fillMaxWidth(),
                padding(
                  COMPOSE_SHEET_GUTTER,
                  0,
                  COMPOSE_SHEET_GUTTER,
                  COMPOSE_SHEET_HEADER_TO_CONTENT,
                ),
              ]}
            >
              {/* The family's bar: a title, the contained Shape action, and
                  the commit as a filled pill carrying a spinner while it
                  writes — the sound editor's bar, term for term. NO BACK
                  GLYPH: this sheet is stacked, so leaving it is the sheet's
                  own dismiss and the list is already behind it. */}
              <SheetBar
                title={t(
                  editingClipId ? 'player.clips.edit' : 'player.clips.new',
                )}
                actions={
                  <SheetBarAction
                    icon="tune"
                    label={t('player.shape.title')}
                    onPress={() => setShaperVisible(true)}
                    enabled={!saving}
                  />
                }
                saveLabel={t('player.clips.saveClip')}
                saving={saving}
                onSave={onSave}
              />
            </Column>

            <RNHostView
              style={{
                height: editorHeight(winH, insets.bottom),
                width: winW,
              }}
            >
              {/* ITS OWN GESTURE ROOT — see the window note in the header. */}
              <GestureHandlerRootView style={{ flex: 1 }}>
                <ClipTrimEditor
                  range={range}
                  onRangeChange={(startS, endS) => setRange({ startS, endS })}
                  onBandTouch={onBandTouch}
                />
              </GestureHandlerRootView>
            </RNHostView>
          </Column>
        </ModalBottomSheet>
      </ThemedHost>

      {shaperVisible && <ShaperSheet onClose={() => setShaperVisible(false)} />}
    </>
  );
}
