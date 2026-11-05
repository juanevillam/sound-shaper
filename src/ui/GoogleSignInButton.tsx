import React from 'react';

import { AUTH_BUTTON_IOS, AuthButtonIos } from './AuthButtonIos';
import { GOOGLE_BUTTON_VARIANTS, GoogleGLogo } from './GoogleLogo';

export type GoogleSignInButtonProps = {
  /** Per the spec: "Sign in with Google" / "Continue with Google", localized. */
  label: string;
  onPress: () => void | Promise<void>;
  /** Picks the spec variant (light → white, dark → dark; both stroked). */
  scheme?: 'light' | 'dark';
  /** Names the spec row outright, overriding `scheme` — used beside Apple's
   *  button so the two share a pole (see `WelcomeScreen.ios`). */
  variant?: keyof typeof GOOGLE_BUTTON_VARIANTS;
  disabled?: boolean;
};

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
