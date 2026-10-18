import { FileTooLargeError } from '@/services/cloudinary/upload';
import { BackendRefusal } from '@/services/firebase/functions';

type UploadFailureKey =
  | 'snackbar.sound-too-large'
  | 'snackbar.picture-too-large'
  | 'snackbar.library-full'
  | 'snackbar.daily-limit';

/**
 * The words for an upload that was REFUSED rather than one that failed — a
 * file over the size limit, or a cap the media Worker named. Anything else
 * (the network, Cloudinary, a missing App Check token) returns `fallback`,
 * the caller's own "Couldn't…, try again", because trying again can help
 * there and cannot here.
 */
export const uploadFailureKey = <F extends string>(
  error: unknown,
  fallback: F,
): UploadFailureKey | F => {
  if (error instanceof FileTooLargeError)
    return error.resourceType === 'video'
      ? 'snackbar.sound-too-large'
      : 'snackbar.picture-too-large';

  if (error instanceof BackendRefusal)
    switch (error.reason) {
      case 'library-full':
      case 'storage-full':
        return 'snackbar.library-full';
      case 'daily-limit':
        return 'snackbar.daily-limit';
    }

  return fallback;
};
