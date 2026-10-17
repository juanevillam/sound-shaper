import React, { type ReactNode } from 'react';

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GOOGLE_BUTTON_VARIANTS, GOOGLE_DISABLED_OPACITY } from './GoogleLogo';
import { BRAND_PRESSED_OPACITY } from './SquashPressable';
import { layout } from './tokens';

/**
 * THE iOS SIGN-IN PAIR SHARES ONE MOLD (Juan, 2026-10-16). Side by side,
 * Apple's system button and our Google button disagreed on everything a
 * person compares at a glance — two whites (#FFFFFF against Google's neutral
 * #F2F2F2), two typefaces, two text sizes, two logo sizes — and read as two
 * products. Both buttons are this one component, and only their logos and
 * words differ.
 *
 * Both brands allow it. Apple permits a custom Sign in with Apple button in
 * black or white, with the system font and any corner; Google's rows are
 * fixed, so the PAIR takes Google's rows and Apple wears the same one — the
 * light row is white with a hairline (Apple's own "white with outline"
 * style), the dark row near-black. Black on a dark screen is the one thing
 * Apple forbids, so the pole is set by the appearance: dark row on a light
 * screen, white row on a dark one.
 *
 * THE TYPE IS 17 MEDIUM, between the two specs on purpose: Google's is 14
 * (Roboto Medium, at 40pt) and Apple's ~43% of the height (~19 at 44). 17 is
 * iOS's own button size, and neither brand's button looks borrowed at it.
 */
export const AUTH_BUTTON_IOS = {
  height: layout.authButtonHeight,
  logoSize: 20,
  /** Google's iOS figures: 16 before the logo, 12 after it, 16 after the text. */
  logoGap: 12,
  padding: 16,
} as const;

type AuthButtonSpec = { fill: string; stroke: string; label: string };

/** The pair's pole: Google's dark row on a light screen, its light one on a
 *  dark screen. The ONE place the pairing is decided — both buttons and the
 *  welcome screen read it from here. */
export const authButtonPoleKey = (scheme: 'light' | 'dark') =>
  scheme === 'dark' ? 'light' : 'dark';

export const authButtonPole = (scheme: 'light' | 'dark'): AuthButtonSpec =>
  GOOGLE_BUTTON_VARIANTS[authButtonPoleKey(scheme)];

export type AuthButtonIosProps = {
  label: string;
  /** The brand's mark, drawn to fit `AUTH_BUTTON_IOS.logoSize`. */
  logo: ReactNode;
  spec: AuthButtonSpec;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
};

export const AuthButtonIos = ({
  label,
  logo,
  spec,
  onPress,
  disabled = false,
}: AuthButtonIosProps) => (
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
        opacity: disabled
          ? // Google's disabled figure; the pair takes it the way it takes
            // Google's rows (Apple publishes none for a custom button).
            GOOGLE_DISABLED_OPACITY
          : pressed
            ? BRAND_PRESSED_OPACITY
            : 1,
      },
    ]}
  >
    <View style={styles.logo}>{logo}</View>
    <Text style={[styles.label, { color: spec.label }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: AUTH_BUTTON_IOS.height / 2,
    borderWidth: 1,
    flexDirection: 'row',
    gap: AUTH_BUTTON_IOS.logoGap,
    height: AUTH_BUTTON_IOS.height,
    justifyContent: 'center',
    paddingHorizontal: AUTH_BUTTON_IOS.padding,
  },
  label: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 22,
  },
  logo: {
    alignItems: 'center',
    height: AUTH_BUTTON_IOS.logoSize,
    justifyContent: 'center',
    width: AUTH_BUTTON_IOS.logoSize,
  },
});
