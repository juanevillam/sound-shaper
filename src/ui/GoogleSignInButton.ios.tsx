import React from 'react';

import { Pressable, StyleSheet, Text } from 'react-native';

import {
  GOOGLE_BUTTON_VARIANTS,
  GOOGLE_DISABLED_OPACITY,
  GoogleGLogo,
} from './GoogleLogo';
import { type GoogleSignInButtonProps } from './GoogleSignInButton';
import { BRAND_PRESSED_OPACITY } from './SquashPressable';
import { layout } from './tokens';

const BUTTON_HEIGHT = layout.authButtonHeight;
const LOGO_SIZE = 20;

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: BUTTON_HEIGHT / 2,
    flexDirection: 'row',
    // Google's branding guidelines give iOS its own padding figures (Android
    // and web use 12 / 10 / 12): "16px left padding before the Google logo,
    // 12px right padding after the Google logo and 16px right padding after
    // the Sign in with Google text".
    gap: 12,
    height: BUTTON_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    // Spec wants Roboto Medium; iOS substitutes the system font at the same
    // weight (Google's own iOS guidance allows the platform font).
    fontWeight: '500',
  },
});

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
  disabled = false,
}: GoogleSignInButtonProps) => {
  // iOS takes the matching row of Google's table in each mode — the dark
  // variant is a dark button (#131314 + #8E918F stroke), not the light-gray
  // neutral slab, so it reads as a control on a dark screen instead of the
  // brightest thing on it. Android maps the same way since 2026-09-08.
  const spec = GOOGLE_BUTTON_VARIANTS[scheme === 'dark' ? 'dark' : 'light'];

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
          borderColor: spec.stroke,
          borderWidth: spec.stroke ? 1 : 0,
          opacity: disabled
            ? GOOGLE_DISABLED_OPACITY
            : pressed
              ? BRAND_PRESSED_OPACITY
              : 1,
        },
      ]}
    >
      <GoogleGLogo size={LOGO_SIZE} />
      <Text style={[styles.label, { color: spec.label }]}>{label}</Text>
    </Pressable>
  );
};
