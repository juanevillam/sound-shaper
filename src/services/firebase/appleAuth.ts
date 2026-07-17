import {
  AppleAuthProvider,
  getAuth,
  signInWithCredential,
  updateProfile,
  type FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

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

    if (!result.user.displayName && fullName)
      await updateProfile(result.user, { displayName: fullName });

    return result;
  };
