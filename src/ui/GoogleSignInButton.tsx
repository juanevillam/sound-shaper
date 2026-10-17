import React from 'react';

import {
  Host,
  Icon,
  OutlinedButton,
  Spacer,
  Text,
} from '@expo/ui/jetpack-compose';
import { alpha, fillMaxWidth, width } from '@expo/ui/jetpack-compose/modifiers';

import { GOOGLE_BUTTON_VARIANTS, GOOGLE_DISABLED_OPACITY } from './GoogleLogo';

const googleG = require('./assets/icons/google-g.xml');

const LOGO_SIZE = 20;
const LOGO_GAP = 10;
const GOOGLE_CONTENT_PADDING = 12;

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
 * "Continue with Google" per Google's branding guidelines, rendered as a real
 * Compose button so the ripple, pill shape, and Roboto Medium 14 label all
 * come from Material natively. Colors are pinned to the spec variants in
 * `GOOGLE_BUTTON_VARIANTS` instead of the app palette. Both spec variants
 * carry a gray stroke; expo-ui's `border()` modifier draws rectangles, so the
 * stroke comes from `OutlinedButton`'s native pill border — the THEMED
 * outline, which ButtonColors cannot override. Measured on the A54: light is
 * visually the spec gray; dark renders One UI's outline #44464E against the
 * spec's #8E918F — dimmer, accepted as the same themed-outline trade rather
 * than a missing stroke. The multicolor "G"
 * is a plain 4-path vector drawable rendered with `tint={null}` so its
 * mandated colors survive untinted.
 * iOS counterpart in `GoogleSignInButton.ios.tsx`; tsc resolves this base.
 */
export const GoogleSignInButton = ({
  label,
  onPress,
  scheme = 'light',
  variant,
  disabled = false,
}: GoogleSignInButtonProps) => {
  // Each mode takes the matching row of Google's table, exactly as iOS does —
  // the dark variant is a dark button (#131314 + stroke), not the light-gray
  // neutral slab, which on a dark welcome screen was the brightest thing on it
  // (Juan, 2026-09-08, retiring the frozen `neutral` mapping). Both variants
  // carry a stroke, so both render through `OutlinedButton`.
  const spec =
    GOOGLE_BUTTON_VARIANTS[variant ?? (scheme === 'dark' ? 'dark' : 'light')];

  return (
    <Host matchContents={{ vertical: true }} colorScheme={scheme}>
      <OutlinedButton
        onClick={onPress}
        enabled={!disabled}
        colors={{
          containerColor: spec.fill,
          contentColor: spec.label,
          disabledContainerColor: spec.fill,
          // The spec's disabled treatment is the label at 38% opacity — of
          // whichever label this variant carries, so it dims on the dark
          // button too instead of going near-black on near-black.
          disabledContentColor: `${spec.label}61`,
        }}
        // Google's branding guidelines give Android "12px left padding before
        // the Google logo, 10px right padding after the Google logo and 12px
        // right padding after the Sign in with Google text" (iOS has its own
        // 16 / 12 / 16). Material's own default is 24dp, so the spec padding is
        // set explicitly; the 10dp gap is the `LOGO_GAP` spacer below.
        contentPadding={{
          start: GOOGLE_CONTENT_PADDING,
          end: GOOGLE_CONTENT_PADDING,
        }}
        modifiers={[fillMaxWidth()]}
      >
        <Icon
          source={googleG}
          size={LOGO_SIZE}
          tint={null}
          modifiers={disabled ? [alpha(GOOGLE_DISABLED_OPACITY)] : undefined}
        />
        <Spacer modifiers={[width(LOGO_GAP)]} />
        <Text>{label}</Text>
      </OutlinedButton>
    </Host>
  );
};
