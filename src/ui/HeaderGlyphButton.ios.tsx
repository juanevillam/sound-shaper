import { StyleSheet, View } from 'react-native';

import { Image, type ImageProps } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  contentShape,
  disabled as disabledModifier,
  frame,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useAppTheme, withAlpha } from '@portfolio/core';

import { SwiftUIHost } from './SwiftUIHost';

/**
 * A single SF Symbol bar-button item, shared by every portfolio app's iOS
 * navigation bars. `Image` exposes `onPress` directly, so no `Button` wrapper
 * is needed.
 *
 * It lives here rather than per app because the two apps had already drifted:
 * the starter's glyphs were label-coloured at 24/20pt while Topper's were
 * accent-tinted at 22pt. The geometry and the colour rule are the shared part;
 * each app keeps a thin named adapter (`HeaderSettingsButton`,
 * `HeaderCloseButton`) that supplies its own route and its own translation.
 *
 * LABEL-COLOURED, never accent-tinted — and this reversed on iOS 26. The older
 * rule claimed Apple tints every interactive bar element; both Photos' select
 * and Files' overflow were re-measured on iOS 26.5 and are WHITE (band-scanning
 * either nav bar returns ZERO blue pixels and thousands of white ones). The
 * Liquid Glass capsule is now what marks a bar item tappable, so the glyph goes
 * back to the content colour and the accent is reserved for SELECTION —
 * Photos' active tab is the only blue thing on screen.
 *
 * Android is the opposite by design — Material app-bar icons are onSurface and
 * the ripple carries the affordance, which lands in the same place for a
 * different reason.
 */

/** Standard bar glyph: sized against the 17pt inline title beside it. */
export const HEADER_GLYPH_SIZE = 24;

/**
 * THE TAP TARGET — the capsule, not the glyph.
 *
 * MEASURED off Photos' own bar (iPhone 17 / iOS 26.5, band-scanned on the
 * account button's grey fill): 43.0 × 43.0, with 17.0pt of person glyph inside
 * it. So Apple spends roughly 40% of the capsule on ink and the rest on
 * reachability.
 *
 * We spent none of it. `Image` carries `onPress` directly, and a bare SwiftUI
 * `Image` hit-tests its OWN frame — so the target was the glyph's ink, 19.33pt
 * for `plus` and 24.0 for `person.crop.circle`, both far under Apple's 44pt
 * minimum. The glass capsule around them is drawn by UIKit at 44.0 tall, so
 * most of the thing you could see was dead: a tap on the pill 6pt to the left
 * of a glyph did nothing at all.
 *
 * `frame` alone does not fix it — an `Image`'s hit region follows its drawn
 * content, so the empty part of an enlarged frame still falls through.
 * `contentShape` is what claims the whole box.
 *
 * IT IS APPLIED ONLY TO A GROUP OF TWO OR MORE, and that is not a fudge — see
 * `HeaderGlyphGroupIos`. UIKit pads its capsule AROUND whatever the custom view
 * measures, enforcing a 44pt minimum and adding less padding as the content
 * grows (measured: 24pt of content → a 44.0 capsule, 43 → 51.0, 102.67 →
 * 110.67). So on a LONE glyph this box stretches Apple's 44 × 44 circle into a
 * 51.0 × 43.67 pill — trading a correct capsule for 10pt of target — while a
 * lone glyph has no dead space between anything to begin with: its capsule is
 * already at UIKit's minimum and centred on the ink.
 */
const HEADER_TAP_TARGET = 43;

/**
 * A DISABLED GLYPH'S INK — tertiaryLabel, stated here rather than left to
 * SwiftUI.
 *
 * `disabled(true)` alone does nothing to the look of one of these: SwiftUI's
 * disabled treatment applies to CONTROLS, and a bare `Image` with an `onPress`
 * is not one — verified on iPhone 17 / iOS 26.5, where the modifier left the
 * glyph at a full (0,0,0). Dropping `color` so SwiftUI could resolve its own
 * foreground did not help either, for the same reason. So the modifier stays
 * (it is what blocks the interaction) and the ink is set here.
 *
 * tertiaryLabel is the step below the secondaryLabel these tokens already are,
 * and `withAlpha` REPLACES alpha rather than multiplying it — so 0.3 on
 * `onSurfaceMuted` lands on tertiaryLabel exactly, in both appearances. That is
 * the same derivation `DisclosureChevron` documents for the same reason: a mark
 * that is present but not actionable recedes one step.
 */
