import { Box, Column } from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  fillMaxWidth,
  height,
  Shapes,
  width,
} from '@expo/ui/jetpack-compose/modifiers';

import { useAppTheme, withAlpha } from '@portfolio/core';

/**
 * A Compose bottom sheet's drag handle, drawn as CONTENT rather than taken from
 * `BottomSheetDefaults` — so it does not ripple.
 *
 * M3's own handle carries the accessibility expand/collapse `clickable`, and
 * Compose masks that indication to the SURFACE'S BOX rather than to the pill's
 * shape. Measured on a Galaxy A54 against a clean baseline, pressing the default
 * handle changed a region of exactly 32.0 x 48.0dp at a constant width on every
 * row — a sharp rectangle, narrower than it was tall, nothing like the pill
 * drawn inside it.
 *
 * `ModalBottomSheet.DragHandle` CANNOT FIX IT, and that is worth knowing before
 * reaching for the slot: @expo/ui wraps whatever goes in it in the same
 * clickable surface, so the slot decides the ripple's SIZE and not its SHAPE.
 * Clipping the slot's root to a capsule was measured and the ripple ignored it
 * — still a constant 96.0dp width at every row. Sizing the slot to 96 x 48 was
 * shipped first and fixed only the proportion; Juan asked for the ripple gone
 * (2026-09-02), and `showDragHandle={false}` plus this component is the only
 * thing that does it. Verified: zero pixels change on press.
 *
 * THE TRADE, STATED SO NOBODY RE-DISCOVERS IT: the handle stops being tappable,
 * so M3's tap-to-expand/collapse and its accessibility action go with the
 * ripple. Dragging the sheet still works, and every sheet here is also
 * dismissible by scrim and by back.
 *
 * THE BOX RESERVES M3'S OWN 48dp so nothing moves when a sheet swaps the
 * default handle for this one — the pill is 32 x 4 centred in it, which is the
 * spec's geometry. `onSurfaceVariant` is the spec's ROLE and is deliberately not
 * used: One UI collapses it into `onSurface` (see the palette note in
 * `@portfolio/core`), so the alpha is applied to `onSurface` instead.
 *
 * Usage — the sheet turns the native handle off and stands this first:
 *
 *     <ModalBottomSheet showDragHandle={false} ...>
 *       <SheetDragHandle />
 *       ...
 *     </ModalBottomSheet>
 */
/**
 * THE HANDLE'S GEOMETRY AND INK, EXPORTED — because one sheet in the family
 * cannot mount this component and must draw the same pill by hand.
 *
 * Sound Shaper's Android clip editor is RN (a Compose sheet's window eats the
 * gestures its content is made of), so it builds its own handle out of views.
 * It had a COPY of these numbers, and the copy had drifted exactly the way
 * this repo's notes say a private number always does: a 24dp box against M3's
 * 48, and the pill at full `onSurfaceMuted` instead of `onSurface` at 0.4.
 *
 * `box` is the reserved height, not the pill's — see the note above on why M3
 * reserves 48 for a 4dp pill.
 */
export const SHEET_DRAG_HANDLE = {
  width: 32,
  height: 4,
  box: 48,
  alpha: 0.4,
} as const;

const HANDLE_WIDTH = SHEET_DRAG_HANDLE.width;
const HANDLE_HEIGHT = SHEET_DRAG_HANDLE.height;
/** M3's drag-handle box, reserved so swapping the default handle moves nothing. */
const HANDLE_BOX_HEIGHT = SHEET_DRAG_HANDLE.box;
const HANDLE_ALPHA = SHEET_DRAG_HANDLE.alpha;

export function SheetDragHandle() {
  const { colors } = useAppTheme();

  return (
    <Column
      horizontalAlignment="center"
      verticalArrangement="center"
      modifiers={[fillMaxWidth(), height(HANDLE_BOX_HEIGHT)]}
    >
      <Box
        modifiers={[
          clip(Shapes.Circle),
          width(HANDLE_WIDTH),
          height(HANDLE_HEIGHT),
          background(withAlpha(colors.onSurface, HANDLE_ALPHA)),
        ]}
      />
    </Column>
  );
}
