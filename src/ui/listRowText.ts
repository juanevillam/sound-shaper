import { lineLimit, truncationMode } from '@expo/ui/swift-ui/modifiers';

/**
 * A NATIVE LIST ROW'S TEXT IS ONE LINE, TRUNCATED AT THE TAIL — one definition,
 * for every grouped row.
 *
 * Every list row in Contacts, Music, Mail and the App Store is one line.
 * SwiftUI's default is unlimited, which lets a long display name grow a row
 * taller than its neighbours to say nothing extra.
 *
 * IT IS HERE BECAUSE IT WAS WRITTEN OUT FOUR TIMES across the portfolio —
 * Topper's `PersonListRowIos`, `ExploreResultsList.ios` and `TrashListIos`,
 * and (as `ONE_LINE_VALUE`) `FormDisclosureRowIos` — and the fourth copy had already drifted: it used
 * `middle`, so an account fact truncated differently from every other row in
 * the app. Four identical constants are four chances for a fifth to disagree,
 * which is exactly what happened.
 *
 * `tail` IS THE ANSWER, and the cost is known and accepted: a long
 * email loses its domain ("juanestebanvillamemdo…" rather than
 * "juanesteban…@gmail.com"). `middle` reads better for an address in isolation
 * and worse for a screen — the same gesture on two rows of one app should
 * shorten text the same way. If that trade is ever revisited, it is revisited
 * HERE, once, and every row follows.
 */
export const LIST_ROW_ONE_LINE = [lineLimit(1), truncationMode('tail')];
