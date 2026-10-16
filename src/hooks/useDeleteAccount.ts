import { useCallback } from 'react';

import { getAuth } from '@react-native-firebase/auth';

import {
  cleanupAccountMedia,
  deleteAccountData,
  deleteAuthAccount,
} from '@/services/firebase/account';
import { recordError } from '@/services/firebase/crashlytics';
import { reauthenticateForDeletion } from '@/services/firebase/reauthForDeletion';

/**
 * The full "Delete Account" pipeline, in an order where nothing irreversible
 * happens until the deletion is guaranteed to complete:
 *
 *  1. RE-AUTHENTICATE the current provider. This must come FIRST: Firebase's
 *     recent-login window is ~5 minutes, so the final auth delete almost always
 *     demands it — and it must never fail AFTER the sweep, which would leave
 *     someone data-swept and still signed in. A dismissed sheet throws here and
 *     aborts with everything intact.
 *
 *     This is also iOS's answer to the friction Android spends on a countdown:
 *     Apple escalates a consequential action by asking who you are, not by
 *     making you wait.
 *  2. Destroy every Cloudinary asset under the caller's own folder — audio
 *     and artwork both, via `services/media-worker`. Best-effort.
 *  3. Sweep every Firestore trace (`deleteAccountData`).
 *  4. Revoke Apple tokens with the reauth's authorizationCode (App Store
 *     5.1.1(v)) — best-effort, and only when Apple was the provider.
 *  5. Delete the Auth user.
 *
 * THE MEDIA USED TO ORPHAN, and this docblock used to say so: destroying it
 * needs a signed call the app didn't have, so the audio and artwork outlived
 * the account while the row's own copy promised otherwise. The worker closes
 * it, and the same one closes the single-sound and cover-replace doors.
 *
 * Throws on any non-best-effort failure so the sheet can surface it; a partial
 * run is safe to retry, since every step no-ops on what is already gone.
 */
export const useDeleteAccount = () =>
  useCallback(async () => {
    const { appleAuthorizationCode } = await reauthenticateForDeletion();

    await cleanupAccountMedia();

    await deleteAccountData();

    if (appleAuthorizationCode)
      try {
        await getAuth().revokeToken(appleAuthorizationCode);
      } catch (error) {
        recordError(error, 'deleteAccount.revokeAppleTokens');
      }

    await deleteAuthAccount();
  }, []);
