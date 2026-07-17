import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
  type FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// The Firebase project's Web OAuth client (the `client_type: 3` entry in
// google-services.json / the Web client auto-created when Google sign-in was
// enabled). Used on BOTH platforms by GoogleSignin.
const WEB_CLIENT_ID =
  '714853847469-8cngsj4f4q97dtsqp4it81g963480900.apps.googleusercontent.com';

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
};

/** Resolves null when the user dismisses the Google account sheet. */
export const signInWithGoogle =
  async (): Promise<FirebaseAuthTypes.UserCredential | null> => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();

    if (response.type !== 'success') return null;

    const { idToken } = response.data;

    if (!idToken) throw new Error('Google sign-in returned no idToken');

    const credential = GoogleAuthProvider.credential(idToken);

    return signInWithCredential(getAuth(), credential);
  };

// Distinguishes a user-initiated sign-out from a revoked/expired session so the
// auth listener only shows the "session expired" snackbar for the latter.
let manualSignOut = false;

export const consumeManualSignOutFlag = (): boolean => {
  const wasManual = manualSignOut;
  manualSignOut = false;
  return wasManual;
};

export const signOutFromGoogle = async (): Promise<void> => {
  manualSignOut = true;
  await GoogleSignin.signOut();
  await signOut(getAuth());
};

export const subscribeToAuthChanges = (
  onChange: (user: FirebaseAuthTypes.User | null) => void,
): (() => void) => onAuthStateChanged(getAuth(), onChange);
