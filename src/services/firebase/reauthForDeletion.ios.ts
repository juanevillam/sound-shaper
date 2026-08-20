import {
  AppleAuthProvider,
  GoogleAuthProvider,
  getAuth,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { type DeletionReauth } from '@/services/firebase/reauthForDeletion';

export type { DeletionReauth };

/**
 * iOS twin of reauthForDeletion: it branches on the USER'S OWN sign-in
 * provider, not on which providers the welcome screen currently offers. That
 * distinction matters here — `APPLE_SIGN_IN_ENABLED` is false while the app is
 * on a free team, so nobody can sign in with Apple today, but an account that
 * already did must still be re-authenticated with Apple: a Google credential
 * cannot reauthenticate an Apple-linked user, and the failure would land AFTER
 * the sweep, leaving them data-swept and undeletable. Topper hit exactly that.
 *
 * The Apple branch also captures the fresh authorizationCode the token
 * revocation needs (App Store 5.1.1(v)).
 */
export const reauthenticateForDeletion = async (): Promise<DeletionReauth> => {
  const user = getAuth().currentUser;

  if (!user) throw new Error('reauth-without-user');

  const isApple = user.providerData.some(
    provider => provider.providerId === 'apple.com',
  );

  if (!isApple) {
    const response = await GoogleSignin.signIn();

    if (response.type !== 'success' || !response.data.idToken)
      throw new Error('reauth-cancelled');

    await user.reauthenticateWithCredential(
      GoogleAuthProvider.credential(response.data.idToken),
    );

    return { appleAuthorizationCode: null };
  }

  // Same nonce round-trip as signInWithApple. No scopes: a reauth needs no
  // name or email, so the consent sheet stays minimal.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;

  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [],
      nonce: hashedNonce,
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED')
      throw new Error('reauth-cancelled');
    throw error;
  }

  if (!credential.identityToken)
    throw new Error('Apple reauth returned no identityToken');

  await user.reauthenticateWithCredential(
    AppleAuthProvider.credential(credential.identityToken, rawNonce),
  );

  return { appleAuthorizationCode: credential.authorizationCode ?? null };
};
