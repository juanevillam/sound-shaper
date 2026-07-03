import React from 'react';

import {
  Button,
  Host,
  Icon,
  OutlinedButton,
  Spacer,
  Text,
} from '@expo/ui/jetpack-compose';
import { alpha, fillMaxWidth, width } from '@expo/ui/jetpack-compose/modifiers';

import {
  GOOGLE_BUTTON_COLORS,
  GOOGLE_DISABLED_LABEL,
  GOOGLE_DISABLED_OPACITY,
} from './GoogleLogo';

const googleG = require('./assets/icons/google-g.xml');

const LOGO_SIZE = 20;
const LOGO_GAP = 10;

export type GoogleSignInButtonProps = {
  /** Per the spec: "Sign in with Google" / "Continue with Google", localized. */
  label: string;
  onPress: () => void | Promise<void>;
  /** Picks the spec variant (light → white + stroke, dark → neutral gray). */
  scheme?: 'light' | 'dark';
  disabled?: boolean;
};

/**
 * "Continue with Google" per Google's branding guidelines, rendered as a real
 * Compose button so the ripple, pill shape, and Roboto Medium 14 label all
 * come from Material natively. Colors are pinned to the spec variants in
 * `GOOGLE_BUTTON_COLORS` instead of the app palette. In light mode the spec's
 * white variant needs its gray stroke; expo-ui's `border()` modifier draws
 * rectangles, so the stroke comes from `OutlinedButton`'s native pill border
 * (themed outline — visually equivalent to the spec gray). The multicolor "G"
 * is a plain 4-path vector drawable rendered with `tint={null}` so its
 * mandated colors survive untinted.
 * iOS counterpart in `GoogleSignInButton.ios.tsx`; tsc resolves this base.
 */
export const GoogleSignInButton = ({
  label,
  onPress,
  scheme = 'light',
  disabled = false,
}: GoogleSignInButtonProps) => {
  const spec = GOOGLE_BUTTON_COLORS[scheme];
  const ButtonComponent = scheme === 'dark' ? Button : OutlinedButton;

  return (
    <Host matchContents={{ vertical: true }} colorScheme={scheme}>
      <ButtonComponent
        onClick={onPress}
        enabled={!disabled}
        colors={{
          containerColor: spec.fill,
          contentColor: spec.label,
          disabledContainerColor: spec.fill,
          disabledContentColor: GOOGLE_DISABLED_LABEL,
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
      </ButtonComponent>
    </Host>
  );
};
