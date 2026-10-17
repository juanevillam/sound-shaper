import { thumbUrl } from '@/services/cloudinary/thumbUrl';
import { MEDIA_PICKER_SIZE } from '@/ui';

/** The account banner's art: iOS draws it at 55pt, the largest it appears. */
export const PROFILE_PHOTO_DISPLAY = 55;

/**
 * The exact urls the two places a person's photo shows will request — the
 * Settings banner and the Account sheet's photo slot. Shared so a warm-up
 * fetches the same variants the views do, never a near miss.
 */
export const profilePhotoDisplayUrls = (url: string): string[] => [
  thumbUrl(url, PROFILE_PHOTO_DISPLAY),
  thumbUrl(url, MEDIA_PICKER_SIZE),
];
