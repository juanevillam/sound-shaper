import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

import { app, auth } from './auth';
import { recaptchaSiteKey } from './firebaseConfig';

export { app, auth };

declare global {
  // eslint-disable-next-line no-var
  var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined;
}

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

// The app keeps Firestore's cache on disk too, so a library opens at once.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
