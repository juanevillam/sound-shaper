import { StyleSheet, View } from 'react-native';

import { ProgressView } from '@expo/ui/swift-ui';
import {
  controlSize,
  progressViewStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { SwiftUIHost } from './SwiftUIHost';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE INDETERMINATE SPINNER — the OTHER progress control, and when it wins.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `SkeletonBone` and this file are siblings, not alternatives, and the rule
 * that picks between them is written once in `docs/standards.md` → "Waiting
 * has two shapes". In one line: a BONE stands content whose shape is already known on
 * a screen the person NAVIGATED to; a SPINNER stands WORK THE PERSON STARTED,
 * or content whose shape cannot be predicted before it lands.
 *
 * The second half of that is why this exists. It was learned on Topper's
 * search results — a MIX of person rows and top rows in a proportion and count
 * nothing knows until the query answers — where a bone set promised a shape it
 * could not keep. Here it is the Clips list: nothing knows how many clips a
 * sound has until the snapshot lands. Apple's own search
 * surfaces (Music, App Store, Maps) show a spinner for exactly that reason.
 *
 * ───────────────────────────────────────────────────────────────────────────
 *  WHY THE BOX IS STATED RATHER THAN MATCHED
 * ───────────────────────────────────────────────────────────────────────────
 *
 * `matchContents` reports the child's size back into the RN tree AFTER the
 * fact, so the surface lays out once without it and again when it lands — the
 * async-answer family this repo has been bitten by three times. A circular
 * `ProgressView` has a fixed intrinsic size per control size, so there is
 * nothing to discover: the box is stated and the spinner centres inside it.
 * Product code reserves the box.
 *
 * ───────────────────────────────────────────────────────────────────────────
 *  LARGE, NOT THE DEFAULT MEDIUM
 * ───────────────────────────────────────────────────────────────────────────
 *
 * This shipped at the default `.medium` and read as a speck. MEASURED on
 * iPhone 17 / iOS 26.5, in Explore's search states, which is where the two
 * sit one step apart in the SAME `StateWrap` box:
 *
 *   spinner (Searching)            19.67 × 19.67
 *   ContentUnavailableView symbol  45.67 × 46.00   ← same slot, next state
 *   the search field above both    43.67 tall
 *
 * So the one state that filled the screen's centre put 43% of the mark there
 * that its neighbour did, and a person stepping between them sees the screen
 * empty out. `controlSize('large')` is UIKit's own next step rather than a
 * number of ours — a spinner is a denser mark than an outline glyph, so landing
 * a little under the symbol is right. Re-measured after the change: the ink is
 * 34.67 × 34.67 inside the 37pt frame this box reserves, so it fills without
 * clipping and now reads at 75% of the symbol beside it instead of 43%.
 *
 * ONE SIZE FOR BOTH CALLERS, deliberately: this is used centred in a full
 * screen (Explore's search) and centred over a blocking scrim
 * (`ProgressOverlayIos`), and Apple's blocking HUDs take the large indicator
 * too. A `size` prop here would be a presentation knob on a shared state
 * component, which is the drift `PeopleSheetList` already had reversed on it.
 */
const SPINNER_BOX = 37;

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
            controlSize('large'),
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