const DISABLED_INK = (onSurfaceMuted: string) => withAlpha(onSurfaceMuted, 0.3);

/**
 * A sheet's dismiss glyph is the one bar item NOT sized against a title —
 * Apple draws it noticeably larger than an inline title's cap height so it
 * stays an easy target inside the fixed 43.3pt capsule.
 */
export const HEADER_CLOSE_GLYPH_SIZE = 20;

export type HeaderGlyphButtonProps = {
  /**
   * SF Symbol name, e.g. `gearshape` / `xmark` / `plus`. Typed off `Image`'s
   * own symbol union so a misspelling fails at compile time rather than
   * rendering an empty bar slot.
   */
  systemName: NonNullable<ImageProps['systemName']>;
  /** Already-translated accessibility label (the package has no translator). */
  label: string;
  onPress: () => void;
  size?: number;
  /**
   * PRESENT BUT INERT — the glyph keeps its slot, loses its handler, and
   * recedes to `DISABLED_INK`.
   *
   * This exists so a bar item does not COME AND GO with the screen's data.
   * Trash hid its ⋯ (Empty Trash) whenever there was nothing to empty, so the
   * bar carried one glyph while loading and two once rows landed — and a
   * two-item capsule pushes a long title out of the centre, so the whole bar
   * re-flowed on hand-off. Apple's own bars keep their furniture and dim it
   * (Mail's Edit, Photos' Select), which is both the steadier layout and the
   * clearer statement: the action exists, there is just nothing for it to do.
   *
   * The colour is ours to set, not SwiftUI's — see `DISABLED_INK` for why the
   * `disabled` modifier alone leaves the glyph at full strength.
   */
  disabled?: boolean;
};

export function HeaderGlyphButtonIos({
  systemName,
  label,
  onPress,
  size = HEADER_GLYPH_SIZE,
}: HeaderGlyphButtonProps) {
  return (
    <HeaderGlyphGroupIos glyphs={[{ systemName, label, onPress, size }]} />
  );
}

/**
 * The clear space between two adjacent targets, INSIDE one pill.
 *
 * MEASURED OFF A MERGED PILL, which is the correction that matters here. The
 * first version of this constant took Photos' spacing — its ⋯ and account
 * glyphs sit 59.67pt apart centre-to-centre — and that is the wrong container:
 * those are two SEPARATE capsules with 16.67pt of page background between them,
 * and background between capsules is not the same thing as pill between glyphs.
 * Applied inside a single pill it read as a hole, and Juan called it on sight.
 *
 * The right reference is Apple's own merged pill. Calendar carries THREE glyphs
 * in one (list / search / plus), band-scanned on iPhone 17 / iOS 26.5:
 *
 *   ink centres   250.83, 308.67, 363.00   →  c2c 57.83 and 54.33
 *   ink widths    24.00,  21.00,  17.67
 *   ink-edge gap  35.66 and 35.33          →  CONSTANT
 *
 * So the invariant is the EDGE gap (~35.5), not the centre distance — Apple's
 * c2c drifts with how wide each glyph draws. Our slots are a fixed 43 instead,
 * so the gap is solved back from the ink: for `plus` (19.33) beside
 * `person.crop.circle` (24.00), 35.5 + 19.33/2 + 24/2 = 57.16 centre-to-centre,
 * i.e. 57.16 − 43 = 14.16 between the boxes. Our ink-edge gap was 38.67 against
 * Apple's 35.5.
 *
 * Re-measure against a merged pill, never against separate capsules.
 */
const CAPSULE_GAP = 14.16;

