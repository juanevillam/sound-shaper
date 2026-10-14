/**
 * The portfolio author byline shown on every app's welcome screen. Hardcoded
 * here (not a prop) so the credit stays identical across all apps — the byline
 * is fixed even though each app owns its own name, features, and palette.
 *
 * Plain name, no `@`: the byline credits an author and links to a portfolio
 * site, not a social profile — "by <name>" is what both platforms use for a
 * developer credit (App Store, Play Store), while `@handle` reads as a
 * social-network idiom.
 */
export const AUTHOR_CREDIT = 'by juanevillam';
/** The byline split in two, for platforms that link only the name (iOS renders
 *  the name as a native SwiftUI `Link`, so the "by" stays plain). */
export const AUTHOR_CREDIT_PREFIX = 'by';
export const AUTHOR_NAME = 'juanevillam';
// The portfolio site. Every link the apps open outside themselves is built
// on it: the welcome byline, and each app's legal pages at
// juanevillam.com/{app}/{page} — pages that live in apps/web.
export const AUTHOR_URL = 'https://juanevillam.com';

/** URL-safe app slug ("Sound Shaper" → "sound-shaper") for paths + UTM. */
const appSlug = (appName: string): string =>
  encodeURIComponent(appName.trim().toLowerCase().replace(/\s+/g, '-'));

/**
 * Portfolio-site URL tagged with the app the visit came from, so site
 * analytics can attribute traffic per app (utm_source = app slug).
 */
export const authorUrl = (appName: string): string =>
  `${AUTHOR_URL}/?utm_source=${appSlug(appName)}&utm_medium=welcome_screen`;

export type LegalPage = 'privacy-policy' | 'terms-and-conditions';

/**
 * An app's legal page on the portfolio site
 * (juanevillam.com/{app}/privacy-policy), UTM-tagged the same way as
 * `authorUrl` so site analytics attribute the visit per app — and per entry
 * point via `medium` (welcome disclaimer vs settings row).
 */
export const legalUrl = (
  appName: string,
  page: LegalPage,
  medium: string = 'welcome_screen',
): string => {
  const slug = appSlug(appName);

  return `${AUTHOR_URL}/${slug}/${page}?utm_source=${slug}&utm_medium=${medium}`;
};
