/**
 * WHERE A SHEET'S CONTENT STARTS — one geometry, for every sheet.
 *
 * These two numbers are APPLE'S, band-scanned out of Settings on iPhone 17 /
 * iOS 26.5, not taste. They were first measured for Topper's account family
 * and moved into the shared kit when the editors — built on `SheetFormIos` —
 * were found sitting below the same standard for the same reason.
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
 * Seven levers were measured (on Topper's `PeopleSheetListIos`) and six are
 * wrong; the short version is that moving the SwiftUI frame inside the Host
 * leaves RNScreens' content inset describing the old layout, so the scroller
 * gains 21pt of empty travel. Moving the hosting VIEW makes UIKit recompute
 * with it. The editors' `Form`, which is NOT the RNScreens scroll root, takes
 * it the same way — off its Host (`SheetFormBodyIos`); negative padding on the
 * `Form` itself was measured to be a no-op. A full-height titled sheet takes
 * `SHEET_FIRST_CARD_MARGIN` instead (below).
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
 * THE TOP MARGIN A HEADERLESS FIRST CARD TAKES IN A FULL-HEIGHT FORM SHEET —
 * as `listSectionMargins({ edges: 'top' })` on that first `Section`, which
 * REPLACES the reserved empty-header margin rather than adding to it (1:1
 * slope: 14 → 80.00, 18 → 84.00, band-scanned on the Settings banner).
 *
 * This is the lever that leaves the `Form` where UIKit put it. The other one —
 * pulling the hosting view up by `SHEET_EMPTY_HEADER_SLOT` — lands the card on
 * the same 84, but slides the top of the `Form` under the sheet's bar, and
 * UIKit reads that as content scrolled under it: the bar draws its hard
 * scroll-edge band and a separator at rest, before anything has moved. Booker's
 * editors (a sibling app) shipped that band (Juan, 2026-10-10: New Highlight "no tiene el
 * padding top correcto"), while Settings, on this margin, never had one.
 */
export const SHEET_FIRST_CARD_MARGIN = 18;

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

/**
 * HOW FAR IN A COMPOSE SHEET'S CONTENT STARTS FROM ITS SIDE EDGES.
 *
 * M3's own bottom-sheet content inset. This app's three sheets disagreed — 16 in the sound editor, 24 in
 * Clips and Shape — so two sheets a tap apart in one player started their
 * text at different places, measured 18.13dp against 25.60dp of ink on the
 * A54.
 *
 * A CENTRED-HERO SHEET IS THE EXCEPTION AND STATES ITS OWN. `TrophyDetailSheet`
 * stands one centred column rather than rows, and 24 is right there; the constant is for sheets holding
 * LIST ROWS OR A FORM, which is what "content inset" means in the spec.
 */
export const COMPOSE_SHEET_GUTTER = 16;

/**
 * A COMPOSE SHEET'S HEADER ROW — the Android counterpart of the iOS sheet
 * term above (`SHEET_CONTENT_TOP`): one geometry
 * for where EVERY sheet's first content starts, whether or not the sheet has
 * a title.
 *
 * The anatomy every Compose sheet here shares is `SheetDragHandle` (M3's
 * 48dp box) → a header row → content. The header row is `SheetBar`, and it
 * is `COMPOSE_SHEET_HEADER_HEIGHT` tall whether it carries a commit pill (the
 * editors — a Material `Button` is 40) or only a title (a list sheet), so a
 * title's ink sits on the same line in both. The first content BOX — a field,
 * a grouped card, a list row's padding box — starts
 * `COMPOSE_SHEET_HEADER_TO_CONTENT` under that row; a headerless hero sheet
 * (`TrophyDetailSheet`) takes the same gap under the handle, the way every iOS sheet takes 84 whether its bar has a title or not.
 *
 * Before these existed the portfolio's sheets had drifted to four answers for
 * one job (editors 16 by way of their form gap, list sheets 12 and 8, the hero
 * sheets 8), which is exactly the per-sheet wobble the iOS 84 was
 * standardised to kill (Juan, 2026-09-05: standardise the top spacing of
 * every screen and sheet the way iOS does).
 */
export const COMPOSE_SHEET_HEADER_HEIGHT = 40;
export const COMPOSE_SHEET_HEADER_TO_CONTENT = 16;
