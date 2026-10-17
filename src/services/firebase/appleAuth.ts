import {
  AppleAuthProvider,
  getAuth,
  signInWithCredential,
  updateProfile,
  type FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { setOwnName } from '@/services/firebase/ownProfile';
import { useAuthStore } from '@/store/auth';

// iOS-only module: imported exclusively from `useAppleSignIn.ios.ts`, so it
// never enters the Android bundle (expo-apple-authentication has no Android
// native module).

/** Resolves null when the user dismisses the Apple sign-in sheet. */
export const signInWithApple =
  async (): Promise<FirebaseAuthTypes.UserCredential | null> => {
    // Firebase requires the nonce round-trip: Apple gets the SHA-256 digest,
    // the raw value goes into the Firebase credential for verification.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    let credential: AppleAuthentication.AppleAuthenticationCredential;

    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED')
        return null;
      throw error;
    }

    if (!credential.identityToken)
      throw new Error('Apple sign-in returned no identityToken');

    const result = await signInWithCredential(
      getAuth(),
      AppleAuthProvider.credential(credential.identityToken, rawNonce),
    );

    // Apple exposes the name only on the very first authorization; persist it
    // to the Firebase profile then, or the user would stay nameless.
    const fullName = [
      credential.fullName?.givenName,
      credential.fullName?.familyName,
    ]
      .filter(Boolean)
      .join(' ');

    // AND SAY SO TO EVERYTHING THAT ALREADY READ THE NAMELESS USER. The auth
    // listener ran on sign-in, before this, and `onAuthStateChanged` does not
    // fire again for a profile update — so the session showed the placeholder
    // name and `users/{uid}` was written without one until the next launch.
    // The store is patched the way the Account sheet's own name edit patches
    // it, and the doc is written by `setOwnName` without holding up sign-in
    // on a server acknowledgement (it reports its own failure).
    if (!result.user.displayName && fullName) {
      await updateProfile(result.user, { displayName: fullName });
      void setOwnName(fullName).catch(() => {});
      const auth = useAuthStore.getState();
      if (auth.user?.uid === result.user.uid)
        auth.setUser({ ...auth.user, displayName: fullName });
    }

    return result;
  };
