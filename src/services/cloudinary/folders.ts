/**
 * Cloudinary folder layout for Sound Shaper.
 *
 * EVERY ASSET LIVES UNDER A PER-USER PREFIX so the media worker
 * (services/media-worker, the `sound-shaper` environment) can prove ownership
 * by path alone — it deletes only within `sound-shaper/{uid}/`, and so needs
 * no database access. Keep MEDIA_ROOT in sync with that environment's
 * `MEDIA_FOLDER_ROOT` var.
 *
 * IT WAS FLAT (`sound-shaper/`) UNTIL 2026-09-12, and that was the blocker
 * rather than the missing worker: with no `{uid}` segment there is no prefix
 * to delete by, and the worker's whole security model has nothing to attach
 * to. The alternative — sending a list of public ids read from Firestore —
 * was rejected because the worker holds no admin credentials and so could not
 * verify that an id a caller names belongs to that caller; it would be
 * destroying arbitrary assets on an authenticated request.
 *
 * Assets uploaded before the move are migrated once by
 * `scripts/migrate-sound-shaper-media.py`.
 *
 * ONE FOLDER FOR BOTH KINDS, audio and artwork together. Cloudinary keys its
 * Admin API by RESOURCE TYPE, not by folder — an mp3 is a `video` there and a
 * cover is an `image` — so the two are already distinguishable without
 * splitting the path, and a single prefix is one sweep the worker cannot
 * half-forget.
 */
export const MEDIA_ROOT = 'sound-shaper';

export const userMediaFolder = (uid: string): string => `${MEDIA_ROOT}/${uid}`;
