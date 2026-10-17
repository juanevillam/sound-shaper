import { memo, type ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';

import { HStack, Spacer } from '@expo/ui/swift-ui';
import { frame, glassEffect } from '@expo/ui/swift-ui/modifiers';

import { useAppTheme, withAlpha } from '@/core';

import { FLOATING_RADIUS } from './floating';
import { SwiftUIHost } from './SwiftUIHost';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE ONE FLOATING GLASS SURFACE — every shape.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Three surfaces float over content and carry text on Liquid Glass: the
 * snackbar, the trophy unlock banner, and the now-playing banner. They had drifted to THREE different materials —
 * the snackbar and Topper's trophy banner were pure `glassEffect` with nothing
 * behind them, Sound Shaper's banner had a hand-rolled tonal floor, and Sound
 * Shaper's trophy banner was not glass at all but a solid card. Same idea, four
 * answers, and the two pure-glass ones were the two with reported readability
 * problems.
 *
 * So the material is one term now, and it is `GLASS_FLOOR` below.
 */

/**
 * A TONAL FLOOR UNDER THE GLASS — the app's own surface colour at partial
 * strength, so it darkens the surface in dark mode and lightens it in light
 * mode without either being special-cased.
 *
 * THE NUMBER IS APPLE'S, AND IT WAS MEASURED. Band-scanned on iPhone 17 /
 * iOS 26.5, both appearances, the floor swept 0 → 0.45 under a backdrop driven
 * from black to pure white.
 *
 * LIGHT MODE IS THE SAFE CASE, which is the opposite of what this was first
 * written from: black text on this material clears 10.6:1 with no floor at all,
 * over the darkest content possible. Dark mode is the case that needs it — over
 * a pure-white backdrop a white title measures 4.71:1 unfloored, which is
 * barely WCAG AA and is exactly where the "I looked the other way" reading
 * problems came from.
 *
 *   floor   worst-case white-on-glass contrast (dark, white backdrop)
 *   0.00    4.71    0.25    5.43    0.45    6.15
 *
 * 0.25 is where Apple sits. Its own floating glass over photography — the date
 * pill in Photos' viewer, over foliage, iOS 26.5 — puts a white label on
 * 5.41:1 at the brightest patch of its own fill. So 0.25 lands these surfaces
 * on the system's own outcome. 0.45 was tried and is over-corrected: it buys
 * contrast Apple does not ask for and pays in show-through, which is the whole
 * reason any of this is glass. Measured as the surface's L* spread as a
 * fraction of the content's beneath it: 40–42% unfloored, 32–34% at 0.25,
 * 28–29% at 0.45.
 *
 * Considered and rejected: `glassEffect`'s own `tint`, which reaches the same
 * place (`#2C2C2E40` measured 5.37:1) through Apple's API rather than a painted
 * layer. It cannot serve Sound Shaper's banner, whose floor is the same layer
 * that interpolates to the opaque player background as the banner expands — and
 * a term that only two of the three surfaces could use would not be one term.
 */
export const GLASS_FLOOR = 0.25;

/** The floor as a colour. Pass `colors.surfaceContainer`. */
export const glassFloorColor = (surfaceContainer: string) =>
  withAlpha(surfaceContainer, GLASS_FLOOR);

export type GlassSurfaceIosProps = {
  /** Measured content box. The floor and the material both take exactly this. */
  width: number;
  height: number;
  /** `capsule` derives its own radius from the height, like SwiftUI's. */
  shape?: 'capsule' | 'roundedRectangle';
  /** Ignored for `capsule`. */
  cornerRadius?: number;
};

/**
 * The floor + the material, sized to a measured box. Purely decorative and
 * always pointer-transparent: every caller draws its own content in React
 * Native above this, and a Host that swallowed touches would eat it.
 *
 * The floor goes UNDER the material rather than over it. Both composite to the
 * same fill (measured on Sound Shaper's banner, which does it both ways for
 * layering reasons: idle #2B2A28 floor-under vs loaded #2D2C2A floor-over, L*
 * sd 3.32 vs 3.26), so this takes the one that is physically what it says.
 */
/**
 * MEMOIZED, AND THAT IS PART OF THE MATERIAL'S CONTRACT. iOS 26's `regular`
 * glass is ADAPTIVE — it picks a light or dark treatment from the backdrop
 * under it — and re-sending the `glassEffect` modifier makes it PICK AGAIN.
 * Every parent re-render rebuilt the modifier array, so a play/pause press or
 * a seek under the console's footer re-applied the effect and the glass
 * sometimes flipped to its other treatment mid-interaction (Juan, 2026-08-27,
 * plainest in dark). The surface is purely decorative and its props are
 * primitives at every call site, so a memo simply stops the re-send — the
 * native effect keeps the treatment it mounted with.
 */
export const GlassSurfaceIos = memo(function GlassSurfaceIos({
  width,
  height,
  shape = 'roundedRectangle',
  cornerRadius = 0,
}: GlassSurfaceIosProps) {
  const { colors } = useAppTheme();
  const radius = shape === 'capsule' ? height / 2 : cornerRadius;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.floor,
          {
            backgroundColor: glassFloorColor(colors.surfaceContainer),
            borderRadius: radius,
            height,
            width,
          },
        ]}
      />
      {/* `ignoreSafeArea` must be set on the HOST (hosting-controller level):
          a Host insets its SwiftUI content for the safe area by default, which
          shifts the material off the box it is supposed to fill. A banner that
          mounts mid-entrance inside the top safe area bakes that transient
          inset into the SwiftUI layout — the in-tree `ignoreSafeArea()`
          modifier cannot reach it (pixel-verified no-op). */}
      <SwiftUIHost
        ignoreSafeArea="all"
        style={{ height, left: 0, position: 'absolute', top: 0, width }}
      >
        <HStack
          modifiers={[
            // Sized BEFORE the effect, or the material hugs its (empty)
            // content instead of filling the box.
            frame({ height, width }),
            glassEffect({
              glass: { variant: 'regular' },
              shape,
              ...(shape === 'roundedRectangle' ? { cornerRadius } : null),
            }),
          ]}
        >
          <Spacer />
        </HStack>
      </SwiftUIHost>
    </View>
  );
});

