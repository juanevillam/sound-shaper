# media-worker

A single-purpose Cloudflare Worker: **delete the authenticated caller's own
Cloudinary assets**. Nothing else.

It exists because Cloudinary's destroy calls need the API **secret**, which
cannot ship in the app. Firebase Cloud Functions were the old plan but require
the Blaze plan; this Worker runs on Cloudflare's free tier instead — well
inside it, since Cloudflare bills neither subrequests (the Cloudinary and
Google JWK calls) nor duration, and the only CPU spent is one RS256 verify.

## One source, three deployments

Topper, Sound Shaper and Booker sit on **different Firebase projects**, and the ID
token's `aud`/`iss` are checked against `FIREBASE_PROJECT_ID` — so one instance
could not verify them all. `wrangler.jsonc` therefore defines one **environment**
per app off this one codebase rather than forking it: two copies of a token verifier is
precisely the duplication `scripts/shared-code-audit.mjs` exists to catch.

| env            | Worker                      | Firebase project | media root      |
| -------------- | --------------------------- | ---------------- | --------------- |
| `topper`       | `topper-media-worker`       | `topper-da7db`   | `topper/items`  |
| `sound-shaper` | `sound-shaper-media-worker` | `sound-shaper`   | `sound-shaper`  |
| `booker`       | `booker-media-worker`       | `booker-3764a`   | `booker/covers` |

`MEDIA_FOLDER_ROOT` **must** equal the owning app's `cloudinary/folders.ts`
root.

**Always pass `--env`.** `vars` are not inherited by named environments, and
nothing is defined at the top level, so a bare `wrangler deploy` produces a
Worker with no `FIREBASE_PROJECT_ID`: every token fails `bad-aud` and it
deletes nothing. That mistake fails CLOSED, on purpose.

## What it does

Two POST routes, matching each app's `callBackend` wire (`{ data }` in, `200
{ result }` out, `Authorization: Bearer <Firebase ID token>`):

| Route             | Body                         | Action                                                 |
| ----------------- | ---------------------------- | ------------------------------------------------------ |
| `/cleanupMyMedia` | `{}`                         | Delete every asset under `{root}/{uid}/`.              |
| `/destroyMyAsset` | `{ publicId, resourceType }` | Delete that one asset, if it's under the uid's prefix. |

### Both resource types, always

Cloudinary keys its Admin API by resource type, and **an mp3 is a `video`**
there (audio is a video with no picture — see Sound Shaper's
`cloudinary/upload.ts`). A sweep of `image` alone deletes a library's artwork
and leaves **every audio file** standing, which is the larger half of the
storage by far.

`cleanupMyMedia` therefore sweeps `image` and `video` unconditionally. Topper
holds no audio and pays one extra Admin call that returns nothing; the price of
that is not having to remember to widen this the day an app gains a new media
kind.

`destroyMyAsset` takes the type from the caller, because only the caller knows
what it is about to unlink. That is not an ownership hole: the type merely
picks the endpoint, and **ownership is the prefix check and nothing else**, so
a caller naming the wrong type deletes nothing rather than something it
shouldn't.

## Security model (least privilege)

- **Only** holds Cloudinary credentials. **No** database access — so a
  compromise can only touch assets under a user's own folder.
- **Auth:** verifies the Firebase ID token (RS256 against Google's public keys,
  checks `aud`/`iss` against the environment's project and `exp`). Bad/expired
  token → 401.
- **Ownership by path:** every app uploads under a per-user prefix
  `{root}/{uid}/…`. The Worker only ever deletes inside `{root}/{uid}/` for the
  uid on the verified token — so it never needs Firestore to prove who owns
  what. A user physically cannot delete another user's asset, even by naming its
  `publicId`.

## Deploy

All the Workers live in one Cloudflare account, on the free plan.

```sh
cd services/media-worker
npm install
npx wrangler login
```

Then, **per environment** (the secrets are per-environment too — setting them
on one does not set them on another):

```sh
npx wrangler secret put CLOUDINARY_API_KEY --env topper
npx wrangler secret put CLOUDINARY_API_SECRET --env topper
npm run deploy:topper
```

```sh
npx wrangler secret put CLOUDINARY_API_KEY --env sound-shaper
npx wrangler secret put CLOUDINARY_API_SECRET --env sound-shaper
npm run deploy:sound-shaper
```

```sh
npx wrangler secret put CLOUDINARY_API_KEY --env booker
npx wrangler secret put CLOUDINARY_API_SECRET --env booker
npm run deploy:booker
```

**`booker` is written but NOT DEPLOYED (2026-10-09)** — its secrets and its
deploy were deferred by Juan. Until they land, Booker's cover deletes fail and
are swallowed by design, so a replaced or deleted cover orphans.

Each deploy prints its URL, e.g.
`https://topper-media-worker.<your-subdomain>.workers.dev`.

## Wire the apps to it

Topper and Sound Shaper are wired as of 2026-09-12; Booker's URL is in place
but its Worker is not deployed (it still answered 404 on 2026-10-14):

| app            | `FUNCTIONS_BASE`                                                        |
| -------------- | ----------------------------------------------------------------------- |
| `topper`       | `topper-media-worker.juanesvillamendoza.workers.dev`                    |
| `sound-shaper` | `sound-shaper-media-worker.juanesvillamendoza.workers.dev`              |
| `booker`       | `booker-media-worker.juanesvillamendoza.workers.dev` (not yet deployed) |

