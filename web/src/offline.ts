/**
 * Register the Service Worker (`/sw.js`) in production builds so the App Shell,
 * hashed JS/CSS chunks, icons, and Cloudinary cover artwork work smoothly as an
 * installable standalone PWA without interfering with Cloudinary audio streams
 * or Firebase Auth / Firestore.
 */
export const registerServiceWorker = () => {
  if (
    !import.meta.env.PROD ||
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('Service worker registration failed:', error);
    });
  });
};
