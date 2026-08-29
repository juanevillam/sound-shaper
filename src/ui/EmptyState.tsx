import type { ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';

import { Button, Column, Host, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

import { useAppTheme } from '@portfolio/core';

/**
 * THE EMPTY STATE'S OWN STEPS, exported for the one case that may not mount
 * this component: a surface that must RE-DRAW it in another container.
 *
 * `EmptyState` hosts its own Compose `Host`, and a Host inside another Host is
 * the nesting blow-up the RNHostView notes record — so a Compose bottom sheet
 * standing an empty state has to draw the parts itself. Sound Shaper's Clips
 * sheet does, and it had hand-copied all four numbers, which is the
 * "re-implement in another technology, import its constants" rule from the
 * root AGENTS.md pointing at exactly this shape. There is one caller today and
 * that is the point: the steps are stated here, and the copy is gone.
 */
export const EMPTY_STATE_STEPS = {
  emojiSize: 48,
  /** The mark-to-title and title-to-subtitle gap. */
  gap: 8,
  title: 'titleLarge',
  subtitle: 'bodyMedium',
} as const;

type EmptyStateProps = {
  emoji?: string;
  /**
   * iOS only — the SF Symbol its `ContentUnavailableView` draws. Accepted and
   * IGNORED here: Android keeps the emoji, which reads better against Material's
   * surfaces and needs no symbol vocabulary.
   */
  systemImage?: string;
  title: string;
  subtitle?: string;
  /**
   * Standard call-to-action below the text — the single affordance used for
   * "Try again" on error states and primary CTAs on empty states, so every
   * screen surfaces it identically. For bespoke content use `children`.
   */
  action?: { label: string; onPress: () => void };
  /** Extra Compose content below the text, e.g. a custom CTA Button. */
  children?: ReactNode;
};

/**
 * THE PORTFOLIO'S EMPTY / ERROR STATE, one component for every app.
 *
 * It lived in Topper and was PORTED into Sound Shaper on 2026-08-20, which is
 * exactly the drift AGENTS.md's "a surface solved in one app must be THE SAME
 * COMPONENT in the others" rule exists to end — the two copies were already 87%
 * identical on iOS and 96% on Android before either had been touched twice.
 *
 * It hosts its own Compose embed rather than taking an app's `ThemedHost`, and
 * reads the palette straight from `@portfolio/core` — each app's `useAppTheme`
 * is a pure re-export of that hook, so this is the same theme they resolve and
 * not a second one.
 *
 * The Host matches contents only VERTICALLY: a boolean `matchContents` sizes it
 * to the text's intrinsic single-line width, which can exceed the screen (text
 * never wraps, it just clips at the edges) — vertical-only keeps the width
 * constrained so subtitles wrap.
 */
export function EmptyState({
  emoji,
  title,
  subtitle,
  action,
  children,
}: EmptyStateProps) {
  const { colors, scheme, seedColor } = useAppTheme();

  return (
    <View style={styles.centered}>
      {/* The app-side `ThemedHost` this used to take is a `Host` with the
          resolved scheme forwarded; a package component can ask for the scheme
          itself. There is NO brand seed today (every portfolio app rides the
          platform-default palette), but it is forwarded so this stays ready if
          one ever returns. */}
      <Host
        colorScheme={scheme}
        seedColor={seedColor}
        style={styles.host}
        matchContents={{ vertical: true }}
      >
        <Column
          horizontalAlignment="center"
          verticalArrangement={{ spacedBy: EMPTY_STATE_STEPS.gap }}
          modifiers={[fillMaxWidth()]}
        >
          {emoji ? (
            <Text style={{ fontSize: EMPTY_STATE_STEPS.emojiSize }}>
              {emoji}
            </Text>
          ) : null}
          <Text
            color={colors.onSurface}
            style={{
              typography: EMPTY_STATE_STEPS.title,
              textAlign: 'center',
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              color={colors.onSurfaceMuted}
              style={{
                typography: EMPTY_STATE_STEPS.subtitle,
                textAlign: 'center',
              }}
            >
              {subtitle}
            </Text>
          ) : null}
          {action ? (
            <Button onClick={action.onPress}>
              <Text>{action.label}</Text>
            </Button>
          ) : null}
          {children}
        </Column>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  host: { width: '100%' },
});
