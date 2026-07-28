import { type PickedSongFile } from '@/components/songs/EditSongSheet';

// One-shot handoff for the create-song flow on iOS: the picked file (with its
// parsed ID3 tags and possibly a base64 cover) is far too large for a route
// param, so home stashes it here and pushes `/edit-sound`, which takes it on
// mount. Same idiom as Topper's art-transition handoff — module state, not a
// zustand store, because exactly one consumer takes it exactly once.

let pending: PickedSongFile | null = null;

export const stashPendingUpload = (file: PickedSongFile): void => {
  pending = file;
};

/** Returns the stashed file and clears it (a sheet re-mount must not re-use). */
export const takePendingUpload = (): PickedSongFile | null => {
  const file = pending;
  pending = null;
  return file;
};
