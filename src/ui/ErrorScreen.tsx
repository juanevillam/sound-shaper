import React from 'react';

import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PRESSED_OPACITY } from './SquashPressable';

export type ErrorScreenColors = {
  background: string;
  onSurface: string;
  onSurfaceMuted: string;
  primary: string;
  onPrimary: string;
};

export type ErrorScreenProps = {
  title: string;
  message: string;
  retryLabel: string;
  onRetry: () => void;
  colors: ErrorScreenColors;
};

/**
 * Full-screen fallback rendered by an expo-router `ErrorBoundary` when a route
 * throws. Deliberately pure React Native — a crash screen must not depend on
 * `@expo/ui` native hosts, which may be implicated in the crash itself — but
 * styled to each platform's error-state idiom: Material 3 type roles + filled
 * button with ripple on Android, `ContentUnavailableView` metrics + borderless
 * tinted action on iOS. The system font already gives Roboto/SF per platform.
 */
export const ErrorScreen = ({
  title,
  message,
  retryLabel,
  onRetry,
  colors,
}: ErrorScreenProps) => {
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.onSurfaceMuted }]}>
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        android_ripple={{ color: `${colors.onPrimary}33` }}
        style={({ pressed }) => [
          styles.button,
          Platform.OS === 'android'
            ? { backgroundColor: colors.primary }
            : pressed && styles.buttonPressedIos,
        ]}
      >
        <Text
          style={[
            styles.buttonLabel,
            {
              color:
                Platform.OS === 'android' ? colors.onPrimary : colors.primary,
            },
          ]}
        >
          {retryLabel}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  // Android: M3 headlineSmall (24/32, regular). iOS: title2 bold, the
  // ContentUnavailableView headline.
  title: {
    textAlign: 'center',
    ...Platform.select({
      android: { fontSize: 24, fontWeight: '400', lineHeight: 32 },
      default: { fontSize: 22, fontWeight: '700' },
    }),
  },
  // Android: M3 bodyMedium (14/20, +0.25). iOS: subheadline (15) secondary.
  message: {
    marginTop: 8,
    textAlign: 'center',
    ...Platform.select({
      android: { fontSize: 14, letterSpacing: 0.25, lineHeight: 20 },
      default: { fontSize: 15, lineHeight: 20 },
    }),
  },
  // Android: M3 filled button (40dp, full-round, 24dp side padding); the fill
  // color comes inline so the ripple can sit on it. iOS: borderless tinted
  // action, so no chrome — just the label with the standard press dim.
  button: {
    justifyContent: 'center',
    marginTop: 24,
    ...Platform.select({
      android: {
        borderRadius: 20,
        minHeight: 40,
        overflow: 'hidden',
        paddingHorizontal: 24,
      },
      default: { minHeight: 44, paddingHorizontal: 16 },
    }),
  },
  buttonPressedIos: { opacity: PRESSED_OPACITY },
  // Android: M3 labelLarge (14, medium, +0.1). iOS: semibold subheadline, the
  // App Store / Wi-Fi settings "Retry" idiom.
  buttonLabel: {
    textAlign: 'center',
    ...Platform.select({
      android: { fontSize: 14, fontWeight: '500', letterSpacing: 0.1 },
      default: { fontSize: 15, fontWeight: '600' },
    }),
  },
});
