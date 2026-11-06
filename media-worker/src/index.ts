/**
 * The portfolio's media-cleanup Worker — a single-purpose "media janitor",
 * deployed once per app (see wrangler.jsonc's environments).
 *
 * It does TWO things, both scoped to the authenticated caller's own folder:
 * delete their Cloudinary assets, and sign their uploads. It holds only
 * Cloudinary credentials, has no database access, and exposes no other
 * capability. If it were ever compromised, the blast radius is the
 * caller-scoped media folder and nothing else.
 *
 * SIGNING IS HERE BECAUSE AN UNSIGNED PRESET IS A PUBLIC FILE HOST. Sound
 * Shaper 1.0.0 uploaded through `sound_shaper_unsigned`, whose name sits in a
 * public repository: anyone could POST to it with no account at all, and the
 * free plan's 25 credits are shared with every app on the cloud. A signature
 * from `signUpload` names ONE public id under the caller's prefix, so it cannot
 * place an asset anywhere else, and replaying it overwrites the same asset
 * rather than adding storage. The caps it checks first are in `UPLOAD_CAPS`.
 *
 * Ownership without a database: every asset is uploaded under a per-user prefix
 * `${MEDIA_FOLDER_ROOT}/{uid}/…` (see each app's cloudinary/folders.ts). The
 * Worker only ever touches inside `${MEDIA_FOLDER_ROOT}/{uid}/` for the uid it
 * read from a *verified* Firebase ID token — so the folder path itself is the
 * proof of ownership, and no Firestore lookup is needed.
 *
 * TWO RESOURCE TYPES, ALWAYS BOTH. Cloudinary keys its Admin API by resource
 * type, and an mp3 is a `video` there (audio is a video with no picture — see
 * Sound Shaper's cloudinary/upload.ts). A sweep of `image` alone therefore
 * deletes a library's artwork and leaves every audio file standing, which is
 * the larger half of the storage. `cleanupMyMedia` sweeps both unconditionally:
 * the app that holds no audio pays one extra Admin call returning nothing, and
 * nobody has to remember to widen this the day an app gains a new media kind.
 *
 * Wire format mirrors the apps' `callBackend` client: POST `{ data }` with an
 * `Authorization: Bearer <Firebase ID token>` header, 200 `{ result }` on
 * success. Callers treat every call as best-effort.
 *
 * Routes (POST only):
 *   /cleanupMyMedia   → delete every asset under the caller's prefix
 *   /destroyMyAsset   → { data: { publicId, resourceType } } delete one owned asset
 *   /signUpload       → { data: { resourceType } } sign one upload into the
 *                       caller's prefix, after the caps and App Check
 *
 * APP CHECK. A request may carry `X-Firebase-AppCheck`, the token proving it
 * came from the real app on a genuine device (App Attest on iOS). `signUpload`
 * REQUIRES it whenever `APP_CHECK` is not `off`: the route is new, so no build
 * that lacks App Check has ever called it. The two delete routes only LOG a
 * missing or bad token (`monitor`) until `APP_CHECK` is `enforce`, because
 * Sound Shaper 1.0.0 calls them without one and must keep deleting.
 */

interface Env {
  /** Public Cloudinary cloud name (a `var`, not a secret). */
  CLOUDINARY_CLOUD_NAME: string;
  /** Cloudinary API key (secret — `wrangler secret put`). */
  CLOUDINARY_API_KEY: string;
  /** Cloudinary API secret (secret — `wrangler secret put`). */
  CLOUDINARY_API_SECRET: string;
  /** Firebase project id; the ID-token `aud`/`iss` must match it (a `var`). */
  FIREBASE_PROJECT_ID: string;
  /** Root of the per-user media prefix, e.g. `topper/items` (a `var`). Keep in
   * sync with the owning app's cloudinary/folders.ts. */
  MEDIA_FOLDER_ROOT: string;
  /** Firebase project NUMBER; an App Check token's `aud`/`iss` carry it. */
  FIREBASE_PROJECT_NUMBER?: string;
  /**
   * `off` — App Check is not read at all (an environment with no app that
   * sends it). `monitor` — required on `signUpload`, logged elsewhere.
   * `enforce` — required on every route. Absent reads as `off`.
   */
  APP_CHECK?: 'off' | 'monitor' | 'enforce';
  /** Workers rate limiter keyed by uid; absent means unlimited. */
  RATE_LIMITER?: RateLimit;
  /**
   * Browser origins allowed to call this Worker, comma-separated (a `var`).
   * Absent means none: the native apps send no `Origin` and need no CORS.
   * CORS is not the security boundary — the ID token and App Check are — it
   * only lets a web build of the app read the response at all.
   */
  ALLOWED_ORIGINS?: string;
}

