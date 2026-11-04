import { useEffect, useRef } from 'react';

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
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  cancel: string;
  confirm: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;

    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="confirm"
      onClose={onClose}
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
          className="pill is-destructive"
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
