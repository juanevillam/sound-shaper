import React from 'react';

import { SnackbarProvider as SharedSnackbarProvider } from '@portfolio/mobile-ui';

type SnackbarProviderProps = {
  children: React.ReactNode;
};

// The snackbar itself lives in @portfolio/mobile-ui so every app shows the same
// bar (Material 3 on Android, Liquid Glass capsule on iOS). This app floats it
// clear of the iOS Liquid Glass chrome that hovers inside the bottom safe area.
const BOTTOM_CHROME_INSET = 76;

const SnackbarProvider = ({ children }: SnackbarProviderProps) => (
  <SharedSnackbarProvider iosBottomInset={BOTTOM_CHROME_INSET}>
    {children}
  </SharedSnackbarProvider>
);

export { SnackbarProvider };
