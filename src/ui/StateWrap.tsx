import { type ReactNode } from 'react';

import { ScrollView, StyleSheet } from 'react-native';

/**
 * The container for a screen's NON-LIST states — screen-level empties and
 * errors, and the skeletons that stand in for content — under a screen's own
 * chrome.
 *
 * IT IS NOT `StateWrapIos`, AND THE RENAME IS THE POINT. In this repo the `Ios`
 * suffix means a component that exists ONLY on iOS; this one answers a question
 * both platforms have — where does a state that is not a list stand — and Sound
 * Shaper renders it from two cross-platform files. What is iOS-specific is the
 * MECHANISM, not the component: `contentInsetAdjustmentBehavior` and
 * `alwaysBounceVertical` are UIKit levers that Android ignores, so there it is
 * simply a full-height scroller and the `top` / centred contract still holds.
 * Every Topper caller was already aliasing the old name back to this one.
 *
 * IT LIVES IN THE PACKAGE because the question it answers is the same in every
 * app: where does a state that is not a list stand, on a screen whose chrome is
 * UIKit's. Topper wrote it (out of two divergent copies of its own), Sound
 * Shaper's home needed the identical thing the day it moved to the system large
 * title, and a second copy is exactly the drift this component already exists to
 * have ended once.
 *
 * Home and Explore each had their own copy of this, with the same measurement
 * written out twice in two different comments. They also reached it from
 * opposite directions: Explore used to MEASURE itself (`measureInWindow` on
 * every layout and focus change, a 400ms re-measure timer for the header
 * transition, and two guessed chrome constants — 100 expanded / 60 collapsed)
 * to work around a content view it believed was mis-sized under the stacked
 * search bar, while Home had already answered the identical problem under its
 * large title with one prop. One component now, one contract:
 *
 *  - CENTRED states take `never`. `EmptyState` already centres itself in
 *    whatever box it gets, and `automatic` insets that box below the chrome
 *    while still standing the scroll view's FULL height — so the centre lands
 *    half the header too low. MEASURED at 177.5pt below the screen's centre,
 *    which reads as an error message sagging toward the tab bar. With no inset
 *    the container IS the frame, the centre is the screen's centre, and the
 *    transparent chrome simply sits over it. Nothing centred here is tall
 *    enough to scroll under the bar anyway.
 *  - SKELETONS take `top`, because they stand in for real content and have to
 *    start exactly where it will — under the large title or the search field,
 *    with the bottom inset the floating tab bar gets for free.
 *
 * That second bullet is load-bearing beyond aesthetics: a skeleton that starts
 * anywhere other than where its content will start IS layout shift, which is
 * the defect this screen pair keeps being audited for.
 */
export function StateWrap({
  children,
  top = false,
  topInset,
}: {
  children: ReactNode;
  /** Stand the content where real content starts, rather than centring it. */
  top?: boolean;
  /**
   * WHERE real content starts, stated by the caller instead of asked of
   * UIKit. `automatic` is an async answer, and on a REMOUNT of this scroller
   * (a lab step swapping branches, a fast retry) it can lose the race and
   * leave the whole skeleton standing at inset 0, under the bar — the
   * `PeopleSheetListIos` finding, seen a third time on top-detail's bones.
   * A surface that knows its chrome's height passes it here; the scroller
   * then takes `never` and stands the inset as padding, which cannot race.
   * Only read with `top`.
   */
  topInset?: number;
}) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior={
        top && topInset === undefined ? 'automatic' : 'never'
      }
      contentContainerStyle={
        top
          ? topInset !== undefined
            ? { paddingTop: topInset }
            : undefined
          : styles.centred
      }
      alwaysBounceVertical={false}
      // Harmless where there is no keyboard, required where there is: Explore
      // reaches these states with the search field focused.
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // `flexGrow`, not `flex`: the box must be free to exceed the frame when its
  // content does, while still filling it when the content is smaller — which
  // is what lets `EmptyState` centre against the real screen height.
  centred: { flexGrow: 1 },
});
