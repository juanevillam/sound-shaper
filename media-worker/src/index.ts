/**
 * The portfolio's media-cleanup Worker — a single-purpose "media janitor",
 * deployed once per app (see wrangler.jsonc's environments).
 *
 * It does exactly ONE thing: delete the authenticated caller's own Cloudinary
 * assets. It holds only Cloudinary credentials, has no database access, and
 * exposes no other capability. If it were ever compromised, the blast radius is
 * the caller-scoped media folder and nothing else.
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
  /** Root of the per-user media prefix, e.g. `sound-shaper` (a `var`). Keep in
   * sync with the owning app's cloudinary/folders.ts. */
  MEDIA_FOLDER_ROOT: string;
}

// Google's public keys for Firebase ID tokens, in JWK form (easiest to import
// with Web Crypto). Rotated periodically; cached for the response's own
// Cache-Control max-age — see `fetchGoogleKeys`.
const GOOGLE_JWK_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// When Google's response carries no usable max-age.
const DEFAULT_KEYS_TTL_MS = 60 * 60 * 1000;

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

type GoogleKeys = Record<string, JsonWebKey & { kid: string }>;

/** `max-age` from a Cache-Control header, in ms — or the fallback. */
const maxAgeMs = (cacheControl: string | null): number => {
  const match = cacheControl?.match(/max-age=(\d+)/);
  const seconds = match ? Number(match[1]) : NaN;

  return Number.isFinite(seconds) && seconds > 0
    ? seconds * 1000
    : DEFAULT_KEYS_TTL_MS;
};

/**
 * THE KEYS ARE MEMOISED IN THE ISOLATE, NOT ONLY AT THE EDGE. `caches.default`
 * is a no-op on a `*.workers.dev` hostname — the Cache API only stores on a
 * zone the account owns — so on this deployment every request re-fetched
 * Google's keys before it could verify anything. A module-scope memo lives as
 * long as the isolate does (many requests) and expires on Google's own
 * max-age. `caches.default` stays as the second tier, for a deployment on a
 * custom domain where it does work.
 */
let memo: { expiresAt: number; keys: GoogleKeys } | null = null;

/** Fetch Google's signing keys (kid → JWK). `force` skips both caches. */
const fetchGoogleKeys = async (
  ctx: ExecutionContext,
  { force = false }: { force?: boolean } = {},
): Promise<GoogleKeys> => {
  if (!force && memo && memo.expiresAt > Date.now()) return memo.keys;

  const cache = caches.default;
  const cacheKey = new Request(GOOGLE_JWK_URL);

  let response = force ? undefined : await cache.match(cacheKey);

  if (!response) {
    response = await fetch(GOOGLE_JWK_URL);

    if (!response.ok) throw new Error('jwk-fetch-failed');

    // Store a clone honouring Google's Cache-Control; don't block on it.
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }

  const { keys } = (await response.json()) as {
    keys: Array<JsonWebKey & { kid: string }>;
  };
  const byKid: GoogleKeys = {};

  for (const key of keys) byKid[key.kid] = key;

  memo = {
    expiresAt: Date.now() + maxAgeMs(response.headers.get('Cache-Control')),
    keys: byKid,
  };

  return byKid;
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
  const parts = token.split('.');

  if (parts.length !== 3) throw new Error('malformed-token');

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(base64UrlToString(headerB64)) as {
    alg: string;
    kid: string;
  };

  if (header.alg !== 'RS256') throw new Error('bad-alg');

  // An unknown kid on a memoised set may be a rotation the memo has not seen
  // yet: refetch once before refusing the token.
  const jwk =
    (await fetchGoogleKeys(ctx))[header.kid] ??
    (await fetchGoogleKeys(ctx, { force: true }))[header.kid];

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

  const payload = JSON.parse(base64UrlToString(payloadB64)) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    auth_time?: number;
  };
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

const jsonResponse = (result: unknown): Response =>
  new Response(JSON.stringify({ result }), {
    headers: { 'Content-Type': 'application/json' },
  });

const errorResponse = (status: number, error: string): Response =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (request.method !== 'POST')
      return errorResponse(405, 'method-not-allowed');

    const route = new URL(request.url).pathname.replace(/^\//, '');

    if (route !== 'cleanupMyMedia' && route !== 'destroyMyAsset')
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

    // The caller may only ever touch their own prefix. The trailing slash stops
    // one uid from matching another that shares its leading characters.
    const prefix = `${env.MEDIA_FOLDER_ROOT}/${uid}/`;

    try {
      if (route === 'cleanupMyMedia')
        return jsonResponse(await destroyByPrefix(env, prefix));

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
      return errorResponse(500, 'cleanup-failed');
    }
  },
};
