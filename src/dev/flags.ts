/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  DEV SWITCH — this app's, flipped by hand, never read in a release build.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ONE switch, and there will not be a second. THERE ARE NO FIXTURES IN THIS
 * REPO and none are to be added: the lab pins the BRANCH a screen renders, not
 * the data underneath it, so a skeleton, an empty state or an error is exactly
 * as reachable against a live Firestore query as it would be against invented
 * rows — while a screen judged against invented sounds, with no artwork and
 * names chosen to fit, is not the screen anybody uses.
 *
 * `__DEV__`-gated where it is consumed, so it cannot reach a release build even
 * if left `true` here.
 */

/**
 * Show the state picker, so any screen's UI states can be pinned and compared.
 *
 * It doubles as this app's "a dev is driving" switch: the Delete Account flow
 * refuses to run while it is on (see `dev/deleteAccountGuard`), because that is
 * the one action in the app that cannot be undone or tried twice.
 */
export const STATE_LAB = true;
