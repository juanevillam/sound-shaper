import React from 'react';

import { AUTH_BUTTON_IOS, AuthButtonIos } from './AuthButtonIos';
import { GOOGLE_BUTTON_VARIANTS, GoogleGLogo } from './GoogleLogo';
import { type GoogleSignInButtonProps } from './GoogleSignInButton';

/**
 * iOS counterpart of `GoogleSignInButton` — the spec rows and multicolor "G"
 * on the shared `AuthButtonIos`, since there is no Compose here.
 */
export const GoogleSignInButton = ({
  label,
  onPress,
  scheme = 'light',
  variant,
  disabled = false,
}: GoogleSignInButtonProps) => {
  // ALONE, iOS takes the matching row of Google's table in each mode — the
  // dark variant is a dark button (#131314 + #8E918F stroke), so it reads as
  // a control on a dark screen instead of the brightest thing on it. Android
  // maps the same way since 2026-09-08. BESIDE APPLE the caller names the row
  // (`variant`, from `authButtonPoleKey`) so the two buttons share a pole.
  const spec =
    GOOGLE_BUTTON_VARIANTS[variant ?? (scheme === 'dark' ? 'dark' : 'light')];

  return (
    <AuthButtonIos
      label={label}
      spec={spec}
      disabled={disabled}
      onPress={onPress}
      logo={<GoogleGLogo size={AUTH_BUTTON_IOS.logoSize} />}
    />
  );
};
