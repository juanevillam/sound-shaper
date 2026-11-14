import { useEffect, useSyncExternalStore } from 'react';

/**
 * The app's snackbar on the web: one line, standing low and centred, gone on
 * its own. Fired from anywhere — a save that closed its sheet still says so.
 */
type ToastMessage = {
  text: string;
  id: number;
  leaving?: boolean;
  actionLabel?: string;
  onAction?: () => void;
};

let message: ToastMessage | null = null;
const listeners = new Set<() => void>();
let next = 0;

const DURATION_MS = 3200;
const EXIT_MS = 200;

export const showToast = (
  text: string,
  action?: { label: string; onAction: () => void },
) => {
  message = {
    text,
    id: (next += 1),
    actionLabel: action?.label,
    onAction: action?.onAction,
  };
  listeners.forEach(listener => listener());
};

const clearToast = () => {
  message = null;
  listeners.forEach(listener => listener());
};

const leaveToast = (id: number) => {
  if (!message || message.id !== id || message.leaving) return;
  message = { ...message, leaving: true };
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function Toast() {
  const current = useSyncExternalStore(subscribe, () => message);

  useEffect(() => {
    if (!current) return;
    if (current.leaving) {
      const exit = setTimeout(() => {
        if (message?.id === current.id) clearToast();
      }, EXIT_MS);
      return () => clearTimeout(exit);
    }
    const timer = setTimeout(
      () => leaveToast(current.id),
      current.onAction ? 5000 : DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [current]);

  return (
    <div className="toast-slot" role="status" aria-live="polite">
      {current && (
        <div
          key={current.id}
          className={current.leaving ? 'toast is-leaving' : 'toast'}
        >
          <span>{current.text}</span>
          {current.actionLabel && current.onAction && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                const fn = current.onAction;
                leaveToast(current.id);
                fn?.();
              }}
            >
              {current.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
