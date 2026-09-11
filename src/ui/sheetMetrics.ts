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

/**
 * WHERE A FULL-HEIGHT SHEET'S TOP EDGE STOPS, below the status-bar inset.
 *
 * A BOTTOM SHEET THAT REACHES THE SCREEN'S EDGE HAS STOPPED BEING A SHEET —
 * its corners curve against nothing, no scrim shows above it, and the status
 * bar sits directly on its surface. That is what `fillMaxHeight()` gives you
 * here: @expo/ui 57's `ModalBottomSheetView.kt` names no window insets, so a
 * content column asking for the full height takes the SCREEN, and Sound
 * Shaper's clips and shape sheets both band-scanned with their top edge at
 * 0.00dp on a Galaxy A54 (Juan, 2026-09-10 — the open call this closes).
 *
 * THE NUMBER IS ONE UI'S OWN, MEASURED. The system share sheet, dragged to
 * full height on the same device, puts its top edge at 43.73dp against a
 * 34dp status inset — 9.73 past it, i.e. this 10. Sound Shaper's RN clip
 * editor had independently picked 12 and rendered 45.87, which is why the
 * two families looked related and the Compose ones looked wrong: the odd one
 * out was the pair that filled the screen, not the one that stopped.
 *
 * `composeSheetBodyHeight` is the lever, because the SHEET is sized by its
 * CONTENT: there is no inset prop to set, so a full-height column asks for
 * this height instead of `fillMaxHeight()`. A content-sized sheet (the sound
 * editor) needs nothing — it is already shorter than this.
 *
 * IT IS THE BODY'S HEIGHT, NOT THE SHEET'S, and the difference is the whole
 * reason to have a function rather than a subtraction at each call site: the
 * drag handle is a SIBLING of the body column, so a body asking for the
 * sheet's full height makes the sheet 48dp taller than the screen and Compose
 * clamps it straight back to full-bleed — failing in a way that looks exactly
 * like not having tried. Measured on the A54: window 832, inset 33.78, so the
 * body is 740.22 and the sheet lands on 43.73 with the handle on top.
 *
 * ORDER MATTERS AT THE CALL SITE TOO. Compose applies modifiers outside-in,
 * so `padding(P).height(H)` measures H + P: state the height FIRST and the
 * sheet's nav-bar padding lands inside it. Stated second it added 64 here and
 * clamped the sheet the same way.
 */
export const COMPOSE_SHEET_TOP_GAP = 10;

/**
 * M3's drag-handle box, reserved above every Compose sheet's body — the
 * geometry lives here rather than in `SheetDragHandle` because this module
 * has to subtract it and cannot import a Compose component.
 */
export const COMPOSE_SHEET_HANDLE_BOX = 48;

export const composeSheetBodyHeight = (
  windowHeight: number,
  insetTop: number,
): number =>
  windowHeight - insetTop - COMPOSE_SHEET_TOP_GAP - COMPOSE_SHEET_HANDLE_BOX;

/**
 * HOW FAR IN A COMPOSE SHEET'S CONTENT STARTS FROM ITS SIDE EDGES.
 *
 * M3's own bottom-sheet content inset, and what most of Topper's sheets
 * already use. Sound Shaper's three disagreed — 16 in the sound editor, 24 in
 * Clips and Shape — so two sheets a tap apart in one player started their
 * text at different places, measured 18.13dp against 25.60dp of ink on the
 * A54.
 *
 * A CENTRED-HERO SHEET IS THE EXCEPTION AND STATES ITS OWN. `TrophyDetailSheet`
 * and Topper's `ItemDetailSheet` / `CreatorInfoSheet` stand one centred column
 * rather than rows, and 24 is right there; the constant is for sheets holding
 * LIST ROWS OR A FORM, which is what "content inset" means in the spec.
 */
export const COMPOSE_SHEET_GUTTER = 16;

/**
 * A COMPOSE SHEET'S HEADER ROW — the Android counterpart of the two iOS sheet
 * terms above (`SHEET_CONTENT_TOP`, `SHEET_TITLE_TO_CONTENT`): one geometry
 * for where EVERY sheet's first content starts, whether or not the sheet has
 * a title.
 *
 * The anatomy every Compose sheet here shares is `SheetDragHandle` (M3's
 * 48dp box) → a header row → content. The header row is `SheetBar`, and it
 * is `COMPOSE_SHEET_HEADER_HEIGHT` tall whether it carries a commit pill (the
 * editors — a Material `Button` is 40) or only a title (the follow lists,
 * comments), so a title's ink sits on the same line in both. The first
 * content BOX — a field, a grouped card, a list row's padding box — starts
 * `COMPOSE_SHEET_HEADER_TO_CONTENT` under that row; a headerless hero sheet
 * (an item's read sheet, the creator badge) takes the same gap under the
 * handle, the way every iOS sheet takes 84 whether its bar has a title or not.
 *
 * Before these existed the family had drifted to four answers for one job
 * (editors 16 by way of their form gap, follow lists 12, comments 8, the hero
 * sheets 8), which is exactly the per-sheet wobble the iOS 84 was
 * standardised to kill (Juan, 2026-09-05: standardise the top spacing of
 * every screen and sheet the way iOS does).
 */
export const COMPOSE_SHEET_HEADER_HEIGHT = 40;
export const COMPOSE_SHEET_HEADER_TO_CONTENT = 16;

/**
 * THE TRAILING PADDING THAT LANDS A BAR GLYPH ON THE GUTTER.
 *
 * An icon button is a 24dp glyph centred in a 48dp touch box, so aligning the
 * BOX to the gutter pushes the glyph 12dp inboard of every label under it.
 * `COMPOSE_SHEET_GUTTER − 12` is what puts the glyph itself on the margin,
 * which is the same arithmetic Sound Shaper's home app bar does by hand
 * (`paddingRight: 4` under a 16 leading inset).
 */
export const COMPOSE_SHEET_GLYPH_INSET = COMPOSE_SHEET_GUTTER - 12;
