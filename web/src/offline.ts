import { useSyncExternalStore } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let standalone = false;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

const checkStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
};

if (typeof window !== 'undefined') {
  standalone = checkStandalone();
  const mq = window.matchMedia('(display-mode: standalone)');
  mq.addEventListener?.('change', () => {
    standalone = checkStandalone();
    notify();
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    standalone = true;
    notify();
  });
}

export const isIosSafari = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

export const usePwaInstall = () => {
  const isInstalled = useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => standalone,
  );
  const canPromptNatively = useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => deferredPrompt !== null,
  );

  const promptInstall = async (): Promise<
    'installed' | 'dismissed' | 'manual'
  > => {
    if (!deferredPrompt) return 'manual';
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    notify();
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    return outcome === 'accepted' ? 'installed' : 'dismissed';
  };

  return { isInstalled, canPromptNatively, promptInstall };
};

/**
 * Register the Service Worker (`/sw.js`) in production builds so the App Shell,
 * hashed JS/CSS chunks, icons, and Cloudinary cover artwork work smoothly as an
 * installable standalone PWA without interfering with Cloudinary audio streams
 * or Firebase Auth / Firestore. Checks for updates whenever the app returns to
 * the foreground.
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
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then(registration => {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            void registration.update();
          }
        });
      })
      .catch(error => {
        console.warn('Service worker registration failed:', error);
      });
  });
};
