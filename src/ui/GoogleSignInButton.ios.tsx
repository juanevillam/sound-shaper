import React from 'react';

import { Pressable, Text, View } from 'react-native';

import {
  AUTH_BUTTON_IOS,
  authButtonIosStyles as styles,
} from './authButtonIos';
import {
  GOOGLE_BUTTON_VARIANTS,
  GOOGLE_DISABLED_OPACITY,
  GoogleGLogo,
} from './GoogleLogo';
import { type GoogleSignInButtonProps } from './GoogleSignInButton';
import { BRAND_PRESSED_OPACITY } from './SquashPressable';

/**
 * iOS counterpart of `GoogleSignInButton` — same scheme-adaptive spec variants
 * (light → white, dark → dark, each with its spec stroke) and multicolor "G",
 * drawn with a plain Pressable since there is no Compose here. RN borders
 * follow the pill radius, so the light variant gets the spec's exact stroke.
 */
export const GoogleSignInButton = ({
  label,
  onPress,
  scheme = 'light',
  variant,
  disabled = false,
}: GoogleSignInButtonProps) => {
  // ALONE, iOS takes the matching row of Google's table in each mode — the
  // dark variant is a dark button (#131314 + #8E918F stroke), not the
  // light-gray neutral slab, so it reads as a control on a dark screen
  // instead of the brightest thing on it. Android maps the same way since
  // 2026-09-08. BESIDE APPLE the caller names the row (`variant`) so the two
  // buttons share a pole — see `WelcomeScreen.ios`.
  const spec =
    GOOGLE_BUTTON_VARIANTS[variant ?? (scheme === 'dark' ? 'dark' : 'light')];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: spec.fill,
          borderColor: spec.stroke ?? spec.fill,
          opacity: disabled
            ? GOOGLE_DISABLED_OPACITY
            : pressed
              ? BRAND_PRESSED_OPACITY
              : 1,
        },
      ]}
    >
      <View style={styles.logo}>
        <GoogleGLogo size={AUTH_BUTTON_IOS.logoSize} />
      </View>
      <Text style={[styles.label, { color: spec.label }]}>{label}</Text>
    </Pressable>
  );
};
