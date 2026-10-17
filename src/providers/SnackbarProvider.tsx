// The snackbar itself lives in `src/ui` (Material 3 on Android, a Liquid Glass
// capsule on iOS), and stands in the same place on every screen — its bottom
// clearance is `SNACKBAR_BOTTOM_CLEARANCE`, derived from the now-playing
// banner's box. Re-exported here for the root layout's import.
export { SnackbarProvider } from '@/ui';