// Google's public keys for Firebase ID tokens, in JWK form (easiest to import
// with Web Crypto). Rotated periodically; we cache per the response's own
// Cache-Control via the Workers Cache API.
const GOOGLE_JWK_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// Clock-skew tolerance (seconds) for iat/auth_time being slightly ahead.
const SKEW_SECONDS = 300;

const base64UrlToBytes = (input: string): Uint8Array => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  return bytes;
};

const base64UrlToString = (input: string): string =>
  new TextDecoder().decode(base64UrlToBytes(input));

// App Check's public keys. Firebase documents a 6-hour cache; the edge cache
// below honours whatever Cache-Control the response carries.
const APP_CHECK_JWK_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';

/** Fetch a signing key set (kid → JWK), cached at the edge. */
const fetchKeys = async (
  url: string,
  ctx: ExecutionContext,
): Promise<Record<string, JsonWebKey & { kid: string }>> => {
  const cache = caches.default;
  const cacheKey = new Request(url);

  let response = await cache.match(cacheKey);

  if (!response) {
    response = await fetch(url);

    if (!response.ok) throw new Error('jwk-fetch-failed');

    // Store a clone honouring Google's Cache-Control; don't block on it.
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }

  const { keys } = (await response.json()) as {
    keys: Array<JsonWebKey & { kid: string }>;
  };
  const byKid: Record<string, JsonWebKey & { kid: string }> = {};

  for (const key of keys) byKid[key.kid] = key;

  return byKid;
};

/** Check an RS256 JWT's signature against a key set; return its payload. */
const verifyJwt = async <T>(
  token: string,
  keysUrl: string,
  ctx: ExecutionContext,
): Promise<T> => {
  const parts = token.split('.');

  if (parts.length !== 3) throw new Error('malformed-token');

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(base64UrlToString(headerB64)) as {
    alg: string;
    kid: string;
  };

  if (header.alg !== 'RS256') throw new Error('bad-alg');

  const jwk = (await fetchKeys(keysUrl, ctx))[header.kid];

  if (!jwk) throw new Error('unknown-kid');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );

  if (!valid) throw new Error('bad-signature');

  return JSON.parse(base64UrlToString(payloadB64)) as T;
};

/**
 * Verify a Firebase ID token (RS256) and return its uid (`sub`). Throws on any
 * failure — a bad signature, wrong project, or expiry.
 */
const verifyFirebaseToken = async (
  token: string,
  env: Env,
  ctx: ExecutionContext,
): Promise<string> => {
  const payload = await verifyJwt<{
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    auth_time?: number;
  }>(token, GOOGLE_JWK_URL, ctx);
  const now = Math.floor(Date.now() / 1000);
  const { FIREBASE_PROJECT_ID: projectId } = env;

  if (payload.aud !== projectId) throw new Error('bad-aud');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
    throw new Error('bad-iss');
  if (!payload.exp || payload.exp <= now) throw new Error('expired');
  if (!payload.iat || payload.iat > now + SKEW_SECONDS)
    throw new Error('bad-iat');
  if (payload.auth_time !== undefined && payload.auth_time > now + SKEW_SECONDS)
    throw new Error('bad-auth-time');
  if (!payload.sub) throw new Error('no-sub');

  return payload.sub;
};

