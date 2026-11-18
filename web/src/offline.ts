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

const DISPLAY_MODES = [
  '(display-mode: standalone)',
  '(display-mode: minimal-ui)',
  '(display-mode: fullscreen)',
  '(display-mode: window-controls-overlay)',
];

const checkStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (DISPLAY_MODES.some(q => window.matchMedia(q).matches)) return true;
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) {
    return true;
  }
  if (window.toolbar && window.toolbar.visible === false) return true;
  return false;
};

if (typeof window !== 'undefined') {
  standalone = checkStandalone();
  for (const q of DISPLAY_MODES) {
    window.matchMedia(q).addEventListener?.('change', () => {
      standalone = checkStandalone();
      notify();
    });
  }
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

const isSafariBrowser = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  if ('onbeforeinstallprompt' in window) return false;
  const ua = navigator.userAgent || '';
  return (
    /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|FxiOS|Firefox/.test(ua)
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

  // On Chromium browsers (`onbeforeinstallprompt` supported), the browser only
  // fires `beforeinstallprompt` when the PWA is NOT yet installed. If the app
  // is already installed on the machine (whether opened in the app window or a
  // tab), `canPromptNatively` is false and the Install row stays hidden. On
  // Safari (iOS / macOS), show the row only in a regular browser tab.
  const canInstall = !isInstalled && (canPromptNatively || isSafariBrowser());

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

  return { isInstalled, canInstall, canPromptNatively, promptInstall };
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
