import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
  type FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { pushTrophyCounters } from '@/lib/trophyCounters';
import { reported } from '@/services/firebase/crashlytics';

// The Firebase project's Web OAuth client (the `client_type: 3` entry in
// google-services.json / the Web client auto-created when Google sign-in was
// enabled). Used on BOTH platforms by GoogleSignin.
const WEB_CLIENT_ID =
  '714853847469-8cngsj4f4q97dtsqp4it81g963480900.apps.googleusercontent.com';

/**
 * THE SIGNED-IN USER, OR A THROW — the one copy.
 *
 * Every data path in this app is per-user (`users/{uid}/…`, and now
 * `sound-shaper/{uid}/` on Cloudinary), so nearly every service needs this and
 * three of them had written their own with their own message. A fourth was
 * about to be written for the upload path, which is the point at which the
 * duplicate stops being harmless: the uid under which media is STORED and the
 * uid the media worker derives from the ID token have to be the same value,
 * and one shared accessor is what makes that true by construction.
 *
 * Call sites all run behind the auth gate, so a missing user is a programmer
 * error worth throwing on rather than a state to handle.
 */
export const requireUser = (): FirebaseAuthTypes.User => {
  const user = getAuth().currentUser;

  if (!user) throw new Error('auth: no signed-in user');

  return user;
};

/** The signed-in user's uid — the common case of `requireUser`. */
export const requireUid = (): string => requireUser().uid;

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
};

/**
 * Resolves null when the user dismisses the Google account sheet — a
 * dismissal is a `cancelled` response, not a throw, so `reported` never counts
 * it. Every real failure reaches Crashlytics before the caller's snackbar.
 */
export const signInWithGoogle = reported(
  'auth.signInWithGoogle',
  async (): Promise<FirebaseAuthTypes.UserCredential | null> => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();

    if (response.type !== 'success') return null;

    const { idToken } = response.data;

    if (!idToken) throw new Error('Google sign-in returned no idToken');

    const credential = GoogleAuthProvider.credential(idToken);

    return signInWithCredential(getAuth(), credential);
  },
);

// Distinguishes a user-initiated sign-out from a revoked/expired session so the
// auth listener only shows the "session expired" snackbar for the latter.
let manualSignOut = false;

export const consumeManualSignOutFlag = (): boolean => {
  const wasManual = manualSignOut;
  manualSignOut = false;
  return wasManual;
};

export const signOutFromGoogle = async (): Promise<void> => {
  // The trophy totals' buffer goes out while there is still a user to write
  // it as; after this the sign-out reset clears it (`lib/trophyCounters`).
  pushTrophyCounters();
  manualSignOut = true;
  await GoogleSignin.signOut();
  await signOut(getAuth());
};

export const subscribeToAuthChanges = (
  onChange: (user: FirebaseAuthTypes.User | null) => void,
): (() => void) => onAuthStateChanged(getAuth(), onChange);
