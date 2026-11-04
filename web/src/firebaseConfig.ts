/**
 * The Firebase web app "Sound Shaper Web" (registered 2026-11-04), in the
 * same project as the iOS app — one database, one set of accounts. These
 * values are PUBLIC by design: what protects the data is `firestore.rules`
 * (owner-only), App Check, and the API key's HTTP-referrer restriction in
 * Google Cloud (docs/web.md).
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyAJjvEbxJYuxx_FzAUImx2ypJEu4IabT80',
  authDomain: 'sound-shaper.firebaseapp.com',
  projectId: 'sound-shaper',
  storageBucket: 'sound-shaper.firebasestorage.app',
  messagingSenderId: '714853847469',
  appId: '1:714853847469:web:1af2675d9b3fe2064d1124',
  measurementId: 'G-99NB8GJTYC',
};

/**
 * App Check's reCAPTCHA Enterprise key "Sound Shaper Web" (Google Cloud →
 * Security → Fraud Defense), bound to soundshaper.juanevillam.com. Public
 * like the config. Development on localhost uses an App Check DEBUG token
 * instead, registered in the Firebase console, never this key.
 */
export const recaptchaSiteKey = '6LfsUQ8uAAAAAHxdzAmGslJNvjZdZsxZVhSMUe9c';
