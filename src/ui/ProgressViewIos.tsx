import { StyleSheet, View } from 'react-native';

import { ProgressView } from '@expo/ui/swift-ui';
import { progressViewStyle, tint } from '@expo/ui/swift-ui/modifiers';

import { SwiftUIHost } from './SwiftUIHost';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE INDETERMINATE SPINNER — the OTHER progress control, and when it wins.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `SkeletonBone` and this file are siblings, not alternatives, and the rule
 * that picks between them is written once in AGENTS.md → "Waiting has two
 * shapes". In one line: a BONE stands content whose shape is already known on
 * a screen the person NAVIGATED to; a SPINNER stands WORK THE PERSON STARTED,
 * or content whose shape cannot be predicted before it lands.
 *
 * The second half of that is why this exists. Explore's search results are a
 * MIX of person rows and top rows in a proportion and count nothing knows
 * until the query answers, so a bone set there promises a shape it cannot
 * keep — the one placeholder in the app that was lying. Apple's own search
 * surfaces (Music, App Store, Maps) show a spinner for exactly that reason.
 *
 * ───────────────────────────────────────────────────────────────────────────
 *  WHY THE BOX IS STATED RATHER THAN MATCHED
 * ───────────────────────────────────────────────────────────────────────────
 *
 * `matchContents` reports the child's size back into the RN tree AFTER the
 * fact, so the surface lays out once without it and again when it lands — the
 * async-answer family this repo has been bitten by three times. A circular
 * `ProgressView` has a fixed intrinsic size (UIKit's `.medium` activity
 * indicator, 20 × 20pt), so there is nothing to discover: the box is stated
 * and the spinner centres inside it. The starter's showcase keeps
 * `matchContents` because demonstrating the API is its job; product code
 * reserves the box.
 */
const SPINNER_BOX = 20;

/**
 * A screen-level indeterminate spinner. Inside a SwiftUI surface that already
 * has a `Host` (a `Form` row, a sheet bar), use `@expo/ui`'s `ProgressView`
 * directly instead — a nested Host is a second bridge for no gain.
 *
 * `ink` OVERRIDES THE SPINNER'S COLOUR, and it is the one knob here because a
 * bare `ProgressView` inherits its container's `tint` — which is right on an
 * app surface and wrong the moment the spinner is over something else. Two
 * cases so far: the account sheet's delete row, where the Form's blue replaced
 * a red label, and `ProgressOverlayIos`, where the ground is a scrim rather
 * than the page. Omit it everywhere else; the system colour is the default for
 * a reason.
 *
 * IT CENTRES ITSELF IN WHATEVER BOX IT GETS, which is `EmptyState`'s contract
 * and deliberately the same one: both are things `StateWrap` hands a full
 * screen frame to without a `top` flag, and a state component that needed its
 * caller to centre it would put that decision at every call site. Stood
 * without this it rendered in the top-left corner at 20 × 20 — caught by
 * screenshot, not by review.
 */
export function ProgressViewIos({ ink }: { ink?: string } = {}) {
  return (
    <View style={styles.centred}>
      <SwiftUIHost style={styles.box}>
        <ProgressView
          modifiers={[
            progressViewStyle('circular'),
            ...(ink ? [tint(ink)] : []),
          ]}
        />
      </SwiftUIHost>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: SPINNER_BOX, width: SPINNER_BOX },
  centred: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
