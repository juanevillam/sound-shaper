import { useCallback } from 'react';

import { getAuth } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { blockTrophyCounterSync } from '@/lib/trophyCounters';
import { TimeoutError, withTimeout } from '@/lib/withTimeout';
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
 *     and artwork both, via `media-worker/`. Best-effort.
 *  3. Sweep every Firestore trace (`deleteAccountData`).
 *  4. Revoke the provider's grant — best-effort. Apple: its tokens, with the
 *     reauth's authorizationCode (App Store 5.1.1(v)); proven end to end on
 *     2026-10-16, the app left Settings → Sign in with Apple. Google: no store
 *     asks for it, but without `revokeAccess` the app stayed listed under the
 *     Google Account's third-party access after the account was gone (Juan,
 *     2026-10-16).
 *  5. Delete the Auth user.
 *
 * THE MEDIA USED TO ORPHAN, and this docblock used to say so: destroying it
 * needs a signed call the app didn't have, so the audio and artwork outlived
 * the account while the row's own copy promised otherwise. The worker closes
 * it, and the same one closes the single-sound and cover-replace doors.
 *
 * THE TROPHY TOTALS STOP SYNCING BEFORE THE SWEEP. Their push is a `merge`,
 * so one fired by the player stopping mid-deletion would recreate the user
 * doc the sweep just removed (`lib/trophyCounters`). A failed run lets them
 * sync again; a finished one ends in the sign-out reset.
 *
 * Throws on any non-best-effort failure so the sheet can surface it; a partial
 * run is safe to retry, since every step no-ops on what is already gone.
 *
 * EVERY NETWORK STEP AFTER THE RE-AUTH HAS A DEADLINE (`STEP_TIMEOUT_MS`).
 * A Firestore delete resolves only on the server's acknowledgement, so with
 * the connection gone after the re-auth the sweep never settled and the
 * blocking overlay stayed up forever, with no way out of it. A timed-out step
 * throws like any other failure — the overlay lifts on the "couldn't delete"
 * snackbar and the person can retry. The deletes it already issued stay
 * queued and land on reconnect, which a retry tolerates by construction.
 */
const STEP_TIMEOUT_MS = 30_000;

const step = <T>(promise: Promise<T>, name: string): Promise<T> =>
  withTimeout(promise, STEP_TIMEOUT_MS, `deleteAccount: ${name} timed out`);

export const useDeleteAccount = () =>
  useCallback(async () => {
    const { appleAuthorizationCode } = await reauthenticateForDeletion();

    blockTrophyCounterSync(true);
    try {
      // Best-effort on its own; the deadline only stops it holding the rest.
      await step(cleanupAccountMedia(), 'media').catch(error =>
        recordError(error, 'deleteAccount.cleanupMedia'),
      );
      await step(deleteAccountData(), 'sweep');
    } catch (error) {
      // A TIMED-OUT sweep is still queued and will land on reconnect, so the
      // totals stay blocked — a `merge` behind it would recreate the user doc.
      // Any other failure wrote nothing more, and they sync again.
      // (A deadline is reported here: `reported` inside the sweep never sees
      // it, since the work it wraps has not failed — it just has not finished.)
      if (error instanceof TimeoutError)
        recordError(error, 'deleteAccount.sweep');
      else blockTrophyCounterSync(false);
      throw error;
    }

    if (appleAuthorizationCode)
      try {
        await step(getAuth().revokeToken(appleAuthorizationCode), 'revoke');
      } catch (error) {
        recordError(error, 'deleteAccount.revokeAppleTokens');
      }
    else
      try {
        // The reauth just signed Google in again, so its grant is live here.
        await step(GoogleSignin.revokeAccess(), 'revoke');
      } catch (error) {
        recordError(error, 'deleteAccount.revokeGoogleAccess');
      }

    await step(deleteAuthAccount(), 'auth').catch(error => {
      if (error instanceof TimeoutError)
        recordError(error, 'deleteAccount.auth');
      throw error;
    });
  }, []);
