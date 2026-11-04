import { useEffect, useSyncExternalStore } from 'react';

/**
 * The app's snackbar on the web: one line, standing low and centred, gone on
 * its own. Fired from anywhere — a save that closed its sheet still says so.
 */
let message: { text: string; id: number } | null = null;
const listeners = new Set<() => void>();
let next = 0;

export const showToast = (text: string) => {
  message = { text, id: (next += 1) };
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const DURATION_MS = 3200;

export function Toast() {
  const current = useSyncExternalStore(subscribe, () => message);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => {
      if (message?.id === current.id) {
        message = null;
        listeners.forEach(listener => listener());
      }
    }, DURATION_MS);
    return () => clearTimeout(timer);
  }, [current]);

  return (
    <div className="toast-slot" role="status" aria-live="polite">
      {current && (
        <p key={current.id} className="toast">
          {current.text}
        </p>
      )}
    </div>
  );
}
