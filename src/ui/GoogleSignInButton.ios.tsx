import React from 'react';

import { Pressable, StyleSheet, Text } from 'react-native';

import {
  GOOGLE_BUTTON_COLORS,
  GOOGLE_DISABLED_OPACITY,
  GoogleGLogo,
} from './GoogleLogo';
import { type GoogleSignInButtonProps } from './GoogleSignInButton';

const BUTTON_HEIGHT = 40;
const LOGO_SIZE = 20;
const PRESSED_OPACITY = 0.7;

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: BUTTON_HEIGHT / 2,
    flexDirection: 'row',
    gap: 10,
    height: BUTTON_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
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
 * (light → white + exact spec stroke, dark → neutral gray) and multicolor "G",
 * drawn with a plain Pressable since there is no Compose here. RN borders
 * follow the pill radius, so the light variant gets the spec's exact stroke.
 */
export const GoogleSignInButton = ({
  label,
  onPress,
  scheme = 'light',
  disabled = false,
}: GoogleSignInButtonProps) => {
  const spec = GOOGLE_BUTTON_COLORS[scheme];

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
              ? PRESSED_OPACITY
              : 1,
        },
      ]}
    >
      <GoogleGLogo size={LOGO_SIZE} />
      <Text style={[styles.label, { color: spec.label }]}>{label}</Text>
    </Pressable>
  );
};
