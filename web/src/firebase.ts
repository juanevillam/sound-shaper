import { initializeApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

import { firebaseConfig, recaptchaSiteKey } from './firebaseConfig';

declare global {
  // eslint-disable-next-line no-var
  var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined;
}

export const app = initializeApp(firebaseConfig);

// On localhost reCAPTCHA cannot vouch for the page (the key is bound to
// soundshaper.juanevillam.com), so App Check runs on a DEBUG token registered
// in the Firebase console (App Check → Sound Shaper Web → Manage debug
// tokens). It is `VITE_APPCHECK_DEBUG_TOKEN` in `web/.env.local` — gitignored,
// one token for every browser on this Mac. Without it, the SDK makes one per
// browser and prints it in the console to register.
if (import.meta.env.DEV)
  globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN =
    import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;

export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
  isTokenAutoRefreshEnabled: true,
});

export const auth = getAuth(app);

// The app keeps Firestore's cache on disk too, so a library opens at once.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
