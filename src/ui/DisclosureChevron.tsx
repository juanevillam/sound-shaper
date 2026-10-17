import Svg, { Path } from 'react-native-svg';

import { withAlpha } from '@/core';

/**
 * iOS's disclosure chevron, for a custom row whose tap PUSHES a screen. A
 * native `Form` / `List` row draws its own, so every grouped-list surface that
 * gets one from the OS must NOT use this.
 *
 * iOS has TWO of these and they genuinely differ — both measured on device
 * (2026-08-07, iPhone 17 / iOS 26.5, dark):
 *
 *   Photos' "Pinned ›" header    9.33 × 15.67pt, stroke ~3.06, secondaryLabel,
 *                                8.67pt after the title's ink, centred on its CAP
 *   Settings' cell chevron       7.00 × 12.00pt, stroke ~2.0,  tertiaryLabel,
 *                                pinned ~18pt inside the container's edge
 *
 * A header chevron is one shade BRIGHTER than a cell's and hugs its label; a
 * cell's is pinned at the trailing margin and recedes. It is NOT simply bigger:
 * Photos' reads heavier only because its title is BOLD Title 2 where a Settings
 * row is regular Body — the glyph tracks its label's WEIGHT, so the two are not
 * comparable on size.
 *
 * This draws the CELL one, in the geometry Settings uses beside a regular
 * Body 17 label: 7 × 12pt, stroke 2, tertiaryLabel.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHY SVG, AND WHY THIS IS THE VERSION THAT SURVIVED
 *
 * Both apps had one of these and they disagreed on the stroke. Topper drew the
 * arms as two ROTATED RN VIEWS and could not reach the reference: a rotated
 * view is a rasterised rectangle that picks up a pixel of anti-aliasing along
 * each long edge, and at 3× the arm's measurable run quantises to whole pixels
 * — 1.8 / 1.9 / 1.95 all rendered 8px (1.89pt) while 2.0 jumped to 10px
 * (2.36pt), either side of the reference's 9px (2.12pt). It took the lighter
 * one deliberately and left a note: "Re-derive if the arms ever stop being
 * rotated views."
 *
 * They have. A stroked SVG path goes through the same kind of path rasteriser
 * an SF Symbol does, and measured at matched coverage (a 35.5% relative
 * threshold, so both captures are read the same way) it renders 2.12pt — the
 * reference exactly, in BOTH appearances (iPhone 17 / iOS 26.5, 2026-08-28:
 * 7.00 × 12.00pt, stroke 2.12, dark and light). So the shared term is the SVG
 * one and Topper's rasterisation compromise is retired rather than copied.
 *
 * `react-native-svg` is already a peer dependency of this package and a direct
 * dependency of all three apps, so this costs nothing to host here. The
 * alternatives both still cost more than the glyph is worth: `AppIcon.ios`
 * renders a real `chevron.right` but only inside a SwiftUI `Host`, and a Host
 * per row is the measured perf ceiling these lists already avoid; `expo-symbols`
 * is not a dependency of every app that needs this.
 */

/** Settings' cell chevron, measured beside a regular 17pt label. */
const INK_WIDTH = 7;
const INK_HEIGHT = 12;
const STROKE = 2;

/**
 * tertiaryLabel. Both `onSurfaceMuted` tokens ARE the secondaryLabel pair, and
 * `withAlpha` REPLACES alpha rather than multiplying it, so 0.3 lands on
 * tertiaryLabel exactly, in both appearances. (A header disclosure would keep
 * secondaryLabel's 0.6 — brighter, because it sits against its label.)
 */
const TERTIARY_LABEL_ALPHA = 0.3;

export function DisclosureChevron({
  /** The row's muted ink — `colors.onSurfaceMuted`. Stepped to tertiaryLabel
   *  here, so callers pass the role rather than a pre-faded colour. */
  color,
}: {
  color: string;
}) {
  return (
    <Svg width={INK_WIDTH} height={INK_HEIGHT} viewBox="0 0 7 12" fill="none">
      {/* The centreline is inset by STROKE / 2 all round, because round caps
          push the ink half a stroke past each end in every direction. */}
      <Path
        d="M1 1L6 6L1 11"
        stroke={withAlpha(color, TERTIARY_LABEL_ALPHA)}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
