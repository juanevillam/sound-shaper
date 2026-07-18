/**
 * Canonical Firestore collection / subcollection names — the one cross-module
 * contract in the data layer. Every service imports from here; renaming a
 * collection or adding a subcollection is a single edit that the
 * account-deletion sweep and firestore.rules must then be checked against.
 */
export const USERS_COLLECTION = 'users';
export const USERNAMES_COLLECTION = 'usernames';
export const PLAYLISTS_COLLECTION = 'playlists';

// Subcollection of playlists/{playlistId}.
export const SONGS_SUBCOLLECTION = 'songs';

// Future phases (social + clips — see docs/sound-shaper-plan.md).
export const REACTIONS_SUBCOLLECTION = 'reactions';
export const COMMENTS_SUBCOLLECTION = 'comments';
export const CLIPS_SUBCOLLECTION = 'clips';
