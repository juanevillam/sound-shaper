/**
 * NOT A PWA (Juan, 2026-11-04: no web of his installs — it is awkward to
 * use). An earlier build registered a service worker that kept the shell,
 * artwork and played audio; a browser that visited then still runs it and
 * still holds those caches. This takes both away on the next visit, so
 * every page comes from the network and nothing of a library stays behind.
 */
export const retireServiceWorker = () => {
  if ('serviceWorker' in navigator)
    void navigator.serviceWorker
      .getRegistrations()
      .then(all => Promise.all(all.map(worker => worker.unregister())))
      .catch(() => undefined);
  if ('caches' in window)
    void caches
      .keys()
      .then(names =>
        Promise.all(
          names
            .filter(name => name.startsWith('soundshaper-'))
            .map(name => caches.delete(name)),
        ),
      )
      .catch(() => undefined);
};
