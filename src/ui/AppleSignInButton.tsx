import React from 'react';

import Svg, { Path } from 'react-native-svg';

import {
  AUTH_BUTTON_IOS,
  AuthButtonIos,
  authButtonPole,
} from './AuthButtonIos';

// Apple's logo, its published proportions (814 × 1000). Drawn as a path so it
// can stand in the same 20pt box as Google's "G" — the system-font glyph
// (U+F8FF) it replaced rendered a fixed fraction of its font size and read
// smaller than the "G" beside it.
const APPLE_LOGO_PATH =
  'M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z';
// A hair under the box: the logo's leaf makes it read taller than a circle of
// the same height.
const APPLE_LOGO_HEIGHT = AUTH_BUTTON_IOS.logoSize - 1;

export type AppleSignInButtonProps = {
  /** Per the spec: "Sign in with Apple" / "Continue with Apple", localized. */
  label: string;
  onPress: () => void | Promise<void>;
  /** Picks the pair's pole — see `AuthButtonIos`. */
  scheme?: 'light' | 'dark';
  disabled?: boolean;
};

/**
 * "Continue with Apple" — a custom button within Apple's guidelines (system
 * font, black or white, Apple's logo), the same `AuthButtonIos` as
 * `GoogleSignInButton.ios` so the pair reads as one family.
 */
export const AppleSignInButton = ({
  label,
  onPress,
  scheme = 'light',
  disabled = false,
}: AppleSignInButtonProps) => {
  const spec = authButtonPole(scheme);

  return (
    <AuthButtonIos
      label={label}
      spec={spec}
      disabled={disabled}
      onPress={onPress}
      logo={
        <Svg
          width={(APPLE_LOGO_HEIGHT * 814) / 1000}
          height={APPLE_LOGO_HEIGHT}
          viewBox="0 0 814 1000"
        >
          <Path d={APPLE_LOGO_PATH} fill={spec.label} />
        </Svg>
      }
    />
  );
};
