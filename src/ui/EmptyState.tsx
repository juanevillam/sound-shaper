import { StyleSheet, View } from 'react-native';

import { Button, Column, Host, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import { useAppTheme } from '@/core';

import { AppIcon } from './AppIcon';
import type { IconName } from './icons';

/**
 * THE EMPTY STATE'S OWN STEPS, exported for the one case that may not mount
 * this component: a surface that must RE-DRAW it in another container.
 *
 * `EmptyState` hosts its own Compose `Host`, and a Host inside another Host is
 * the nesting blow-up the RNHostView notes record — so a Compose bottom sheet
 * standing an empty state has to draw the parts itself. The Clips sheet does,
 * and it had hand-copied all four numbers, which is the "re-implement in
 * another technology, import its constants" rule in `docs/standards.md`
 * pointing at exactly this shape. There is one caller today and
 * that is the point: the steps are stated here, and the copy is gone.
 */
export const EMPTY_STATE_STEPS = {
  iconSize: 48,
  /** The mark-to-title and title-to-subtitle gap. */
  gap: 8,
  /** EXTRA gap the icon opens above the title, on top of `gap` — the mark is
   *  a different kind of statement from the text and Apple's own
   *  `ContentUnavailableView` spaces it that way (icon→title 23.7pt against
   *  title→description 7.7, measured). 8 + 8 lands 16, the Material grid's
   *  nearest rhythm. */
  iconGap: 8,
  /** EXTRA gap above the CTA, on top of `gap` — a button pressed right up
   *  against the description reads as part of the prose. iOS gets 37pt of
   *  clearance from Apple's own trailing inset; 8 + 16 is the Material-grid
   *  equivalent. */
  ctaGap: 16,
  title: 'titleLarge',
  subtitle: 'bodyMedium',
} as const;

type EmptyStateProps = {
  /**
   * The Material Symbol drawn where iOS draws its `systemImage` — large and
   * muted, the same statement `ContentUnavailableView` opens with.
   */
  icon?: IconName;
  /**
   * iOS only — the SF Symbol its `ContentUnavailableView` draws. Accepted and
   * IGNORED here; this side names its Material twin via `icon`.
   */
  systemImage?: string;
  title: string;
  subtitle?: string;
  /**
   * Standard call-to-action below the text — the single affordance used for
   * "Try again" on error states and primary CTAs on empty states, so every
   * screen surfaces it identically.
   */
  action?: { label: string; onPress: () => void };
};

/**
 * THE EMPTY / ERROR STATE — one component for every screen that has one.
 *
 * It lived in Topper and was PORTED into Sound Shaper on 2026-08-20, which is
 * exactly the drift `docs/standards.md`'s "a surface solved in one app must be
 * THE SAME COMPONENT in the others" rule exists to end — the two copies were
 * already 87% identical on iOS and 96% on Android before either had been
 * touched twice.
 *
 * It hosts its own Compose embed rather than taking the app's `ThemedHost`, and
 * reads the palette from `useAppTheme` (`@/core`) — the one theme every screen
 * resolves, not a second one.
 *
 * The Host matches contents only VERTICALLY: a boolean `matchContents` sizes it
 * to the text's intrinsic single-line width, which can exceed the screen (text
 * never wraps, it just clips at the edges) — vertical-only keeps the width
 * constrained so subtitles wrap.
 */
export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  const { colors, scheme } = useAppTheme();

  return (
    <View style={styles.centered}>
      {/* The app-side `ThemedHost` this used to take is a `Host` with the
          resolved scheme forwarded; a package component can ask for the scheme
          itself. There is NO brand seed (the app rides the platform-default
          palette); forwarding the scheme is what keeps the Compose embed's
          appearance in step with the app's. */}
      <Host
        colorScheme={scheme}
        style={styles.host}
        matchContents={{ vertical: true }}
      >
        <Column
          horizontalAlignment="center"
          verticalArrangement={{ spacedBy: EMPTY_STATE_STEPS.gap }}
          modifiers={[fillMaxWidth()]}
        >
          {icon ? (
            <AppIcon
              name={icon}
              size={EMPTY_STATE_STEPS.iconSize}
              tint={colors.onSurfaceMuted}
              modifiers={[padding(0, 0, 0, EMPTY_STATE_STEPS.iconGap)]}
            />
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
            // MONOCHROME, the same mapping the welcome CTA and the iOS twin
            // carry: a filled button's colour is inherited (Material fills it
            // with the accent because that is the default), so it takes the
            // ink. Material inverts the label itself — `contentColor` is a
            // real role on the container, no `labelColor` trap here.
            <Button
              onClick={action.onPress}
              colors={{
                containerColor: colors.onSurface,
                contentColor: colors.background,
              }}
              modifiers={[padding(0, EMPTY_STATE_STEPS.ctaGap, 0, 0)]}
            >
              <Text>{action.label}</Text>
            </Button>
          ) : null}
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
