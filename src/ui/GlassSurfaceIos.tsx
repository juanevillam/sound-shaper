import { memo, type ReactNode } from 'react';

import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { HStack, Spacer } from '@expo/ui/swift-ui';
import {
  frame,
  glassEffect,
  shadow as shadowModifier,
} from '@expo/ui/swift-ui/modifiers';

import { IOS_COLORS, useAppTheme, withAlpha } from '@/core';

import { SwiftUIHost } from './SwiftUIHost';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE ONE FLOATING GLASS SURFACE — every app, every shape.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Three surfaces in this portfolio float over content and carry text on
 * Liquid Glass: the shared snackbar, the trophy unlock banner, and Sound
 * Shaper's now-playing banner. They had drifted to THREE different materials —
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

/**
 * THE GAP A FLOATING SURFACE KEEPS — from the safe area it hangs off, and from
 * any other floating surface it has to clear. One number for both, because they
 * are one question: how far this family of surfaces stands off whatever bounds
 * it.
 *
 * SYMMETRY IS THE POINT. The trophy banner drops from the top and the
 * now-playing banner sits at the bottom, and they are the same object seen at
 * opposite ends of the screen — so `top safe area + GAP` and
 * `bottom safe area + GAP`. They were 18 and 12: the 12 is Sound Shaper's,
 * chosen deliberately and defended on sight against being aligned to Topper's
 * tab bar; the 18 was "a little breathing room below the status bar", which is
 * not a reason. The measured decision wins.
 *
 * The snackbar then clears the app's own bottom chrome by this same gap rather
 * than by a number per app — see `iosBottomInset` on `SnackbarProvider`.
 *
 * ANDROID KEEPS ITS OWN SPACING, and the reason is Material rather than the
 * schedule. This used to read "both apps are frozen there" — a statement about
 * when Android would be worked on, wearing the clothes of a design decision,
 * and stale since the freeze lifted on 2026-08-29. The argument that survives
 * it is the second half: M3 specifies its own snackbar and banner insets, and
 * this constant is the iOS floating-glass family's gap. Android has no
 * floating-glass family to be a member of.
 */
export const FLOATING_EDGE_GAP = 12;

/**
 * THE CORNER a floating surface takes — the toast capsule aside, which is a
 * capsule by shape rather than by radius.
 *
 * Deliberately TIGHTER than the grouped-list radius: at these heights 26 reads
 * as a capsule, and a capsule reads as a widget from somewhere else. Apple's
 * floating accessory views take a continuous corner in the low twenties (22 is
 * the iPhone widget corner); Material's floating surfaces take the large shape
 * step.
 *
 * The two do NOT scale together if the surface's size changes: iOS corners are
 * a continuous quantity and can follow it, while Material's shape scale is
 * DISCRETE (4/8/12/16/28) — stepping Android off 16 would leave the system for
 * the sake of a proportion.
 *
 * It lived in Sound Shaper's `styles/shape` while the now-playing banner was
 * the only thing that floated. The trophy banner was drawing `TILE_RADIUS`
 * (26) — a CARD's corner on a floating surface, and the only one of the three
 * not at 22 — so the term moved here the day a second and third surface needed
 * it.
 */
export const FLOATING_RADIUS = Platform.select({
  ios: 22,
  default: 16,
}) as number;

/**
 * The gap between a floating surface's title and the supporting line under it.
 * 1pt is a hairline crack rather than a relationship; 2 is the same
 * title→supporting step the iOS sheets use. The trophy banner stood 1 and the
 * now-playing banner 2, for no reason either could name.
 */
export const FLOATING_COPY_GAP = 2;

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
  /**
   * SwiftUI shadow, for a surface that has to cast its own — a glass layer
   * standing in for a card's background leaves the RN shell transparent, and an
   * RN `shadow*` traces the view's own alpha, so a transparent shell casts
   * nothing.
   */
  shadow?: { color: string; radius: number; y: number };
  /**
   * Extra room around the Host so a SwiftUI shadow is not clipped by the
   * hosting view's bounds. Pass at least the shadow's radius.
   */
  shadowRoom?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * THE APPEARANCE OF WHAT THE GLASS SITS ON, when that is not the app's.
   *
   * The material and its floor both follow the app by default, which is right
   * everywhere the app draws the ground. Booker's reader is the exception: its
   * page carries a theme of its own, so a dark app reading on a Light, Sepia or
   * Paper page put dark discs — dark floor, dark-adapted glass — under the
   * page's dark ink, and the glyphs all but vanished (Juan, 2026-10-10). Pass
   * the PAGE's appearance and the surface follows it instead.
   */
  colorScheme?: 'light' | 'dark';
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
  shadow,
  shadowRoom = 0,
  style,
  colorScheme,
}: GlassSurfaceIosProps) {
  const { colors: appColors } = useAppTheme();
  const colors = colorScheme ? IOS_COLORS[colorScheme] : appColors;
  const radius = shape === 'capsule' ? height / 2 : cornerRadius;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
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
        {...(colorScheme ? { colorScheme } : null)}
        style={{
          height: height + shadowRoom * 2,
          left: -shadowRoom,
          position: 'absolute',
          top: -shadowRoom,
          width: width + shadowRoom * 2,
        }}
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
            ...(shadow ? [shadowModifier(shadow)] : []),
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
 * `underlay` and the banner becomes a clear shell over this, shadow included.
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
 * The corner defaults to the family's, which is also what the banner's own
 * shell takes — the two MUST agree, and they drifted apart once already when
 * the apps passed their card radius here and to the shell separately.
 *
 * Call it at module scope — the identity has to be stable across renders.
 */
export const makeGlassUnderlay =
  (cornerRadius: number = FLOATING_RADIUS) =>
  ({ width, height }: { width: number; height: number }): ReactNode => (
    <GlassSurfaceIos
      width={width}
      height={height}
      cornerRadius={cornerRadius}
    />
  );
