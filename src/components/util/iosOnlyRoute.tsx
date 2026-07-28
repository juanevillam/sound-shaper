import { type ComponentType } from 'react';

import { Platform } from 'react-native';

import { Redirect } from 'expo-router';

/**
 * Guard for routes whose UI is iOS-native (the form-sheet routes). Android
 * never navigates to them in-app (it mounts Compose sheets instead), but
 * expo-router registers every plain .tsx route on BOTH platforms, and the
 * `soundshaper` deep-link scheme makes them externally reachable — where the
 * iOS-shaped surfaces would render wrong. Off-platform, redirect home.
 */
export const iosOnlyRoute = <P extends object>(
  Screen: ComponentType<P>,
): ComponentType<P> => {
  if (Platform.OS === 'ios') return Screen;

  return function IOSOnlyRouteGuard() {
    return <Redirect href="/home" />;
  };
};
