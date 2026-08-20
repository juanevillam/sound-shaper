import type { ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';

import {
  Button,
  ContentUnavailableView,
  Host,
  VStack,
} from '@expo/ui/swift-ui';
import { actionButtonModifiersIos } from '@portfolio/mobile-ui';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAppTheme } from '@/hooks/useAppTheme';

/**
 * EXTRA spacing above the CTA — deliberately NONE.
 *
 * The button cannot go in `ContentUnavailableView`'s own `actions` slot: the
 * @expo/ui wrapper exposes only title / systemImage / description (see
 * docs/pending-upstream.md), so it sits in a `VStack` BESIDE the view. That
 * means anything here is added ON TOP of the view's own trailing inset rather
 * than replacing it, and a `VStack` gap is the wrong tool for a relationship
 * Apple already spaces. Measured in Topper at 37.0pt with this at 0 and 57.0pt
 * with it at 20 — the latter 2.4× the widest rhythm the view uses internally,
 * which is what made the CTA read as floating.
 *
 * Kept as a named constant rather than a bare `0` because the zero is a
 * DECISION — the number to change if the `actions` slot ever lands, at which
 * point this whole VStack goes away.
 */
const CTA_SPACING = 0;

type EmptyStateProps = {
  /** Android only — the iOS variant draws `systemImage` instead. */
  emoji?: string;
  /** iOS only. SF Symbol for the native `ContentUnavailableView`. */
  systemImage?: SFSymbol;
  title: string;
  subtitle?: string;
  /** Standard call-to-action below the text (see the Android variant). */
  action?: { label: string; onPress: () => void };
  /** Extra RN content below the text (the Android variant takes Compose). */
  children?: ReactNode;
};

/**
 * iOS empty / error state — SwiftUI's own `ContentUnavailableView`, which is
 * exactly this surface. Apple's typography, spacing, symbol weight and
 * secondary colours, plus Dynamic Type, instead of the RN column of emoji +
 * title + subtitle this used to hand-build with app type styles. Same component
 * Topper's iOS screens use, so the two apps' error states are one surface.
 *
 * THE CTA SITS BESIDE IT, NOT INSIDE IT — see `CTA_SPACING`.
 *
 * THE EMOJI IS GONE on iOS, and that is the deliberate cost: `systemImage` is
 * typed `SFSymbol`, so 🎵 / 🚫 cannot be shown. Each call site names the symbol
 * that carries the same meaning. Android keeps every emoji, unchanged.
 */
export function EmptyState({
  systemImage,
  title,
  subtitle,
  action,
  children,
}: EmptyStateProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.centered}>
      <Host matchContents={{ vertical: true }} style={styles.host}>
        <VStack spacing={CTA_SPACING}>
          <ContentUnavailableView
            title={title}
            systemImage={systemImage}
            description={subtitle}
          />
          {action ? (
            <Button
              label={action.label}
              onPress={action.onPress}
              // The portfolio's own button, minus its Host — this CTA has to
              // live in the VStack beside the view, and a Host cannot nest.
              modifiers={actionButtonModifiersIos({
                tintColor: colors.primary,
                variant: 'prominent',
              })}
            />
          ) : null}
        </VStack>
      </Host>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // `ContentUnavailableView` centres itself in whatever width it gets, so the
  // host takes the full one.
  host: { width: '100%' },
});