const styles = StyleSheet.create({
  floor: { left: 0, position: 'absolute', top: 0 },
});

/**
 * The trophy banner's injected surface — hand it to `TrophyOverlay`'s
 * `underlay` and the banner becomes a clear shell over this.
 *
 * Both apps call it, so the two unlock banners are one surface rather than one
 * app's glass beside another's solid card (which is what they were).
 *
 * NO SHADOW, because the material is the edge. It DID cast one, and the
 * measurement behind that was sound at the time: band-scanned against a light
 * page, the glass interior matched the page to within ±2/255, so the banner had
 * no boundary at all and the only thing separating it from the screen was the
 * ink of its own text.
 *
 * That measurement was taken with NO TONAL FLOOR under the glass. `GLASS_FLOOR`
 * gives the interior a boundary of its own, so the shadow is now stacked on top
 * of something already doing the job — which is the identical finding Sound
 * Shaper's now-playing banner reached when it deleted ITS drop shadow (by the
 * time the shadow was faint enough to approach UIKit's it contributed nothing,
 * because the glass alone already darkened the gutter by twice UIKit's whole
 * treatment).
 *
 * So all three floating surfaces take the material's own edge and nothing else:
 * no shadow here, no hairline on the now-playing banner, nothing on the
 * snackbar. Re-measure before adding any of it back.
 *
 * The corner is the family's, which is also what the banner's own shell
 * takes — the two MUST agree, and they drifted apart once already when the
 * apps passed their card radius here and to the shell separately.
 *
 * Call it at module scope — the identity has to be stable across renders.
 */
export const makeGlassUnderlay =
  () =>
  ({ width, height }: { width: number; height: number }): ReactNode => (
    <GlassSurfaceIos
      width={width}
      height={height}
      cornerRadius={FLOATING_RADIUS}
    />
  );