/**
 * Two or more bar glyphs, each with its own 43pt tap target, inside the ONE
 * glass capsule UIKit gives a `headerRight`.
 *
 * WE WANT TWO CAPSULES AND CANNOT HAVE THEM. Apple splits an unrelated pair
 * into separate capsules — Photos' ⋯ and account buttons are two 43pt circles —
 * and ours is that pair (create a top, open your account). But `headerRight` is
 * a single custom-view `UIBarButtonItem`, so iOS draws exactly one capsule
 * around whatever it contains; giving each glyph its own `SwiftUIHost` changes
 * nothing, which was verified on device rather than assumed. It is blocked on
 * RNScreens exposing `rightBarButtonItems` (plural) — see
 * `docs/pending-upstream.md`.
 *
 * An earlier version of this comment asserted the opposite — that UIKit groups
 * bar items into one capsule by design and that separate hosts would render two.
 * Both halves were unmeasured and the second is simply false.
 *
 * What the pill costs us is only the visual split; the REACHABILITY half is
 * fixed here and is what actually mattered. The result is also exactly what
 * WhatsApp's own two-button header does, so it is a real design, not a
 * consolation.
 *
 * Needed wherever a screen's own action has to coexist with chrome the
 * navigator supplies. Trash is the case that forced it: it sets its own
 * `headerRight` for the "Empty trash" overflow, and a screen-level `headerRight`
 * REPLACES the one its `Stack.Screen` options provide — so as a sheet it lost
 * the close glyph entirely, and lost it silently again when the overflow was
 * hidden on an empty trash (`undefined` still overrides).
 */
export function HeaderGlyphGroupIos({
  glyphs,
}: {
  glyphs: HeaderGlyphButtonProps[];
}) {
  const { colors } = useAppTheme();
  /**
   * Only a GROUP needs the enlarged target — one glyph already sits centred in
   * UIKit's 44pt minimum capsule, and forcing the box there only stretches that
   * capsule (see `HEADER_TAP_TARGET`). Two or more is where the pill grows, the
   * glyphs stop being centred in it, and reachable-looking dead space appears
   * between them.
   */
  const expand = glyphs.length > 1;

  return (
    <View style={styles.row}>
      {glyphs.map(({ systemName, label, onPress, size, disabled }) => (
        <SwiftUIHost
          key={systemName}
          matchContents
          /**
           * A bar glyph must NOT observe the safe area: a `Host` applies it as
           * FRAME padding, and the KEYBOARD grows it — so with a keyboard up,
           * the glyph slid upward and clipped against the bar capsule (a
           * half-rendered ✕ read as ⌃; caught on device in the editors).
           */
          ignoreSafeArea="all"
          style={expand ? styles.slot : undefined}
        >
          <Image
            systemName={systemName}
            size={size ?? HEADER_GLYPH_SIZE}
            color={
              disabled ? DISABLED_INK(colors.onSurfaceMuted) : colors.onSurface
            }
            // Not merely dimmed: a disabled glyph carries no handler at all, so
            // there is nothing to fire even if a tap gets past `disabled`.
            onPress={disabled ? undefined : onPress}
            modifiers={[
              // The glyph keeps its own size; the BOX around it is the target.
              ...(expand
                ? [
                    frame({
                      width: HEADER_TAP_TARGET,
                      height: HEADER_TAP_TARGET,
                    }),
                    // Without this the enlarged frame is not tappable — an
                    // `Image` hit-tests its drawn content, so the padding
                    // would fall through.
                    contentShape(shapes.rectangle()),
                  ]
                : []),
              ...(disabled ? [disabledModifier(true)] : []),
              accessibilityLabel(label),
            ]}
          />
        </SwiftUIHost>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: CAPSULE_GAP },
  // Each host is sized by the target box inside it. With a single glyph that
  // makes UIKit's capsule the same 43pt square Apple draws; with two it sets
  // the pill's width and keeps the targets from overlapping.
  slot: { height: HEADER_TAP_TARGET, width: HEADER_TAP_TARGET },
});
