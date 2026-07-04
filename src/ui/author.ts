/**
 * The portfolio author byline shown on every app's welcome screen. Hardcoded
 * here (not a prop) so the credit stays identical across all apps — the byline
 * is fixed even though each app owns its own name, features, and palette.
 */
export const AUTHOR_CREDIT = 'by @juanevillam';
export const AUTHOR_URL = 'https://juanevillam.com';

/**
 * Portfolio-site URL tagged with the app the visit came from, so site
 * analytics can attribute traffic per app (utm_source = app slug).
 */
export const authorUrl = (appName: string): string => {
  const source = encodeURIComponent(
    appName.trim().toLowerCase().replace(/\s+/g, '-'),
  );

  return `${AUTHOR_URL}/?utm_source=${source}&utm_medium=welcome_screen`;
};
