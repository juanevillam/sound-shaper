import React, { type ComponentType } from 'react';

import { Platform } from 'react-native';

import { Redirect } from 'expo-router';

/**
 * Guard for routes whose UI is SwiftUI-native (`@expo/ui/swift-ui`), or that
 * belong to a feature iOS has and Android does not yet.
 *
 * expo-router registers every plain `.tsx` route on BOTH platforms, and each
 * app's deep-link scheme makes them externally reachable — where rendering
 * SwiftUI host views would crash or blank. Off-platform, redirect to whatever
 * that app calls home.
 *
 * It lives here because both apps need it and it had already been written once:
 * Topper's copy came first, and the Acknowledgements and Credits routes needed
 * the identical thing in the starter. Each app keeps a one-line adapter that
 * supplies its own fallback route, the same shape the header buttons use.
 */
export const iosOnlyRoute = <P extends object>(
  Screen: ComponentType<P>,
  /** Where a non-iOS visitor lands instead — each app's home route. */
  fallback: string,
): ComponentType<P> => {
  if (Platform.OS === 'ios') return Screen;

  return function IOSOnlyRouteGuard() {
    // `Href` narrows to each app's own generated route union, which a package
    // compiled on its own cannot see; the caller's adapter is what keeps the
    // string honest.
    return (
      <Redirect href={fallback as Parameters<typeof Redirect>[0]['href']} />
    );
  };
};
