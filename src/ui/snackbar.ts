import { createContext, useContext, type ReactNode } from 'react';

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

/**
 * WHO THE TOAST BELONGS TO. `host` (the default) binds it to the surface it
 * was fired on: it renders THERE and only there, and if that surface is
 * dismissed the toast dies with it — feedback about a sheet's action has no
 * business outliving the sheet, and re-parenting it into whatever is behind
 * was a visible flicker-and-jump (Juan, 2026-08-27). `app` is for the one
 * legitimate exception: a toast fired as part of CLOSING its surface (a
 * save that dismisses the editor), which is addressed to whoever remains —
 * when its host goes, it re-homes to the new top surface with a fresh
 * entrance instead of dying.
 */
export type SnackbarScope = 'host' | 'app';

export type SnackbarOptions = {
  scope?: SnackbarScope;
};

export type SnackbarContextValue = {
  showSnackbar: (
    message: string,
    action?: SnackbarAction,
    options?: SnackbarOptions,
  ) => void;
  /**
   * THE TOAST ITSELF, so a surface presented ABOVE the app's root can render
   * it instead of the root doing so. See `SnackbarOutlet`.
   */
  toast: ReactNode;
  /**
   * `SnackbarOutlet` claims/releases through these. An outlet states its own
   * bottom clearance AT CLAIM TIME (a sheet has no tab bar to clear), so the
   * toast's very first frame uses the right inset — an effect-pushed inset
   * arrives one render late, which is a one-frame jump.
   */
  claimOutlet: (id: number, iosBottomInset?: number) => void;
  releaseOutlet: (id: number) => void;
  /**
   * The outlet the CURRENT toast is bound to — `null` means the root. Set at
   * show time to whatever surface is topmost, and never re-pointed by other
   * surfaces mounting above (a covered toast stays put rather than climbing).
   */
  boundOutlet: number | null;
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
