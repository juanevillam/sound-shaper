import React from 'react';

import { StyleSheet, View, type ViewProps } from 'react-native';

import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

type ScreenProps = ViewProps & {
  backgroundColor?: string;
  children: React.ReactNode;
  /**
   * Safe-area edges to guard. When set, the root is a `SafeAreaView`; when
   * omitted the root stays a plain `View` (the package's own screens manage
   * their insets themselves).
   */
  edges?: readonly Edge[];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export const Screen = ({
  backgroundColor,
  children,
  edges,
  style,
  ...rest
}: ScreenProps) => {
  const composedStyle = [
    styles.container,
    backgroundColor ? { backgroundColor } : null,
    style,
  ];

  if (edges) {
    return (
      <SafeAreaView edges={edges} style={composedStyle} {...rest}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <View style={composedStyle} {...rest}>
      {children}
    </View>
  );
};
