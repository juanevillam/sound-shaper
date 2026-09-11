import { Column, RNHostView } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import {
  COMPOSE_SHEET_GUTTER,
  COMPOSE_SHEET_HEADER_TO_CONTENT,
  SheetBar,
  SheetBarAction,
} from '@portfolio/mobile-ui';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ClipTrimEditor } from '@/components/player/ClipTrimEditor';
import { useClipTrimScreen } from '@/components/player/useClipTrimScreen';
import { useI18n } from '@/i18n';

// ---------------------------------------------------------------------------
// ANDROID'S CLIP EDITOR IS A PANE OF THE CLIPS SHEET — not a sheet of its own.
//
// It has been three things in three days, and the last two are the lesson. It
// shipped as a PUSHED route (a screen replacing the player mid-task), became an
// RN sheet over the player (2026-09-08), and is now a MODE the clips sheet
// swaps into. What was wrong with the RN sheet is exactly what Juan named
// (2026-09-10): iOS STACKS its editor over the clips list, and Android cannot —
// a Compose `ModalBottomSheet` is its own window above the RN root, so the list
// had to close as the editor opened. One surface leaving while another arrives
// is a different flow, not the same flow in Material. A sheet that swaps its
// own content is the Material answer, and it is simpler than either.
//
// THE RN-IN-COMPOSE BLOCKER WAS RE-TESTED, AND IT WAS HALF A DIAGNOSIS. The
// note that sent this editor out of the sheet said interactive RN inside a
// Compose sheet's dialog window "loses its touches" (Topper's comments sheet,
// whose rows went Compose for it). Measured here on the A54, that is not what
// happens: TAPS land perfectly — the transport toggled play/pause through the
// host every time — and only GESTURE-HANDLER pans were dead, so the editor
// looked alive and would not scrub.
//
// The cause is that a Compose sheet is its own WINDOW and
// react-native-gesture-handler only sees touches under a
// `GestureHandlerRootView` in the window it is in. The app's root is in the
// other one. Wrapping the hosted editor in its own root — the same fix RNGH
// documents for RN `Modal` — makes the band pan and the caps drag. That also
// explains why `EditSoundSheet`'s RN media picker (a plain Pressable) worked
// in a sheet all along while anything dragged did not.
//
// A CAUTION BEFORE GENERALISING IT: what was verified is pans and taps in this
// editor. A scrolling FlashList inside a sheet is a different question and the
// comments sheet's own call is not reopened here.
//
// WHAT THE PANE OWNS is the bar and the editor. The scrim, the corners, the
// drag handle, the spring and the drag-to-dismiss are the SHEET's now, which is
// most of what the old `ClipTrimSheet` existed to hand-build.
// ---------------------------------------------------------------------------

export type ClipTrimPaneProps = {
  /** Re-frame an existing clip; `null` is New Clip. */
  editing: { clipId: string; endMs: number; startMs: number } | null;
  /** Back to the list — this pane never closes the sheet. */
  onBack: () => void;
  onShape: () => void;
  /**
   * The box the editor fills, stated by the sheet (never `matchContents`).
   *
   * THE WIDTH IS A NUMBER, NOT `'100%'`. `RNHostView`'s `style` lays out its
   * own shadow node, which has no Compose parent to resolve a percentage
   * against — with `width: '100%'` the editor measured about a quarter of the
   * sheet and every row inside it (band, overview, transport) laid out to
   * that, left-aligned. Measured on the A54.
   */
  width: number;
  height: number;
};

export function ClipTrimPane({
  editing,
  onBack,
  onShape,
  width: paneWidth,
  height: paneHeight,
}: ClipTrimPaneProps) {
  const { t } = useI18n();

  const { current, editingClipId, onSave, range, saving, setRange } =
    useClipTrimScreen({ editing, onDone: onBack });

  if (!current) return null;

  return (
    <Column modifiers={[fillMaxWidth(), weight(1)]}>
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
        {/* The family's bar: a title, the contained Shape action, and the
            commit as a filled pill that carries a spinner while it writes —
            the sound editor's bar, term for term. It drew a bare ✕, a bare
            tune and the word "Save" in the accent before. */}
        <SheetBar
          title={t(editingClipId ? 'player.clips.edit' : 'player.clips.new')}
          leading={
            <SheetBarAction
              icon="arrow-back"
              label={t('common.back')}
              onPress={onBack}
              enabled={!saving}
            />
          }
          actions={
            <SheetBarAction
              icon="tune"
              label={t('player.shape.title')}
              onPress={onShape}
              enabled={!saving}
            />
          }
          saveLabel={t('player.clips.saveClip')}
          saving={saving}
          onSave={onSave}
        />
      </Column>

      {/* STATED BOX, never `matchContents` — the host reports its size after
          the fact, which inside a sheet is a shift on the frame the content
          mounts. The sheet measures the pane and hands it down. */}
      <RNHostView style={{ height: paneHeight, width: paneWidth }}>
        {/* ITS OWN GESTURE ROOT. A Compose sheet is a separate WINDOW, and
            react-native-gesture-handler only sees touches under a
            `GestureHandlerRootView` in the window it is in — the app's root is
            in the other one. Taps survived without it (the transport worked,
            which is why the editor looked alive) and every PAN was dead: the
            band would not scrub, the caps would not drag. This is the same
            fix RNGH documents for RN `Modal`. */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ClipTrimEditor
            range={range}
            onRangeChange={(startS, endS) => setRange({ startS, endS })}
          />
        </GestureHandlerRootView>
      </RNHostView>
    </Column>
  );
}
