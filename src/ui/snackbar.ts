import { createContext, useContext } from 'react';

// An optional action button. When `onAction` runs (the user tapped the label,
// e.g. UNDO) the snackbar resolves WITHOUT committing. When the snackbar
// instead times out, is replaced, is swiped away, or unmounts, it resolves by
// COMMITTING — `onCommit` fires. That makes the snackbar a tiny transaction:
// show an optimistic result, let the user reverse it, otherwise make it
// permanent.
export type SnackbarAction = {
  label: string;
  onAction: () => void;
  onCommit?: () => void;
};

export type SnackbarContextValue = {
  showSnackbar: (message: string, action?: SnackbarAction) => void;
};

// The provider deliberately lives in each app (their snackbars have diverged);
// only the context and consumer hook are shared, so every app exposes the same
// `useSnackbar` surface.
export const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export const useSnackbar = () => {
  const context = useContext(SnackbarContext);

  if (!context)
    throw new Error('useSnackbar must be used within a SnackbarProvider');

  return context;
};
