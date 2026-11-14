import { useRef } from 'react';

import { useModalDialog } from './ConfirmDialog';

export type SheetAction = {
  label: string;
  destructive?: boolean;
  onSelect: () => void;
};

/**
 * The app's action sheet (`ActionSheetIOS`): a card of choices and, apart
 * from it, Cancel. It is how the app asks what to do with a picture that is
 * already there — Change or Remove — so the slot carries ONE caption instead
 * of two buttons. A phone gets it at the bottom, where iOS puts it; a desk
 * gets it centred, where its confirmations already stand.
 *
 * A real `<dialog>`: the browser owns the top layer, the focus trap and
 * Escape. A choice runs inside the click that picked it, so one that opens a
 * file picker still has the user activation the browser asks for.
 */
export function ActionSheet({
  open,
  actions,
  cancel,
  onClose,
}: {
  open: boolean;
  actions: SheetAction[];
  cancel: string;
  onClose: () => void;
}) {
  const { ref, closing } = useModalDialog(open);
  const shownActions = useRef(actions);
  if (open && actions.length > 0) shownActions.current = actions;
  const viewActions = open ? actions : shownActions.current;

  return (
    <dialog
      ref={ref}
      className={closing ? 'action-sheet is-closing' : 'action-sheet'}
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
      <div className="action-group">
        {viewActions.map(action => (
          <button
            key={action.label}
            type="button"
            className={action.destructive ? 'is-destructive' : undefined}
            onClick={() => {
              onClose();
              action.onSelect();
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="action-group">
        <button type="button" className="is-cancel" onClick={onClose}>
          {cancel}
        </button>
      </div>
    </dialog>
  );
}
