/**
 * Canonical Firestore collection / subcollection names — the one cross-module
 * contract in the data layer. Every service imports from here; renaming a
 * collection or adding a subcollection is a single edit that the
 * account-deletion sweep and firestore.rules must then be checked against.
 */
export const USERS_COLLECTION = 'users';
export const SONGS_COLLECTION = 'songs';

// Subcollections of songs/{songId} — wired in their phases (see
// docs/sound-shaper-plan.md §5).
export const REACTIONS_SUBCOLLECTION = 'reactions';
export const COMMENTS_SUBCOLLECTION = 'comments';
export const CLIPS_SUBCOLLECTION = 'clips';