/**
 * Verify an App Check token: Firebase's own signature, issued for THIS
 * project, unexpired. `sub` is the Firebase app id, which needs no check — any
 * app registered in the project is one of ours.
 */
const verifyAppCheckToken = async (
  token: string,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> => {
  const number = env.FIREBASE_PROJECT_NUMBER;

  if (!number) throw new Error('no-project-number');

  const payload = await verifyJwt<{
    aud?: string[] | string;
    iss?: string;
    exp?: number;
  }>(token, APP_CHECK_JWK_URL, ctx);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

  if (!audiences.includes(`projects/${number}`)) throw new Error('bad-aud');
  if (payload.iss !== `https://firebaseappcheck.googleapis.com/${number}`)
    throw new Error('bad-iss');
  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000))
    throw new Error('expired');
};

/**
 * The Cloudinary resource types these apps store. `image` is artwork and item
 * photos; `video` is audio, which Cloudinary files as video (an mp3 is a video
 * with no picture). `raw` is deliberately absent — nothing uploads one, and a
 * type nobody writes is a type nobody should be able to delete.
 */
const RESOURCE_TYPES = ['image', 'video'] as const;

type ResourceType = (typeof RESOURCE_TYPES)[number];

const isResourceType = (value: unknown): value is ResourceType =>
  typeof value === 'string' &&
  (RESOURCE_TYPES as readonly string[]).includes(value);

