import { type PickedSoundFile } from '@/components/sounds/EditSoundSheet';

// One-shot handoff for the create-sound flow on iOS: the picked file (with its
// parsed ID3 tags and possibly a base64 cover) is far too large for a route
// param, so home stashes it here and pushes `/edit-sound`, which takes it on
// mount. Same idiom as Topper's art-transition handoff — module state, not a
// zustand store, because exactly one consumer takes it exactly once.

let pending: PickedSoundFile | null = null;

export const stashPendingUpload = (file: PickedSoundFile): void => {
  pending = file;
};

/** Returns the stashed file and clears it (a sheet re-mount must not re-use). */
export const takePendingUpload = (): PickedSoundFile | null => {
  const file = pending;
  pending = null;
  return file;
};
