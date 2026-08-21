import { useCallback } from 'react';

import { getAuth } from '@react-native-firebase/auth';

import {
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
 *  2. Sweep every Firestore trace (`deleteAccountData`).
 *  3. Revoke Apple tokens with the reauth's authorizationCode (App Store
 *     5.1.1(v)) — best-effort, and only when Apple was the provider, which
 *     cannot happen while `APPLE_SIGN_IN_ENABLED` is false.
 *  4. Delete the Auth user.
 *
 * CLOUDINARY MEDIA IS NOT TOUCHED and that is the known, accepted gap: deleting
 * it needs a signed backend call this app deliberately doesn't have (the same
 * gap as deleting a single sound). The audio and artwork orphan.
 *
 * Throws on any non-best-effort failure so the sheet can surface it; a partial
 * run is safe to retry, since every step no-ops on what is already gone.
 */
export const useDeleteAccount = () =>
  useCallback(async () => {
    const { appleAuthorizationCode } = await reauthenticateForDeletion();

    await deleteAccountData();

    if (appleAuthorizationCode)
      try {
        await getAuth().revokeToken(appleAuthorizationCode);
      } catch (error) {
        recordError(error, 'deleteAccount.revokeAppleTokens');
      }

    await deleteAuthAccount();
  }, []);
