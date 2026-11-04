/**
 * What the service worker (`sw.js`) keeps of a person's library — played
 * audio and artwork — belongs to whoever is signed in, so it goes with them:
 * the app's sign-out wipes its offline mirror for the same reason.
 */
const MEDIA = 'soundshaper-media';

export const registerServiceWorker = () => {
  // The dev server rebuilds modules on the fly; a worker would serve stale ones.
  if (import.meta.hot || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(error => console.warn('service worker', error));
  });
};

/** Sign-out and account deletion: forget every kept file. */
export const forgetOfflineMedia = () =>
  'caches' in window ? caches.delete(MEDIA).catch(() => false) : undefined;

/** A deleted sound: drop its file and its artwork from the cache. */
export const forgetOfflineSound = async (urls: string[]) => {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open(MEDIA);
    const keys = await cache.keys();
    // Artwork is cached per transformed URL, so match on the asset's tail.
    const tails = urls.filter(Boolean).map(url => url.split('/').pop() ?? url);
    await Promise.all(
      keys
        .filter(key => tails.some(tail => key.url.endsWith(tail)))
        .map(key => cache.delete(key)),
    );
  } catch {
    // A cache that cannot be read holds nothing to forget.
  }
};