const cloudinaryAuth = (env: Env): string =>
  `Basic ${btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`)}`;

const cloudinaryResourcesUrl = (env: Env, resourceType: ResourceType): string =>
  `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/${resourceType}/upload`;

const countDeleted = (deleted: Record<string, string> | undefined): number =>
  Object.values(deleted ?? {}).filter(status => status === 'deleted').length;

/** Delete one asset by exact public id and resource type (Admin API, Basic auth). */
const destroyOne = async (
  env: Env,
  publicId: string,
  resourceType: ResourceType,
): Promise<boolean> => {
  const url = new URL(cloudinaryResourcesUrl(env, resourceType));
  url.searchParams.append('public_ids[]', publicId);

  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: cloudinaryAuth(env) },
  });

  if (!response.ok)
    throw new Error(`cloudinary-delete-failed:${response.status}`);

  const body = (await response.json()) as { deleted?: Record<string, string> };

  return body.deleted?.[publicId] === 'deleted';
};

/**
 * Delete every asset under `prefix`, ACROSS EVERY RESOURCE TYPE — see the
 * file docblock for why both are always swept.
 *
 * The Admin API deletes up to 1000 per call and flags `partial` when more
 * remain; since deleted resources no longer match, re-calling the same prefix
 * drains the rest. The iteration cap is a runaway backstop (50 × 1000 = far
 * beyond any real user).
 */
const destroyByPrefix = async (
  env: Env,
  prefix: string,
): Promise<{ destroyed: number }> => {
  let destroyed = 0;

  for (const resourceType of RESOURCE_TYPES)
    for (let i = 0; i < 50; i += 1) {
      const url = new URL(cloudinaryResourcesUrl(env, resourceType));
      url.searchParams.set('prefix', prefix);

      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: cloudinaryAuth(env) },
      });

      if (!response.ok)
        throw new Error(`cloudinary-prefix-delete-failed:${response.status}`);

      const body = (await response.json()) as {
        deleted?: Record<string, string>;
        partial?: boolean;
      };

      destroyed += countDeleted(body.deleted);

      if (!body.partial) break;
    }

  return { destroyed };
};

/**
 * What one person may hold, decided by Juan on 2026-10-18 against the free
 * plan's 25 monthly credits (1 credit ≈ 1 GB stored). A measured library
 * averages 5.79 MB per mp3 and 95 KB per cover, so 150 sounds is ~0.9 GB and
 * the byte ceiling sits just above it, catching a library of unusually large
 * files before it catches an ordinary one. The per-FILE limits (20 MB mp3,
 * 5 MB cover) are the app's to check before it asks: a signature cannot carry
 * a size, and Cloudinary's own plan ceiling (100 MB) is what bounds a client
 * that skips the check — once per signature, since a replay overwrites.
 */
const UPLOAD_CAPS = {
  sounds: 150,
  bytes: 1_000_000_000,
  perDay: 30,
} as const;

/** What a signed upload may be, per resource type. */
const ALLOWED_FORMATS: Record<ResourceType, string> = {
  image: 'jpg,jpeg,png,heic,heif,webp',
  video: 'mp3',
};

/** `sounds` and `lastDay` count mp3s only — a sound with its cover is ONE
 * upload to the person, and covers are bounded by the byte ceiling. */
type UsageSummary = { sounds: number; bytes: number; lastDay: number };

/** Count what the caller already holds, across both resource types. */
const usageUnder = async (env: Env, prefix: string): Promise<UsageSummary> => {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const usage: UsageSummary = { sounds: 0, bytes: 0, lastDay: 0 };

  for (const resourceType of RESOURCE_TYPES) {
    let cursor: string | undefined;

    // 500 per page; the cap is 150 sounds, so this is one page in practice
    // and the bound is a runaway backstop like `destroyByPrefix`'s.
    for (let i = 0; i < 10; i += 1) {
      const url = new URL(cloudinaryResourcesUrl(env, resourceType));
      url.searchParams.set('prefix', prefix);
      url.searchParams.set('max_results', '500');
      if (cursor) url.searchParams.set('next_cursor', cursor);

      const response = await fetch(url, {
        headers: { Authorization: cloudinaryAuth(env) },
      });

      if (!response.ok)
        throw new Error(`cloudinary-list-failed:${response.status}`);

      const body = (await response.json()) as {
        resources?: Array<{ bytes?: number; created_at?: string }>;
        next_cursor?: string;
      };

      for (const resource of body.resources ?? []) {
        usage.bytes += resource.bytes ?? 0;

        if (resourceType !== 'video') continue;

        usage.sounds += 1;
        if (Date.parse(resource.created_at ?? '') > dayAgo) usage.lastDay += 1;
      }

      cursor = body.next_cursor;

      if (!cursor) break;
    }
  }

  return usage;
};

const sha1Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-1',
    new TextEncoder().encode(input),
  );

  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Sign one upload (Cloudinary's scheme: the signed params sorted and joined as
 * `k=v&k=v`, the API secret appended, SHA-1). The PUBLIC ID is the Worker's,
 * not the caller's — a fresh uuid under the caller's prefix — so an upload can
 * only ever land inside the folder the delete routes already treat as theirs.
 */
const signUpload = async (
  env: Env,
  prefix: string,
  resourceType: ResourceType,
) => {
  const params: Record<string, string> = {
    allowed_formats: ALLOWED_FORMATS[resourceType],
    public_id: `${prefix}${crypto.randomUUID()}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const toSign = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  return {
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    params,
    signature: await sha1Hex(toSign + env.CLOUDINARY_API_SECRET),
  };
};

const jsonResponse = (result: unknown): Response =>
  new Response(JSON.stringify({ result }), {
    headers: { 'Content-Type': 'application/json' },
  });

const errorResponse = (status: number, error: string): Response =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** CORS headers for an allowed browser origin, or null for any other. */
const corsHeaders = (
  request: Request,
  env: Env,
): Record<string, string> | null => {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);

  if (!origin || !allowed.includes(origin)) return null;

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, X-Firebase-AppCheck',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

