import { useEffect, useState } from 'react';

import { useNavigation } from 'expo-router';

/**
 * THE HOST MUST NOT MOUNT WHILE THE SHEET IS STILL PRESENTING.
 *
 * A SwiftUI `Host` reads the safe area ONCE, as frame padding, and never
 * re-reads it. Mounted mid-presentation it takes the animating geometry and
 * keeps it: a native `List` inside then sits ~33pt too high for the life of the
 * sheet and its first row runs under the sheet's own header. Band-scanned on
 * iPhone 17 / iOS 26.5 — card top 134.33 against the correct 167.0, and it does
 * not settle on scroll.
 *
 * IT ONLY SHOWS ON THE SECOND OPEN, which is what makes it so easy to ship: the
 * first time, the query behind the sheet is a cold round trip, so the Host
 * mounts long after the sheet has landed. Reopen and Firestore answers from
 * cache, the Host mounts inside the animation, and the layout is wrong. Juan
 * found it by opening the See All sheet twice.
 *
 * `transitionEnd` IS THE SIGNAL — the navigator's own "the presentation
 * animation is done". Two other candidates were measured and rejected:
 * `InteractionManager.runAfterInteractions` resolves immediately (the sheet is
 * a NATIVE animation, so there is no JS interaction to wait on — card stayed at
 * 134.33), and a plain timer is a race: 200ms still failed, 400 passed, which is
 * a threshold to sit next to rather than a fix.
 *
 * The timeout is a BACKSTOP, not the mechanism: if the event never arrives the
 * content must still appear. It is deliberately longer than any presentation.
 *
 * THE WAIT IS INVISIBLE because a pixel-matched skeleton stands in for it. That
 * is the second job the bones have earned on every sheet that uses this.
 *
 * MOVED HERE from Topper's hooks the day a second app needed it (Sound
 * Shaper's clip editor defers its off-centre waveform tiles until the sheet
 * lands, 2026-08-27) — the terms-move rule: the definition lives in the
 * package, the apps keep thin re-exports.
 *
 * IT LIVES HERE, not in the one screen that first needed it: three sheets now
 * host a native `List` (See All, Followers/Following, Blocked Users) and every
 * one of them has this failure mode. NOT to be confused with
 * `useIosSheetPresented`, which answers a different question — "is ANY native
 * sheet covering the RN root right now", asked by the trophy overlay.
 */
const PRESENTATION_BACKSTOP_MS = 600;

/**
 * ONE FRAME AFTER THE EVENT, NOT ON IT — the second half of this fix, and the
 * half that was missing.
 *
 * `transitionEnd` fires when the presentation ANIMATION ends, which is not the
 * same instant as the sheet's final layout pass. A `List` mounted on the event
 * itself came up with its content offset at zero while UIKit's top content
 * inset for the bar arrived a frame later, so the first rows sat UNDER the
 * sheet's own header — and unlike the frozen-safe-area failure above, this one
 * silently corrects itself the moment anything scrolls, which is exactly what
 * makes it easy to miss (Juan caught it on the Blocked sheet; band-scanned
 * 59.00 below the sheet's top edge against the family's 84.00, iPhone 17 /
 * iOS 26.5, stable across eight consecutive frames and gone after one flick).
 *
 * A double `requestAnimationFrame` is the standard "after the next layout and
 * paint" wait. It is NOT a timer threshold like the 200/400ms one rejected
 * above: it is tied to the render loop, so it cannot drift with device speed.
 */
const afterNextFrame = (run: () => void) => {
  let inner = 0;
  const outer = requestAnimationFrame(() => {
    inner = requestAnimationFrame(run);
  });

  return () => {
    cancelAnimationFrame(outer);
    if (inner) cancelAnimationFrame(inner);
  };
};

export function useSheetLanded(): boolean {
  const navigation = useNavigation();
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    let cancelFrames: (() => void) | undefined;
    const land = () => {
      cancelFrames?.();
      cancelFrames = afterNextFrame(() => setLanded(true));
    };

    const unsubscribe = navigation.addListener(
      // A native-stack event; the generic navigation type does not carry it.
      // @ts-expect-error see above
      'transitionEnd',
      land,
    );
    const backstop = setTimeout(land, PRESENTATION_BACKSTOP_MS);

    return () => {
      unsubscribe();
      clearTimeout(backstop);
      cancelFrames?.();
    };
  }, [navigation]);

  return landed;
}
