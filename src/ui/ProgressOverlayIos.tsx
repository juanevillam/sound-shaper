import { StyleSheet, View } from 'react-native';

import { useAppTheme, withAlpha } from '@/core';

import { ProgressViewIos } from './ProgressViewIos';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  WORK THE PERSON CANNOT INTERRUPT — a scrim, and the spinner over it.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * For the narrow case where an irreversible task is running and NOTHING on the
 * surface may be touched until it lands: deleting an account, and anything else
 * that tears its own screen down. A save or a follow is not this — those take
 * the spinner in the control's own slot (`SheetFormIos`'s commit glyph) and
 * leave the rest of the surface alive.
 *
 * ───────────────────────────────────────────────────────────────────────────
 *  WHY NOT A SPINNER IN THE ROW, WHICH IS THE CHEAPER ANSWER
 * ───────────────────────────────────────────────────────────────────────────
 *
 * That was built first and rejected on sight, for a reason worth keeping: a
 * `disabled(true)` on a SwiftUI `Form` propagates to the Form's ROWS and to
 * nothing else. The account sheet's ✕ and its swipe-to-dismiss grabber are
 * native nav chrome presented ABOVE the screen's content — neither is inside
 * that Host, so both stayed live while the account was being torn down. A row
 * that looks busy while the sheet is still dismissible is the appearance of a
 * guarantee without the guarantee.
 *
 * So the blocking is done by the thing that can actually block: a full-bleed
 * view that eats every touch. The caller kills the two chrome affordances
 * alongside it (`headerRight`, `gestureEnabled`, `sheetGrabberVisible`) —
 * they cannot be reached from in here, and a component that silently failed to
 * cover them would be the same half-guarantee again.
 *
 * ───────────────────────────────────────────────────────────────────────────
 *  WHY A DIM RATHER THAN A PLATE
 * ───────────────────────────────────────────────────────────────────────────
 *
 * The content stays legible underneath, which is the honest picture: the screen
 * is still there and still says what it said, it just cannot be used. Painting
 * the sheet's own colour over it would read as a NAVIGATION — a new blank
 * screen arriving — for a moment that is not one.
 *
 * The scrim is `shadow`, the portfolio's black-in-both-modes elevation role, at
 * an alpha rather than a hardcoded `rgba` (the standing rule: semantic roles
 * from the theme, alpha through `withAlpha`).
 */
const SCRIM_ALPHA = 0.4;

/**
 * THE INK ON THE SCRIM, and the one literal colour in this file.
 *
 * It is white in both appearances for exactly the reason `shadow` is black in
 * both: the ground it sits on is one ink in both, so its counterpart cannot
 * follow the appearance either. Left to the system colour the spinner is grey
 * on a grey wash and nearly invisible — checked on device, in both modes,
 * which is how this constant got written rather than assumed.
 *
 * It is NOT in `src/core` because it would be a theme role with exactly
 * one consumer. The day a second surface needs an ink over a scrim, this moves
 * there beside `shadow` and both callers read it from the theme.
 */
const SCRIM_INK = '#FFFFFF';

export function ProgressOverlayIos({ visible }: { visible: boolean }) {
  const { colors } = useAppTheme();

  if (!visible) return null;

  return (
    // No `pointerEvents` prop: the DEFAULT is what does the work here, and
    // naming it 'auto' would read as decoration rather than as the mechanism.
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: withAlpha(colors.shadow, SCRIM_ALPHA) },
      ]}
    >
      {/* Centres itself — see `ProgressViewIos`. */}
      <ProgressViewIos ink={SCRIM_INK} />
    </View>
  );
}
