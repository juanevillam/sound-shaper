import { useEffect, useId, useRef } from 'react';

import { useSnackbar } from './snackbar';

/**
 * RENDERS THE APP'S TOAST INSIDE A SURFACE THAT IS PRESENTED ABOVE THE ROOT.
 *
 * THE PROBLEM. `SnackbarProvider` wraps the app's root, so its toast is a child
 * of the root screen's view — and UIKit presents a `formSheet` ABOVE that view.
 * Every message fired from inside a sheet therefore rendered BEHIND it and was
 * never seen: unblocking a person, a failed account deletion, a failed save in
 * either editor, a posted comment. Verified with a probe firing on a 5s
 * interval from a TAB screen — visible every time there, never once while a
 * sheet was up (iPhone 17 / iOS 26.5).
 *
 * WHY NOT `FullWindowOverlay`. RNScreens ships exactly that for "draw above
 * presented controllers", and it does put the toast on screen — but its window
 * is outside the app's `SafeAreaProvider` (a `SafeAreaView` in there resolves
 * to zero and the toast rides into the middle of the screen) and, fatally,
 * `@expo/ui`'s SwiftUI host does not draw inside it: the capsule lost its
 * Liquid Glass and the message rendered as bare text on the sheet. Both
 * measured, then reverted.
 *
 * WHAT THIS DOES INSTEAD. The toast is a plain React node the provider hands
 * out through context, and whichever presented surface is on top renders it in
 * ITS OWN tree — where the SwiftUI host works exactly as it does for every
 * native list a sheet already draws. So the glass survives; nothing about the
 * toast's appearance is different in a sheet, only where it is mounted.
 *
 * THE TROPHY BANNER HAS THE SAME PROBLEM AND THE OPPOSITE ANSWER, deliberately.
 * It is the app's other root-mounted overlay, it hit this exact wall first, and
 * it solved it by SUSPENDING: `useIosSheetPresented` holds the unlock queue
 * while any sheet is up and flushes banner + sound on dismiss. Do not "unify"
 * the two — a trophy is unrelated to what you are doing and can wait for the
 * form to close, while a snackbar is feedback ABOUT the action just taken in
 * that sheet and would read as detached if it arrived after the sheet went
 * away. Same defect, two right answers.
 *
 * (That the banner had an answer and the snackbar did not is the drift this
 * repo keeps finding: two things with one problem, one of them fixed.)
 *
 * THE TOAST RENDERS IN THE OUTLET IT WAS FIRED ON — its BOUND outlet, chosen
 * at show time, never re-pointed by surfaces mounting above or unmounting
 * below. When the bound surface itself is dismissed the provider decides the
 * toast's fate (`SnackbarScope`): die with it, or re-home with a fresh
 * entrance. "Topmost outlet wins, and re-parent on every change" was the old
 * rule, and every sheet close under a live toast was a flicker-and-jump
 * (Juan, 2026-08-27).
 *
 * A SHEET HAS NO TAB BAR TO CLEAR, so an outlet states the bottom clearance
 * ITS surface needs at claim time (the provider's own `iosBottomInset` clears
 * the app's floating chrome; over a sheet that chrome is not there). At claim
 * rather than by effect, so a toast's first frame already stands at the right
 * height.
 */
export function SnackbarOutlet({
  iosBottomInset,
}: {
  iosBottomInset?: number;
}) {
  const { boundOutlet, claimOutlet, releaseOutlet, toast } = useSnackbar();
  // A stable per-mount id. `useId` is unique per component instance, and the
  // provider orders claims by arrival rather than by this value.
  const reactId = useId();
  const idRef = useRef<number>(0);
  if (idRef.current === 0) idRef.current = hashId(reactId);

  useEffect(() => {
    const id = idRef.current;
    claimOutlet(id, iosBottomInset);

    return () => releaseOutlet(id);
  }, [claimOutlet, iosBottomInset, releaseOutlet]);

  return boundOutlet === idRef.current ? <>{toast}</> : null;
}

// `useId` returns a string; the registry keys on numbers so "most recently
// claimed" is a plain comparison. Collisions are impossible in practice (the
// ids are unique strings) and harmless if they happened — two outlets would
// render one toast between them, which is what a single id means anyway.
const hashId = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1)
    hash = (hash * 31 + value.charCodeAt(index)) | 0;

  return hash === 0 ? 1 : hash;
};
