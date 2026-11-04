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

## Console setup

Done 2026-11-04, from Juan's browser:

1. Firebase web app "Sound Shaper Web" registered (no Firebase Hosting); its
   config is `web/src/firebaseConfig.ts`, committed — it is public.
2. Authentication → Authorized domains: `soundshaper.juanevillam.com`
   (`localhost` was already there).
3. App Check: the web app is registered with Fraud Defense (reCAPTCHA
   Enterprise) — key "Sound Shaper Web" in Google Cloud, bound to
   `soundshaper.juanevillam.com` only, TTL 1 hour. The reCAPTCHA Enterprise
   API is enabled; on Spark it has no billing account to charge.
4. App Check debug token "Mac localhost", generated in the console and kept
   in `web/.env.local` as `VITE_APPCHECK_DEBUG_TOKEN` (gitignored; restart
   `npm run dev` after editing it). Never commit it.
5. The web API key (Browser key created 2026-11-04) accepts only
   `https://soundshaper.juanevillam.com/*`, `http://localhost:5173/*` and
   `https://sound-shaper.firebaseapp.com/*` — the last is Firebase Auth's
   sign-in handler. A new origin (a preview URL, another port) must be added
   there or Firebase calls from it fail.

Still to do:

- **Deploy the media Worker's CORS change before the web app's first
  upload** (`npm run deploy:sound-shaper` in portfolio
  `services/media-worker`, the deployed source — this repo's `media-worker/`
  copy is older). Committed 2026-11-04 (portfolio `2ca88b93`) and tested
  locally with `wrangler dev`, deliberately NOT deployed: nothing in a
  browser calls the Worker yet, so deploying early only risks the live iOS
  app. It allows `https://soundshaper.juanevillam.com` and
  `http://localhost:5173` (`ALLOWED_ORIGINS`); without it every browser call
  fails its CORS preflight with a 405. Verify after with a preflight
  (`curl -i -X OPTIONS …/signUpload -H 'Origin: http://localhost:5173'` → 204) and a real upload from the iOS app.
- Sign in with Apple on the web: a Services ID and the domain's verification
  in Grostify's Apple Developer account — the Account Holder's call. Google
  sign-in needs nothing extra.
- Cloudflare Pages: project `soundshaper`, root `web`, build
  `npm ci && npm run build`, output `dist`; custom domain
  `soundshaper.juanevillam.com`. Nothing at Namecheap: the zone's DNS is on
  Cloudflare, so the custom domain writes its own record.
- Cloudinary needs nothing: uploads are signed by the Worker and delivery is
  open to any origin.

## Order of work

1. Scaffold `web/` with the shared imports and the audio shim, proven by
   playing a file through the shared engine. Done 2026-11-04.
2. Firebase web: sign in (Google), read the library, App Check. Built
   2026-11-04 (Welcome, Google popup, live library, tap to play).
3. Library grid and the player (mini and expanded), streaming from Cloudinary.
   Built 2026-11-04: on a desk three columns (now playing, grid, Shape), the
   site's full-screen Songs player as the whole window; on a phone the app's
   grid, mini player, full-screen player and Shape sheet. Signing out stops
   the sound and forgets the shape (`resetPlayer`).
4. Shape: Equalizer, Playback Speed, Preserve Pitch, Echo, Next Room. Built
   2026-11-04, beside step 3.
5. Clips, then uploads and Edit Sound (tags, artwork). Clips built
   2026-11-04: list, play to the end and park, Repeat (all four modes, via the
   app's `clipQueue`), delete, and a two-handle New Clip with Preview. The
   app's zoomed waveform editor is still to come. Auto DJ follows once the
   app's version lands.
6. Trophies, Settings, Manage Account, delete account.
7. PWA: manifest, icons from the brand art, service worker, install.
8. Deploy, then the website's "Powered by Sound Shaper" mini player moves onto
   this repo's engine, and its link offers both the web app and the App Store.
