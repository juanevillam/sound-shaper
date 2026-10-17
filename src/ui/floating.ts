import { Platform } from 'react-native';

// THE FLOATING FAMILY'S GEOMETRY — the snackbar, the trophy unlock banner and
// the now-playing banner. Platform-neutral on purpose: both platforms' banners
// and the toast read these, so they cannot live in `GlassSurfaceIos.tsx`, which
// is only the iOS material under them.

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
 * than by a number per app — see `SNACKBAR_BOTTOM_CLEARANCE`.
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
 * It lived in the app's own `styles/shape` while the now-playing banner was
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
