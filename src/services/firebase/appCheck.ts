import { getApp } from '@react-native-firebase/app';
import {
  getToken,
  initializeAppCheck,
  type AppCheck,
} from '@react-native-firebase/app-check';

import { recordError } from '@/services/firebase/crashlytics';

/**
 * Firebase App Check: a token proving a request came from THIS app on a
 * genuine device — App Attest on iOS, Play Integrity on Android — rather than
 * from a script holding a valid account. Firestore attaches it on its own once
 * this has run; the media Worker is sent it by `functions.ts`.
 *
 * ACTIVATED HERE, ENFORCED ELSEWHERE, AND THE ORDER MATTERS. Turning it on in
 * the app costs nothing and refuses nothing. Enforcement is a switch in the
 * Firebase console (Firestore) and the Worker's `APP_CHECK` var, and flipping
 * either before this build is what people run locks out every install of
 * 1.0.0, which has no App Check at all — `docs/telemetry-and-abuse.md`.
 *
 * DEBUG BUILDS USE THE DEBUG PROVIDER, which logs a token to register in the
 * console (App Check → Apps → Manage debug tokens); App Attest does not work on
 * a simulator. A Release build on a device is the real test.
 */
const appCheckReady: Promise<AppCheck | null> = initializeAppCheck(getApp(), {
  provider: {
    providerOptions: {
      apple: { provider: __DEV__ ? 'debug' : 'appAttest' },
      android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
    },
  },
  isTokenAutoRefreshEnabled: true,
}).catch((error: unknown) => {
  recordError(error, 'appCheck.initialize');
  return null;
});

/**
 * The current App Check token, or null when there is none to give (not
 * attested yet, or attestation failed). The Worker decides what a missing
 * token costs, so a null here is never an error of ours to throw.
 */
export const appCheckToken = async (): Promise<string | null> => {
  const appCheck = await appCheckReady;

  if (!appCheck) return null;

  try {
    return (await getToken(appCheck)).token;
  } catch (error) {
    recordError(error, 'appCheck.getToken');
    return null;
  }
};
