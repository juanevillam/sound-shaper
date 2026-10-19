// The ORIGIN, anchored at the start: a substring test would also rewrite a
// URL that merely mentions the host (`https://evil.example/res.cloudinary.com`).
const CLOUDINARY_ORIGIN = 'https://res.cloudinary.com/';
const UPLOAD_SEGMENT = '/image/upload/';

/**
 * Rewrite a stored Cloudinary cover-art URL to a display-sized variant:
 * `w_<2x>,c_limit,q_auto,f_auto` inserted after `/image/upload/`, so a 56px
 * thumbnail doesn't download the full-size embedded cover. Non-Cloudinary and
 * already-transformed URLs (and audio `/video/upload/` URLs) pass through
 * untouched. Mirrors Topper's thumbUrl.
 */
export const thumbUrl = (url: string, displayWidth: number): string => {
  const index = url.indexOf(UPLOAD_SEGMENT);

  if (!url.startsWith(CLOUDINARY_ORIGIN) || index === -1) return url;

  const rest = url.slice(index + UPLOAD_SEGMENT.length);

  if (rest.startsWith('w_') || rest.startsWith('q_')) return url;

  // 2x the layout size for high-density screens.
  const width = Math.min(Math.round(displayWidth * 2), 2048);

  return url.replace(
    UPLOAD_SEGMENT,
    `${UPLOAD_SEGMENT}w_${width},c_limit,q_auto,f_auto/`,
  );
};
