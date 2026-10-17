// The snackbar context + consumer hook live in `src/ui` (only the
// provider is app-specific). Re-exported here to keep the app's
// `@/hooks/useSnackbar` import path stable.
export { useSnackbar } from '@/ui';