Re-deploying does not change these; only renaming a Worker or the account's
workers.dev subdomain would — worth knowing before either ships to a store.

**Before that, both held a `<subdomain>` placeholder, so every call 404'd at
DNS and died in the best-effort catch** — the apps degraded exactly as designed
and media orphaned for months while the code read as complete. A backend
feature is not done when its call site is written.

## Local dev

```sh
cp .dev.vars.example .dev.vars   # fill in the two Cloudinary values
npm run dev                      # wrangler dev --env topper
```

## One-time migration, per app — RUN THIS BEFORE TRUSTING ANY SWEEP

Assets uploaded before per-user namespacing carry no `{uid}` segment, so this
Worker cannot reach them at all. **Both apps have them**, and neither set is
disposable test data:

| app            | where they actually are | count                    |
| -------------- | ----------------------- | ------------------------ |
| `topper`       | `topper/<id>`           | 23 (the demo-video tops) |
| `sound-shaper` | `sound-shaper/<id>`     | 40 (a real library)      |

Topper's are the surprise. `useImageUpload` has targeted `topper/items/{uid}`
since 2026-07-18, but **nothing has been uploaded since** — the newest image
dates to 2026-07-16 — so they sit at `topper/`, one level ABOVE the root this
Worker sweeps. Deployed against them it deletes nothing.

`scripts/migrate-media.py` moves both, dry-run by default:

```sh
python3 scripts/migrate-media.py topper           # DRY RUN
python3 scripts/migrate-media.py topper --apply
python3 scripts/migrate-media.py sound-shaper --apply
```

Read its orphan list — assets no document references are reported and
deliberately not touched.

## The unsigned presets — settled 2026-09-12

The apps upload with an **unsigned** preset, which applies that preset's stored
settings alongside the `folder` param the app sends. Both are now configured so
the app's param is the only thing placing assets:

| preset                  | Folder | Transformation                 |
| ----------------------- | ------ | ------------------------------ |
| `sound_shaper_unsigned` | none   | none                           |
| `topper_unsigned`       | none   | `c_limit,w_2048,h_2048,q_auto` |

`topper_unsigned` pinned `topper` until 2026-09-12, which is why all of that
app's assets sit at `topper/<id>` — the client param never had a chance. It was
cleared. Sound Shaper's was already empty, and its assets landing at
`sound-shaper/` is the proof the param works.

**Don't put an incoming transformation on `sound_shaper_unsigned`.** It is ONE
preset for both covers (`image`) and mp3s (`video` — audio is a video with no
picture), an incoming transformation is applied before storing, and `q_auto` on
a video resource re-encodes. Capping cover art that way would silently transcode
every sound. Topper's preset is images-only, so it keeps the cap; if Sound
Shaper ever wants one, it takes a second preset picked by resource type.

## E2E — Sound Shaper PASSED 2026-09-12 (iPhone 17)

| check                                     | result                                 |
| ----------------------------------------- | -------------------------------------- |
| a new upload lands at `{root}/{uid}/`     | ✅ the app's `folder` param wins       |
| replacing artwork destroys the old asset  | ✅ 404                                 |
| deleting a sound destroys BOTH its assets | ✅ audio AND artwork 404               |
| `cleanupMyMedia` sweeps the whole prefix  | ✅ image AND mp3 404, re-run returns 0 |

Topper passed the same first three on 2026-09-12, but only after its
environment's Cloudinary secrets were re-set: the first run returned
`cloudinary-delete-failed:401` while the app reported a clean delete.

**Verify each environment with a real destroy.** `sound-shaper` worked from its
first call against the same Cloudinary account, which is precisely what made
Topper's bad secret invisible — a working sibling makes credentials look proven.

**Diagnosing one of these:** `npx wrangler tail --env <env> --format json`. The
`wallTime` alone separates the cases — a call rejected before Cloudinary
returned **71 ms**, a real destroy **891 ms**.

The third row is the one worth keeping: audio is a `video` resource on
Cloudinary, so an image-only sweep deletes the artwork, leaves every mp3, and
reports success. Verify the AUDIO, not just the cover.

The fourth was proven WITHOUT deleting an account, and the method generalises:
enable anonymous auth for two minutes, mint a throwaway user through Identity
Toolkit REST, upload an image and a real mp3 to `{root}/{throwaway-uid}/` with
the app's own unsigned preset, then call `/cleanupMyMedia` with that token.
`destroyed:2`, both 404 after, and a re-run returning 0 — which is also how the
`partial` pagination loop was shown to drain and stop rather than spin. Delete
the user and turn Anonymous back off.

**A destructive route can often be proven against a prefix nobody owns.** The
obvious plan was a device build with a throwaway Google account; a token and
two uploads gave the same evidence with the real library never in scope.

**Topper's `destroyMyAsset` is verified on device too** (replace and delete),
and it shares this source, so its `cleanupMyMedia` runs the same code Sound
Shaper's was measured on. What no test covers yet is the REST of account
deletion — the Firestore sweep ordering and the Apple `revokeToken` — which
waits on Gate 0.
