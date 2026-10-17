# media-worker

A single-purpose Cloudflare Worker: **delete the authenticated caller's own
Cloudinary assets**. Nothing else.

It exists because Cloudinary's destroy calls need the API **secret**, which
cannot ship in the app. Firebase Cloud Functions were the old plan but require
the Blaze plan; this Worker runs on Cloudflare's free tier instead — well
inside it, since Cloudflare bills neither subrequests (the Cloudinary and
Google JWK calls) nor duration, and the only CPU spent is one RS256 verify.

## One environment

The ID token's `aud`/`iss` are checked against `FIREBASE_PROJECT_ID`, so the
Worker is bound to one Firebase project. It lives in a named **environment**
(`sound-shaper`) rather than at the top level — the same source once served
the portfolio's other apps, and keeping the environment keeps the deployed
Worker's name, URL and secrets exactly as they are.

| env            | Worker                      | Firebase project | media root     |
| -------------- | --------------------------- | ---------------- | -------------- |
| `sound-shaper` | `sound-shaper-media-worker` | `sound-shaper`   | `sound-shaper` |

`MEDIA_FOLDER_ROOT` **must** equal the owning app's `cloudinary/folders.ts`
root.

**Always pass `--env`.** `vars` are not inherited by named environments, and
nothing is defined at the top level, so a bare `wrangler deploy` produces a
Worker with no `FIREBASE_PROJECT_ID`: every token fails `bad-aud` and it
deletes nothing. That mistake fails CLOSED, on purpose.

## What it does

Two POST routes, matching the app's `callBackend` wire (`{ data }` in, `200
{ result }` out, `Authorization: Bearer <Firebase ID token>`):

| Route             | Body                         | Action                                                 |
| ----------------- | ---------------------------- | ------------------------------------------------------ |
| `/cleanupMyMedia` | `{}`                         | Delete every asset under `{root}/{uid}/`.              |
| `/destroyMyAsset` | `{ publicId, resourceType }` | Delete that one asset, if it's under the uid's prefix. |

### Both resource types, always

Cloudinary keys its Admin API by resource type, and **an mp3 is a `video`**
there (audio is a video with no picture — see
`src/services/cloudinary/upload.ts`). A sweep of `image` alone deletes a library's artwork
and leaves **every audio file** standing, which is the larger half of the
storage by far.

`cleanupMyMedia` therefore sweeps `image` and `video` unconditionally.

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
- **Ownership by path:** the app uploads under a per-user prefix
  `{root}/{uid}/…`. The Worker only ever deletes inside `{root}/{uid}/` for the
  uid on the verified token — so it never needs Firestore to prove who owns
  what. A user physically cannot delete another user's asset, even by naming its
  `publicId`.

## Deploy

One Cloudflare account, on the free plan.

```sh
cd media-worker
npm install
npx wrangler login
npx wrangler secret put CLOUDINARY_API_KEY --env sound-shaper
npx wrangler secret put CLOUDINARY_API_SECRET --env sound-shaper
npm run deploy
```

It deploys to `sound-shaper-media-worker.juanesvillamendoza.workers.dev`, which
is the app's `FUNCTIONS_BASE`. Re-deploying does not change it; renaming the
Worker or the account's workers.dev subdomain would.

**Before 2026-09-12 that URL held a `<subdomain>` placeholder, so every call
404'd at DNS and died in the best-effort catch** — the app degraded exactly as
designed and media orphaned while the code read as complete. A backend feature
is not done when its call site is written.

## Local dev

```sh
cp .dev.vars.example .dev.vars   # fill in the two Cloudinary values
npm run dev                      # wrangler dev --env sound-shaper
```

## The flat-folder migration (done 2026-09-12)

Assets uploaded before per-user namespacing carried no `{uid}` segment, so this
Worker could not reach them. The 40 of them were moved under
`sound-shaper/{uid}/` by a one-off script (in the original portfolio repo's
history), mapping each asset to its owner through Firestore and reporting —
not touching — anything no document named.

## The unsigned presets — settled 2026-09-12

The app uploads with the **unsigned** preset `sound_shaper_unsigned`, which
pins no folder and no transformation, so the app's `folder` param is the only
thing placing assets — and its assets landing at `sound-shaper/{uid}/` is the
proof the param works.

**Don't put an incoming transformation on `sound_shaper_unsigned`.** It is ONE
preset for both covers (`image`) and mp3s (`video` — audio is a video with no
picture), an incoming transformation is applied before storing, and `q_auto` on
a video resource re-encodes. Capping cover art that way would silently transcode
every sound. If a cap is ever wanted, it takes a second preset picked by
resource type.

## E2E — PASSED 2026-09-12 (iPhone 17)

| check                                     | result                                 |
| ----------------------------------------- | -------------------------------------- |
| a new upload lands at `{root}/{uid}/`     | ✅ the app's `folder` param wins       |
| replacing artwork destroys the old asset  | ✅ 404                                 |
| deleting a sound destroys BOTH its assets | ✅ audio AND artwork 404               |
| `cleanupMyMedia` sweeps the whole prefix  | ✅ image AND mp3 404, re-run returns 0 |

And end to end through Delete Account on 2026-10-16 (Release build, a real
Apple account): every asset of the account answered 404 afterwards.

**A wrong secret ships looking like success.** Every call from the app is
best-effort, so a Worker whose Cloudinary credentials are bad returns
`cloudinary-delete-failed:401` while the app reports a clean delete. Verify
with a real destroy after setting secrets.

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
