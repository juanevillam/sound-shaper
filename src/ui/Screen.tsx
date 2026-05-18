import React from 'react';

import { StyleSheet, View, type ViewProps } from 'react-native';

type ScreenProps = ViewProps & {
  backgroundColor?: string;
  children: React.ReactNode;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export const Screen = ({
  backgroundColor,
  children,
  style,
  ...rest
}: ScreenProps) => {
  return (
    <View
      style={[
        styles.container,
        backgroundColor ? { backgroundColor } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
};
