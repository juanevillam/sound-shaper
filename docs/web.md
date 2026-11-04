# Sound Shaper on the web

**Decided 2026-11-04 (Juan).** The Play Store is paused for good, and Sound
Shaper gets a web version that does everything the iOS app does — library,
uploads, the player, Shape, clips, trophies, settings and the account —
installable as a PWA, at `soundshaper.juanevillam.com`. The iOS app stays on
the App Store. Topper and Booker follow the same road later (web only, their
own public repos); this app goes first.

## The rule: one product, two front ends, always at parity

The web app lives in THIS repo, in `web/`, so one change lands in both and one
version and one tag cover both. A second repo was turned down for exactly the
reason the portfolio's standards keep repeating: the twin that arrives second
drifts.

- `web/` is its own Vite + React + TypeScript app with its own `package.json`.
  It is NOT React Native Web (Juan: too heavy to make a browser imitate native
  controls). It draws the web's own controls, in juanevillam.com's language.
- It IMPORTS the app's platform-free modules straight from `src/` (path
  aliases in `web/vite.config.ts` and `web/tsconfig.json`), never a copy:
  the translations, `shapeDsp` and `eqResponse` (the Shape's numbers and
  curve), `gridOrder`, `clipQueue`, the Firestore collection shapes, the
  trophy config. A module that reaches into React Native, Expo or a native
  module stays the app's, and the web writes its own twin beside it.
- **The audio engine is shared too.** `src/lib/audioEngine.ts` is Web Audio
  already — `react-native-audio-api` copies the browser's API node for node
  (`createMediaElementSource`, biquads, a convolver). The web build aliases
  that package to `web/src/shims/audio-api.ts`, which hands back the
  browser's own classes, so the graph, its ramps and its headroom trim are
  the SAME code on both sides.
- A version bump is `package.json`'s `version`, read by both. A release
  tag covers the iOS build sent to review AND the web deploy of that commit.

## What differs, and is allowed to

- **Preserve Pitch.** The app runs its own phase vocoder (`patches/`); the
  browser stretches with its own `preservesPitch`. At rates other than 1× the
  two sound different. Closing it means Signalsmith Stretch compiled to WASM
  in an AudioWorklet — later, as its own step.
- **Background playback on iPhone.** Safari suspends Web Audio when the page
  leaves the screen; the Media Session API gives lock-screen controls but not
  a reliable background. On an iPhone the native app is the answer; the web
  is for desktops and for Android, which is how Sound Shaper reaches Android
  without the Play Store.
- **No widgets, no haptics, no Live Activity.** Native surfaces.
- **Offline.** The app mirrors the library to the phone. The web caches what
  has been played (Cache Storage), and an installed PWA keeps it; Safari may
  evict a site's storage after weeks unused, so it is a cache, not a mirror.

## Security in a public repo

The same model as the app: nothing secret is in the client.

- The Firebase web config is public by design. What protects the data is
  `firestore.rules` (owner-only, the path is the ownership) and App Check.
- **App Check on the web is reCAPTCHA Enterprise.** The media Worker already
  ENFORCES App Check for Sound Shaper (portfolio commit `2f64f32a`), and its
  calls are best-effort, so a web app without App Check would fail to delete
  media SILENTLY. Registering the web app's App Check comes before the first
  upload from the web.
- Uploads go to Cloudinary under `{root}/{uid}/` exactly as the app's do.

## Juan's console steps (cannot be done from here)

1. Firebase → Project settings → Add app → Web ("Sound Shaper Web"); hand
   the config over (it goes in `web/.env`, which IS committed — it is public).
2. Authentication → Settings → Authorized domains: `soundshaper.juanevillam.com`
   (and `localhost` for development).
3. App Check → register the web app with reCAPTCHA Enterprise; a debug token
   for `localhost`.
4. Sign in with Apple on the web: a Services ID and the domain's
   verification in Grostify's Apple Developer account — the Account Holder's
   call. Google sign-in needs nothing extra.
5. Cloudflare Pages: project `soundshaper`, root `web`, build
   `npm ci && npm run build`, output `dist`; custom domain
   `soundshaper.juanevillam.com`.

## Order of work

1. Scaffold `web/` with the shared imports and the audio shim, proven by
   playing a file through the shared engine. ← started 2026-11-04
2. Firebase web: sign in (Google), read the library, App Check.
3. Library grid and the player (mini and expanded), streaming from Cloudinary.
4. Shape: Equalizer, Playback Speed, Preserve Pitch, Echo, Next Room.
5. Clips, then uploads and Edit Sound (tags, artwork).
6. Trophies, Settings, Manage Account, delete account.
7. PWA: manifest, icons from the brand art, service worker, install.
8. Deploy, then the website's "Powered by Sound Shaper" mini player moves onto
   this repo's engine, and its link offers both the web app and the App Store.
