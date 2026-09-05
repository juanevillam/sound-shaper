import { StyleSheet, View } from 'react-native';

import { CircularWavyProgressIndicator, Host } from '@expo/ui/jetpack-compose';

import { useAppTheme } from '@portfolio/core';

/**
 * THE INDETERMINATE SPINNER — Android. The twin of `ProgressViewIos`, which
 * holds the whole argument: when a spinner wins over a bone ("Waiting has two
 * shapes" in the root AGENTS.md), why the box is STATED rather than matched
 * (a `matchContents` host answers after layout — the async-answer family),
 * and why there is deliberately no size knob.
 *
 * The box is M3's own: a `CircularProgressIndicator` is a 40dp control
 * (Compose's `CircularIndicatorDiameter` 38dp + stroke padding), so 40 is the
 * value the platform draws and not a number of ours. Like the iOS twin it
 * centres itself in whatever frame it is handed — both are things `StateWrap`
 * hands a full screen to, and stood without that they render top-left.
 *
 * The Host carries the resolved scheme itself (the same move `EmptyState`
 * makes): a package component cannot take an app's `ThemedHost`, and the
 * indicator draws from the native Material scheme, which already IS the
 * palette every RN-side colour resolves from.
 */
const SPINNER_BOX = 40;

export function ProgressView() {
  const { scheme, seedColor } = useAppTheme();

  return (
    <View style={styles.center}>
      <Host
        colorScheme={scheme}
        seedColor={seedColor}
        style={styles.box}
        matchContents
      >
        {/* The WAVY variant — M3 Expressive's indeterminate face, and Juan's
            call for every Android loading indicator (2026-09-04); the custom
            pull-to-refresh already draws the expressive ContainedLoadingIndicator. */}
        <CircularWavyProgressIndicator />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  box: { height: SPINNER_BOX, width: SPINNER_BOX },
});
