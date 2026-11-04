// Platform-free, so the web app's uploader turns away the same files.

/**
 * The per-file half of the caps. A signature cannot carry a size, so the app
 * is where an honest upload is turned away; the Worker bounds a dishonest one
 * by the library's total. 20 MB is ~3.5× the measured average mp3 (5.79 MB),
 * so it refuses a long mix or a lossless rip, not a song.
 */
export const MAX_UPLOAD_BYTES = {
  image: 5_000_000,
  video: 20_000_000,
} as const;
