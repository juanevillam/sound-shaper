/* global self, caches, fetch, Response, Request, URL */
/**
 * THE SERVICE WORKER — a template. `vite.config.ts` fills in the two
 * placeholders at build time and emits the result as `/sw.js`; the dev
 * server never registers it.
 *
 * Three jobs:
 *
 * - THE SHELL, per build. Every file the build wrote is cached on install,
 *   so an installed app opens with no network at all. Pages go to the
 *   network first, so a deploy shows at once; the cached page is the
 *   fallback. Each build has its own cache and the old one goes when the new
 *   worker takes over.
 * - ARTWORK, cache-first: covers never change under a URL.
 * - AUDIO THAT HAS BEEN PLAYED, which is the web's half of the app's offline
 *   mirror. The first play streams as before while the whole file is fetched
 *   once more behind it; after that the player reads the copy, answering its
 *   range requests from it. It is a cache, not a mirror: the browser may
 *   evict it, and signing out empties it (`src/offline.ts`).
 *
 * Firebase, App Check and the Worker are never touched: they go straight to
 * the network, and Firestore keeps its own offline copy in IndexedDB.
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;

const SHELL = `soundshaper-shell-${VERSION}`;
/** Named again in src/offline.ts, which empties it on sign-out. */
const MEDIA = 'soundshaper-media';

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(
              key => key.startsWith('soundshaper-shell-') && key !== SHELL,
            )
            .map(key => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const isCloudinary = url => url.hostname === 'res.cloudinary.com';

/** A 206 for `range`, cut from a whole cached file. */
const partial = async (whole, range) => {
  const blob = await whole.blob();
  const size = blob.size;
  const match = /bytes=(\d*)-(\d*)/.exec(range);
  if (!match) return new Response(blob, { headers: whole.headers });

  let start;
  let end;
  if (match[1] === '') {
    // A suffix range: the last N bytes.
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start >= size)
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}` },
    });

  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Type': whole.headers.get('Content-Type') || 'audio/mpeg',
    },
  });
};

const audio = async event => {
  const { request } = event;
  const cache = await caches.open(MEDIA);
  const whole = await cache.match(request.url, { ignoreVary: true });

  if (whole) {
    const range = request.headers.get('Range');
    return range ? partial(whole, range) : whole;
  }

  // Not kept yet: stream it as before, and keep the whole file behind it.
  event.waitUntil(
    cache
      .add(new Request(request.url, { mode: 'cors', credentials: 'omit' }))
      .catch(() => {}),
  );
  return fetch(request);
};

const artwork = async request => {
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(request.url, { ignoreVary: true });
  if (hit) return hit;
  // An <img> asks without CORS, and an opaque answer can be neither read
  // nor sized (Chrome bills each one megabytes of quota). Cloudinary answers
  // CORS, so the worker asks for a readable copy and hands that back.
  const response = await fetch(
    new Request(request.url, { mode: 'cors', credentials: 'omit' }),
  ).catch(() => fetch(request));
  if (response.ok) cache.put(request.url, response.clone()).catch(() => {});
  return response;
};

const page = async request => {
  try {
    return await fetch(request);
  } catch {
    const shell = await caches.open(SHELL);
    return (await shell.match('/', { ignoreVary: true })) || Response.error();
  }
};

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(page(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches
        .open(SHELL)
        // A module script asks with an Origin header; the cached copy was
        // fetched without one, and a `Vary: Origin` would miss it.
        .then(cache => cache.match(request, { ignoreVary: true }))
        .then(hit => hit || fetch(request)),
    );
    return;
  }

  if (isCloudinary(url) && url.pathname.includes('/video/upload/')) {
    event.respondWith(audio(event));
    return;
  }

  if (isCloudinary(url) && url.pathname.includes('/image/upload/'))
    event.respondWith(artwork(request));
});
