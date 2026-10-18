# Telemetry, quotas and abuse protection — plan (2026-10-18)

Asked by Juan on 2026-10-18: should the app have bot protection, will the free
tiers hold, and can he see what is used most and where it crashed. This is the
plan, decided the same day. **Juan's decisions** are at the end and are
the part to update as they are made.

## 1. Where the free tiers stand — measured 2026-10-18

Measured over the Firestore REST API and Cloud Monitoring with the
firebase-tools token, and by `HEAD`-ing every media URL a document holds.
Cloudinary's own dashboard was NOT read (no API key on this Mac, console not
signed in), so its bandwidth figure is an estimate; storage is exact for Sound
Shaper's assets.

| what                    | today                                     | free limit                                                         |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| accounts                | 1 (Juan)                                  | —                                                                  |
| sounds                  | 31, avg **5.79 MB** mp3 + **95 KB** cover | —                                                                  |
| Cloudinary storage      | **182 MB ≈ 0.18 credits**                 | 25 credits / month, ALL usage combined, account SHARED with Topper |
| Firestore reads / day   | 54–397 (last 7 days)                      | 50,000                                                             |
| Firestore writes / day  | 4–189                                     | 20,000                                                             |
| Firestore deletes / day | 0–63                                      | 20,000                                                             |
| Firestore stored        | well under 1 MB (≈1 KB per doc)           | 1 GiB                                                              |

**What one person costs on Cloudinary**, at Juan's library shape (31 sounds):

- **Storage**: 0.18 GB, held every month — it accumulates, it is not a
  one-time charge.
- **Bandwidth**: the offline mirror downloads each mp3 ONCE per device, so a
  new device costs the whole library once (0.18 GB) and a play after that costs
  nothing. Covers are `w_…,q_auto,f_auto` thumbnails of ~10–30 KB.
- **Transformations**: a handful of derived covers per sound, made once.
  Hundreds of sounds before this reaches one credit.

So a month for a settled Juan-sized person is ≈ **0.2 credits**, and the first
month ≈ 0.4. **Cloudinary storage is the first limit that hits, at roughly
100 Juan-sized libraries** (25 credits ÷ ~0.2, less whatever Topper holds and
re-downloads). Firestore's reads are next and far behind: ~400 a day for one
active person points at ~100+ daily actives before 50k, and that is the
pessimistic figure (persistence serves most re-attaches from cache).

**The real risk is not growth but abuse, and it is already open in 1.0.0:**

1. **Uploads go straight to Cloudinary through an UNSIGNED preset**
   (`sound_shaper_unsigned`, cloud `juanevillam`), and both names are in a
   public repository. Anyone can POST files to that preset with no Firebase
   account at all. Cloudinary's free plan takes a video up to 100 MB, so
   ~250 scripted uploads fill the whole 25 credits — and Topper's media shares
   the account. Nothing in Firebase can see or stop it; App Check alone does
   not close it.
2. **Firestore rules check ownership, not shape.** Any signed-in account can
   write documents of any size (up to 1 MiB each) under its own uid. Spark's
   1 GiB is ~1,000 such writes.
3. **Delivery URLs are public if known** (already recorded in AGENTS.md). Not
   an abuse vector in practice — they are unlisted — but a leaked URL can be
   re-downloaded at Juan's bandwidth cost.

## 2. Crashes and analytics

**Crashlytics is already in 1.0.0** (`@react-native-firebase/crashlytics`,
`src/services/firebase/crashlytics.ts`): fatal JS errors, native crashes and
handled errors as non-fatals, no user id, declared on the App Privacy label.
So "where did it crash" is answered today in the Firebase console → Crashlytics.

**What is missing is usage** — which parts are used most. Proposal:

- **`@react-native-firebase/analytics`**, the same Firebase project, with the
  ad id OFF: `google_analytics_adid_collection_enabled: false` in
  `firebase.json` and `$RNFirebaseAnalyticsWithoutAdIdSupport = true` in the
  Podfile (via a config plugin, since `ios/` is CNG). No IDFA → no ATT prompt,
  and it is not "tracking" in Apple's sense. No `setUserId`.
- **Screen views** from expo-router's pathname (one hook in `_layout.tsx`).
- **Named events**, deliberately few: `add_sound`, `open_shape`,
  `save_clip`, `trophy_unlocked` (with the trophy id), `play_sound`
  (no title, no id — counts only).
- Turning it on also unlocks Crashlytics' crash-free-users figure and
  breadcrumbs (the screen someone was on when it crashed).

**App Privacy label change**: add Usage Data → Product Interaction (NOT linked —
analytics has no user id; the existing linked row stays for the trophies),
and Device ID gains Analytics' app-instance id as a second purpose
(Analytics). The privacy manifest in `app.json` changes with it, and the
policy page at `website/…/sound-shaper/privacy-policy` gains one paragraph
naming Google Analytics for Firebase, all three languages.

**Sentry, compared:** the free Developer plan is one user and ~5k errors a
month, with source maps and a better JS stack view. It would be a second SDK,
a second processor on the privacy label and the policy, and an account to
keep — for what Crashlytics already does free and unlimited. **Recommendation:
stay on Crashlytics, add Firebase Analytics.**

## 3. Bot and abuse protection

In order of what each one closes:

1. **Signed uploads through the media Worker** (closes §1 risk 1, the big one).
   A new route `sign-upload` on `services/media-worker`'s `sound-shaper`
   environment: it verifies the Firebase ID token (it already does this),
   checks the caller's quota, and returns a Cloudinary signature for
   `folder: sound-shaper/{uid}`, a fixed `resource_type`, `allowed_formats`
   and a timestamp. The app uploads with that signature instead of the preset;
   the unsigned preset is then deleted in the Cloudinary console. The secret
   never leaves the Worker, and an upload can no longer land outside the
   caller's own folder.
