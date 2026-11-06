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