const handle = async (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> => {
  if (request.method !== 'POST')
    return errorResponse(405, 'method-not-allowed');

  const route = new URL(request.url).pathname.replace(/^\//, '');

  if (
    route !== 'cleanupMyMedia' &&
    route !== 'destroyMyAsset' &&
    route !== 'signUpload'
  )
    return errorResponse(404, 'not-found');

  const bearer = (request.headers.get('Authorization') ?? '').match(
    /^Bearer (.+)$/,
  );

  if (!bearer) return errorResponse(401, 'missing-token');

  let uid: string;

  try {
    uid = await verifyFirebaseToken(bearer[1], env, ctx);
  } catch {
    return errorResponse(401, 'invalid-token');
  }

  // App Check, after the ID token so a log line can name nothing but the
  // route. See the file docblock for which mode rejects where.
  const mode = env.APP_CHECK ?? 'off';

  if (mode !== 'off') {
    const appCheck = request.headers.get('X-Firebase-AppCheck');
    const failure = appCheck
      ? await verifyAppCheckToken(appCheck, env, ctx).then(
          () => null,
          (error: Error) => error.message,
        )
      : 'missing';

    if (failure) {
      console.warn(`app-check ${failure} on ${route}`);

      if (mode === 'enforce' || route === 'signUpload')
        return errorResponse(401, 'app-check');
    }
  }

  // Rate limited per account, not per IP: everything past this point is
  // signed in, and a phone network shares one address among many people.
  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({ key: uid });

    if (!success) return errorResponse(429, 'rate-limited');
  }

  // The caller may only ever touch their own prefix. The trailing slash stops
  // one uid from matching another that shares its leading characters.
  const prefix = `${env.MEDIA_FOLDER_ROOT}/${uid}/`;

  try {
    if (route === 'cleanupMyMedia')
      return jsonResponse(await destroyByPrefix(env, prefix));

    if (route === 'signUpload') {
      const body = (await request.json().catch(() => null)) as {
        data?: { resourceType?: unknown };
      } | null;
      const resourceType = body?.data?.resourceType;

      if (!isResourceType(resourceType))
        return errorResponse(400, 'bad-resource-type');

      // The error names are the app's to translate — see its upload.ts.
      const usage = await usageUnder(env, prefix);

      // Counts only — no uid, no ids — so a refusal can be explained.
      console.log(
        `signUpload ${resourceType} sounds=${usage.sounds} lastDay=${usage.lastDay} bytes=${usage.bytes}`,
      );

      // BOTH COUNT CAPS ARE THE MP3'S ALONE. A sound's cover is signed
      // AFTER its audio has landed, so a daily cap checked on the cover
      // counted the sound's own audio against it: the 30th sound of a day
      // uploaded its mp3, was refused its artwork, and left the mp3 behind
      // (found on device, 2026-10-18).
      if (resourceType === 'video' && usage.lastDay >= UPLOAD_CAPS.perDay)
        return errorResponse(429, 'daily-limit');
      if (resourceType === 'video' && usage.sounds >= UPLOAD_CAPS.sounds)
        return errorResponse(403, 'library-full');
      if (usage.bytes >= UPLOAD_CAPS.bytes)
        return errorResponse(403, 'storage-full');

      return jsonResponse(await signUpload(env, prefix, resourceType));
    }

    const body = (await request.json().catch(() => null)) as {
      data?: { publicId?: unknown; resourceType?: unknown };
    } | null;
    const publicId = body?.data?.publicId;
    const resourceType = body?.data?.resourceType;

    // The resource type only picks which Admin endpoint to call — OWNERSHIP
    // is the prefix check below and nothing else, so a caller naming the
    // wrong type deletes nothing rather than something it should not.
    if (!isResourceType(resourceType))
      return errorResponse(400, 'bad-resource-type');

    if (typeof publicId !== 'string' || !publicId.startsWith(prefix))
      return errorResponse(403, 'not-owner');

    return jsonResponse({
      destroyed: await destroyOne(env, publicId, resourceType),
    });
  } catch {
    return errorResponse(500, `${route}-failed`);
  }
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS')
      return cors
        ? new Response(null, { status: 204, headers: cors })
        : errorResponse(405, 'method-not-allowed');

    const response = await handle(request, env, ctx);

    if (cors)
      for (const [name, value] of Object.entries(cors))
        response.headers.set(name, value);

    return response;
  },
};
