import { useEffect, useRef, useState } from 'react';

const CLOSE_MS = 220;

/**
 * Keeps a native `<dialog>` open for `CLOSE_MS` with `.is-closing` while its
 * exit animation plays, and intercepts `Escape` (`onCancel`) so keyboard
 * dismissal animates out with the same transition as clicking Cancel.
 */
export function useModalDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = ref.current;

    if (!dialog) return;
    if (open) {
      setClosing(false);
      if (!dialog.open) dialog.showModal();
      return;
    }

    if (!dialog.open) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      dialog.close();
      return;
    }

    setClosing(true);
    const timer = window.setTimeout(() => {
      setClosing(false);
      if (dialog.open) dialog.close();
    }, CLOSE_MS);

    return () => window.clearTimeout(timer);
  }, [open]);

  return { ref, closing };
}

/**
 * A yes/no question, in the site's own language rather than a copy of an OS
 * alert: a card on the hairline, the title, the sentence under it, and two
 * pills. It is a real `<dialog>`, so the browser owns the top layer, the
 * focus trap and Escape.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  cancel,
  confirm,
  destructive = true,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  cancel: string;
  confirm: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { ref, closing } = useModalDialog(open);

  return (
    <dialog
      ref={ref}
      className={closing ? 'confirm is-closing' : 'confirm'}
      onCancel={e => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={e => {
        // A click on the backdrop lands on the dialog itself.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="confirm-actions">
        <button type="button" className="pill" onClick={onClose}>
          {cancel}
        </button>
        <button
          type="button"
          className={destructive ? 'pill is-destructive' : 'pill is-primary'}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirm}
        </button>
      </div>
    </dialog>
  );
}
