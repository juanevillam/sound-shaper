import React from 'react';

import { Pressable, StyleSheet, Text, View } from 'react-native';

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
 * `@expo/ui` native hosts, which may be implicated in the crash itself.
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
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.buttonLabel, { color: colors.onPrimary }]}>
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
  title: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    borderRadius: 24,
    marginTop: 24,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