2. **Per-person caps, enforced in that same route** (proposed numbers, Juan to
   set): **20 MB per mp3, 5 MB per cover, 150 sounds per person (~0.9 GB),
   30 uploads a day**. The count comes from a per-uid counter in Workers KV
   (incremented on sign, decremented by the existing destroy route), so the
   Worker never has to list Cloudinary. The app shows the cap as an ordinary
   Apple-voice alert ("Your Library Is Full").
3. **Rate limiting in the Worker**: the Workers Rate Limiting binding, keyed by
   uid (and by IP before the token is verified), e.g. 30 requests / minute.
4. **Firebase App Check** — App Attest on iOS (an entitlement on Grostify's
   team, which it can grant), Play Integrity on Android when Android ships,
   the debug provider in development. Enforced on **Firestore** in the
   console, and its token sent to the Worker beside the ID token and verified
   there (RS256 JWT against Firebase's public JWKS, `aud` = the project
   number). This is what makes a script without the real app fail even with a
   valid account.
5. **Shape checks in `firestore.rules`** (closes §1 risk 2): `keys().hasOnly`
   per collection and size limits on every string (a name ≤ 200 chars, URLs
   must start with `https://res.cloudinary.com/juanevillam/`).

**The ordering trap: enforcement locks out every build without App Check.**
1.0.0 (build 4, in review now) has none. Enforcing App Check on Firestore, or
removing the unsigned preset, the day a 1.0.1 ships would break every 1.0.0
install that has not updated. With a handful of users that window is short,
but it is real: ship 1.0.1, watch App Check's "verified requests" share in the
console reach ~100%, THEN enforce and delete the preset.

**What can be done today, with no build**: in the Cloudinary console, set the
unsigned preset's allowed formats to `mp3,jpg,jpeg,png,heic,webp` (it changes
nothing for the app and stops it being a free file host). Juan's dashboard
toggle, not code.

## Juan's decisions

| question                                                 | decision                                                                                                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| land before or after 1.0.0's first review                | **after** — 1.0.0 ships as is; this is 1.0.1, enforced once 1.0.1 is what people run (2026-10-18)                                                              |
| add Firebase Analytics (no ad id, no user id)            | **yes**, Firebase (2026-10-18)                                                                                                                                 |
| per-person caps (proposed 20 MB / 150 sounds / 30 a day) | **as proposed**: 20 MB mp3, 5 MB cover, 150 sounds, 30 uploads a day (2026-10-18); 30/day re-confirmed after Juan hit it on day one — whoever wants more waits |

## What was built (2026-10-18, for 1.0.1)

- **Worker** (`services/media-worker`, portfolio repo): `signUpload` with the
  caps above (counting MP3s for the sound and daily caps; covers count only
  toward the 1 GB), App Check verification (`APP_CHECK: monitor` on
  `sound-shaper`), a 30-a-minute rate limit per uid. **Deployed** to the
  `sound-shaper` environment the same day; `topper`/`booker` untouched.
- **App**: `services/firebase/appCheck.ts` (App Attest in Release, debug
  provider in dev; the `appattest-environment: production` entitlement),
  `services/firebase/analytics.ts` (screen views + the five events, built
  without the IdentitySupport pod), every upload signed by the Worker, the
  20 MB / 5 MB file checks, and four new snackbar strings for a refused upload
  (`uploadFailure.ts`). The privacy manifest and `store-listing.md` gain the
  Analytics purposes.
- **Firebase**: App Check API enabled; the iOS app's Team ID moved from the
  free team `C65D64JUZK` to `PHLR7X3FGN` (App Attest validates against it);
  App Attest registered (1 h tokens). **Google Analytics linked by Juan**
  (property `559529393`, streams for iOS and Android); the regenerated
  `GoogleService-Info.plist` is byte-identical to the committed one.
- **Website**: the Sound Shaper privacy policy names the usage counts, App
  Check, and the Worker's upload approval, in all three languages; Topper's and
  Booker's pages are unchanged.

**Verified on Juan's iPhone (Release build, 2026-10-18)**: App Attest tokens
accepted by the Worker (`signUpload` refuses without one, and the delete
routes logged no warning); a sound added through the signed path, its MP3 and
cover at Worker-chosen ids, both served. **The device walk found one bug, fixed
the same evening**: the daily cap was checked on the COVER's signature too, so
the 30th sound of a day uploaded its MP3, was refused its artwork, and left the
MP3 orphaned — which then held the slot, so every retry failed the same way.
Both count caps are the MP3's alone now, and `createSound` destroys its audio
when anything after the upload fails. One orphan from the test
(`sound-shaper/<uid>/c43c60be…`, 6.4 MB) is still on Cloudinary — delete it in
the console, or leave it.

**Not built, on purpose**: the Firestore shape rules (§3.5) — a rules deploy
reaches 1.0.0 installs immediately, so it wants its own pass against every
writer and the emulator.

## When 1.0.1 is what people run — the switch-over

1. Firebase console → App Check → Firestore: watch "verified requests" reach
   ~100%, then **Enforce**.
2. `wrangler.jsonc` `sound-shaper` → `"APP_CHECK": "enforce"`, deploy.
3. Cloudinary console → delete the `sound_shaper_unsigned` preset.
4. App Store Connect → App Privacy: add the two Analytics purposes
   (`store-listing.md`).
