import { useCallback, useEffect, useState } from 'react';

import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useNavigation } from 'expo-router';

// Below this the list is "at rest" and the app bar stays flat; once content
// scrolls under it the bar gains its elevation shadow. Small, not zero, so a
// hair of rubber-band overscroll at the top doesn't flip it.
const ELEVATE_THRESHOLD = 4;

/**
 * Material 3 "elevated on scroll" top app bar. The header sits flat (no shadow)
 * while the list is at the top, then raises its elevation shadow once content
 * scrolls beneath it. Returns `scrolled` (also handy for collapsing an
 * extended FAB) and an `onScroll` handler to wire onto the screen's list.
 */
export const useHeaderScroll = () => {
  const navigation = useNavigation();
  const [scrolled, setScrolled] = useState(false);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = event.nativeEvent.contentOffset.y > ELEVATE_THRESHOLD;
      setScrolled(prev => (prev === next ? prev : next));
    },
    [],
  );

  useEffect(() => {
    navigation.setOptions({ headerShadowVisible: scrolled });
  }, [navigation, scrolled]);

  return { scrolled, onScroll };
};
