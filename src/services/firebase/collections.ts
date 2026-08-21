/**
 * Canonical Firestore collection / subcollection names — the one cross-module
 * contract in the data layer. Every service imports from here; renaming a
 * collection or adding a subcollection is a single edit that the
 * account-deletion sweep and firestore.rules must then be checked against.
 */
export const USERS_COLLECTION = 'users';

/**
 * Subcollection of users/{uid} — the flat personal library (playlists were
 * dropped 2026-07-19: you just upload sounds, nothing groups them).
 *
 * THE VALUE STAYS `songs` ON PURPOSE. Everything a person reads says "sound",
 * and so does every identifier in this app now — the library holds whatever
 * MP3 you give it, a ringtone or a meme as readily as a track, and calling
 * those "songs" invites a claim about what the app is for that nobody wants to
 * make. A Firestore path is not read by anyone: renaming it would migrate every
 * existing document, and re-point `firestore.rules` and the account-deletion
 * sweep — the sweep that once silently deleted nothing because of a wrong path
 * that was still a legal one. The word is masked where it is seen; the wire
 * format keeps its name.
 */
export const SOUNDS_SUBCOLLECTION = 'songs';

// Subcollection of users/{uid}/sounds/{soundId} — personal replay bookmarks.
export const CLIPS_SUBCOLLECTION = 'clips';

// Subcollection of users/{uid} — the user's own saved sound shapes (EQ gains
// + speed + keep-pitch). Global, not per-sound: shaping carries across sounds.
export const SHAPES_SUBCOLLECTION = 'shapes';

// Subcollection of users/{uid} — earned trophies, one doc per trophy id
// holding its `achievedAt`, so they survive a reinstall.
export const TROPHIES_SUBCOLLECTION = 'trophies';
