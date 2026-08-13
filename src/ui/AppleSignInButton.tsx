import React from 'react';

import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { BRAND_PRESSED_OPACITY } from './SquashPressable';
import { layout } from './tokens';

const BUTTON_HEIGHT = layout.authButtonHeight;

const DISABLED_OPACITY = 0.38;
// U+F8FF — the Apple logo glyph, shipped by every iOS system font. The
// button is only ever rendered on iOS (Sign in with Apple is App Store
// policy, not a cross-platform provider), so no image asset is needed.
const APPLE_LOGO = '';

// Apple's "Sign in with Apple" spec variants: black button on light
// backgrounds, white button on dark backgrounds. Content is always the
// opposite pole — never the app palette.
const APPLE_BUTTON_COLORS = {
  light: { fill: '#000000', label: '#FFFFFF' },
  dark: { fill: '#FFFFFF', label: '#000000' },
} as const;

export type AppleSignInButtonProps = {
  /** Per the spec: "Sign in with Apple" / "Continue with Apple", localized. */
  label: string;
  onPress: () => void | Promise<void>;
  /** Picks the spec variant (light → black button, dark → white button). */
  scheme?: 'light' | 'dark';
  disabled?: boolean;
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: BUTTON_HEIGHT / 2,
    flexDirection: 'row',
    gap: 8,
    height: BUTTON_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  logo: {
    fontSize: 18,
    lineHeight: 22,
  },
});

/**
 * "Continue with Apple" per Apple's Sign in with Apple guidelines — pill
 * shape matching `GoogleSignInButton.ios` so the two CTAs read as one
 * family, with spec-pinned black/white variants and the system-font Apple
 * logo glyph. Custom-drawn (guidelines allow it) so the pill radius and
 * height stay consistent with the Google button beside it.
 */
export const AppleSignInButton = ({
  label,
  onPress,
  scheme = 'light',
  disabled = false,
}: AppleSignInButtonProps) => {
  const spec = APPLE_BUTTON_COLORS[scheme];

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
          opacity: disabled
            ? DISABLED_OPACITY
            : pressed
              ? BRAND_PRESSED_OPACITY
              : 1,
        },
      ]}
    >
      {Platform.OS === 'ios' ? (
        <Text style={[styles.logo, { color: spec.label }]}>{APPLE_LOGO}</Text>
      ) : null}
      <Text style={[styles.label, { color: spec.label }]}>{label}</Text>
    </Pressable>
  );
};
