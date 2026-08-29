/**
 * WHERE A SHEET'S CONTENT STARTS — one geometry, for every sheet in every app.
 *
 * These two numbers are APPLE'S, band-scanned out of Settings on iPhone 17 /
 * iOS 26.5, not this portfolio's taste. They lived in Topper while only Topper's
 * account family needed them, and moved here when the editors — which are built
 * on `SheetFormIos`, in this package, and are used by Sound Shaper too — were
 * found sitting below the same standard for the same reason.
 */

/**
 * THE EMPTY SECTION-HEADER SLOT a native grouped `List` or `Form` reserves.
 *
 * A grouped container keeps room above its first section for a header whether
 * or not one exists. Settings spends it on the word "General"; a sheet has no
 * header — the bar carries the title — so it sits empty and the band under the
 * title reads as a hole. Settings' first content lands 146.0 from identical
 * anchors against 167.0 with the slot: exactly 21.
 *
 * TAKE IT OFF THE RN WRAPPER where there is one, never off the `List`.
 * `PeopleSheetListIos` names the seven levers that were measured and why six of
 * them are wrong; the short version is that moving the SwiftUI frame inside the
 * Host leaves RNScreens' content inset describing the old layout, so the
 * scroller gains 21pt of empty travel. Moving the hosting VIEW makes UIKit
 * recompute with it. A `Form` that is NOT the RNScreens scroll root — the
 * editors' — takes it as negative padding instead, which is measured, not
 * assumed.
 *
 * IT IS A COMPENSATION, NOT A REMOVAL. `contentMargins` — absent on @expo/ui
 * 57, tracked in docs/pending-upstream.md — is what actually deletes the slot,
 * and on the day it lands this constant and every use of it go.
 */
export const SHEET_EMPTY_HEADER_SLOT = 21;

/**
 * HOW FAR BELOW A SHEET'S OWN TOP EDGE ITS FIRST CONTENT SITS.
 *
 * Settings' 146.0, less a root sheet's top edge at 62.00. MEASURE AGAINST THE
 * SHEET, NEVER THE SCREEN: a sheet pushed over another sheet sits 10pt lower
 * (62.00 → 72.00), so two sheets whose raw screen numbers agree are really 10pt
 * apart.
 *
 * Every bone in a sheet stands at this too, which is why one term serves both.
 */
export const SHEET_CONTENT_TOP = 84;

/**
 * THE GAP BETWEEN A SHEET TITLE'S INK AND ITS FIRST CONTENT — the number to
 * check when a sheet does NOT take the inline UIKit bar.
 *
 * The account family's bar is one object, so pinning `SHEET_CONTENT_TOP` fixes
 * those sheets outright. The editors draw their own header, so their absolute
 * offset can be right for the wrong reason (or wrong for a right one) — this is
 * the invariant that survives a different bar. Band-scanned across the family:
 * account 38.67, trophies 38.33.
 */
export const SHEET_TITLE_TO_CONTENT = 38.5;

/**
 * WHAT A COMPOSE `ModalBottomSheet`'S CONTENT MUST CLEAR AT THE BOTTOM.
 *
 * A Compose bottom sheet's window runs to the SCREEN's bottom edge, not to the
 * top of the system navigation bar, so anything the sheet's last rows draw
 * lands underneath it. With 3-button navigation that is a 48dp band holding
 * Back / Home / Recents.
 *
 * Band-scanned on a Galaxy A54 (Android 16, `navigation_mode=0`): Sound
 * Shaper's Shape sheet at its RESTING half-height detent drew the 4k EQ band's
 * slider from 784.36dp to 818.49dp against a navigation bar starting at
 * 784.00 — the control sat under the system glyphs and could not be dragged.
 * The two content-sized sheets beside it cleared only by their own 16dp
 * padding, i.e. by luck rather than by saying so.
 *
 * Pass `useSafeAreaInsets().bottom` and nothing else. It is a FUNCTION rather
 * than a constant because the inset is the device's, and a gesture-navigation
 * phone reports a much smaller one — hard-coding 48 would open a hole there.
 *
 * IT TAKES NO PER-CALLER GAP, and it used to. Three sheets in one app each
 * declared their own `SHEET_BOTTOM_GAP` — 28, 16 and 16 — for the same job
 * under the same kind of last row, which is the `PRESSED_OPACITY` shape: one
 * idea stated in three files, drifting the moment nobody compares them. The
 * breathing room is a property of a Compose bottom sheet, not of what happens
 * to be at the bottom of one, so it lives here as `COMPOSE_SHEET_BOTTOM_GAP`
 * and every sheet gets it. If one genuinely needs more, that is an argument to
 * have in this file.
 */
export const COMPOSE_SHEET_BOTTOM_GAP = 16;

export const composeSheetBottomPadding = (insetBottom: number): number =>
  insetBottom + COMPOSE_SHEET_BOTTOM_GAP;
