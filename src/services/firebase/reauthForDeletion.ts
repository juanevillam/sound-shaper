import { GoogleAuthProvider, getAuth } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export type DeletionReauth = {
  /**
   * Fresh Apple authorizationCode when the reauth ran through Sign in with
   * Apple (iOS twin) — consumed by the token revocation. Always null on
   * Android, where Google is the only provider.
   */
  appleAuthorizationCode: string | null;
};

/**
 * Re-authenticate the CURRENT provider before account deletion. It runs before
 * the irreversible sweep: Firebase's recent-login window is ~5 minutes, so the
 * final auth delete would otherwise fail with `auth/requires-recent-login`
 * AFTER the data was already gone. Throws when the person dismisses the sheet —
 * the deletion aborts with everything intact.
 *
 * Android build: Google is the only sign-in provider. The iOS twin
 * (`reauthForDeletion.ios.ts`) branches per provider and adds Apple.
 */
export const reauthenticateForDeletion = async (): Promise<DeletionReauth> => {
  const user = getAuth().currentUser;

  if (!user) throw new Error('reauth-without-user');

  const response = await GoogleSignin.signIn();

  if (response.type !== 'success' || !response.data.idToken)
    throw new Error('reauth-cancelled');

  await user.reauthenticateWithCredential(
    GoogleAuthProvider.credential(response.data.idToken),
  );

  return { appleAuthorizationCode: null };
};
