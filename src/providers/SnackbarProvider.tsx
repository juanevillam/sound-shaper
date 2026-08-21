// The snackbar itself lives in @portfolio/mobile-ui so every app shows the same
// bar (Material 3 on Android, Liquid Glass capsule on iOS) IN THE SAME PLACE —
// its bottom clearance is the package's `SNACKBAR_BOTTOM_CLEARANCE`, not this
// app's to state, even though this app's now-playing banner is the chrome that
// set the number. Re-exported here to keep the app's
// `@/providers/SnackbarProvider` import path stable.
export { SnackbarProvider } from '@portfolio/mobile-ui';
