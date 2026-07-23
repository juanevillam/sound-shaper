/**
 * Canonical Firestore collection / subcollection names — the one cross-module
 * contract in the data layer. Every service imports from here; renaming a
 * collection or adding a subcollection is a single edit that the
 * account-deletion sweep and firestore.rules must then be checked against.
 */
export const USERS_COLLECTION = 'users';

// Subcollection of users/{uid} — the flat personal library (playlists were
// dropped 2026-07-19: you just upload songs, nothing groups them).
export const SONGS_SUBCOLLECTION = 'songs';

// Subcollection of users/{uid}/songs/{songId} — personal replay bookmarks.
export const CLIPS_SUBCOLLECTION = 'clips';

// Subcollection of users/{uid} — the user's own saved sound shapes (EQ gains
// + speed + keep-pitch). Global, not per-song: shaping carries across songs.
export const SHAPES_SUBCOLLECTION = 'shapes';
