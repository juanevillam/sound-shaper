import { StyleSheet, View } from 'react-native';

import {
  Button,
  ContentUnavailableView,
  Host,
  VStack,
} from '@expo/ui/swift-ui';

import type { SFSymbol } from 'sf-symbols-typescript';

import { useAppTheme } from '@/core';

import { actionButtonModifiersIos } from './SheetFormIos';

/**
 * EXTRA spacing above the CTA — deliberately NONE.
 *
 * The button cannot go in `ContentUnavailableView`'s own `actions` slot: the
 * wrapper exposes only title / systemImage / description (see
 * `docs/pending-upstream.md`), so it sits in a `VStack` BESIDE the view. That
 * means anything here is added ON TOP of the view's own trailing inset rather
 * than replacing it, and a `VStack` gap is the wrong tool for a relationship
 * Apple already spaces.
 *
 * MEASURED on iPhone 17 / iOS 26.5, description-ink to button-edge:
 *
 *   this at 20  →  57.0pt   the button read as detached from the message
 *   this at  0  →  37.0pt   the floor: the view's trailing inset plus the
 *                           button capsule's own padding, neither ours
 *
 * For scale, the view's LARGEST internal gap is icon→title at 23.7pt (and
 * title→description is 7.7). At 57 the CTA sat 2.4× the widest rhythm Apple
 * uses inside the view, which is what made it read as floating.
 *
 * So: add nothing, and let Apple's inset be the spacing. Kept as a named
 * constant rather than a bare `0` because the zero is a DECISION — the number
 * to change if the `actions` slot ever lands, at which point this whole VStack
 * goes away.
 */
const CTA_SPACING = 0;

type EmptyStateProps = {
  /** Android only — the Material Symbol its variant draws where this one
   *  draws `systemImage`. Accepted and ignored here. */
  icon?: string;
  /** iOS only. SF Symbol for the native `ContentUnavailableView`. */
  systemImage?: SFSymbol;
  title: string;
  subtitle?: string;
  /** Standard call-to-action below the text (see the Android variant). */
  action?: { label: string; onPress: () => void };
};

/**
 * iOS empty / error state — SwiftUI's own `ContentUnavailableView`, which is
 * exactly this surface; the Android twin's header says why it is one shared
 * component. Apple's typography, spacing, symbol weight and
 * secondary colours, plus Dynamic Type, instead of the RN column of emoji +
 * title + subtitle this used to hand-build with app type styles.
 *
 * THE CTA SITS BESIDE IT, NOT INSIDE IT. Real `ContentUnavailableView` takes an
 * `actions` ViewBuilder; the @expo/ui 57.0.7 wrapper exposes only `title`,
 * `systemImage` and `description` (checked in
 * `build/swift-ui/ContentUnavailableView/index.d.ts`; nor does any example
 * in the @expo/ui docs pass children). So the CTA is a sibling `Button` in the
 * same `VStack` — still a real SwiftUI control, and visually where Apple puts it,
 * just not slotted into the view. Tracked in docs/pending-upstream.md; when
 * `actions` lands, move the button inside and drop the VStack.
 *
 * THE EMOJI IS GONE on iOS, and that is the deliberate cost: `systemImage` is
 * typed `SFSymbol`, so 🗑️ / 🎉 / 🚫 cannot be shown. Each call site names the
 * symbol that carries the same meaning. The one that looked like a real loss —
 * an empty top showing the top's OWN emoji — is not: that emoji is already in
 * the nav-bar title right above it ("🎮 Games"), so it was decoration there,
 * not information. Android names a Material Symbol (`icon`) the same way.
 */
export function EmptyState({
  systemImage,
  title,
  subtitle,
  action,
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
                // Monochrome — see `actionButtonModifiersIos`, and
                // `labelColor` for why a filled capsule has to be told what
                // colour its own label is.
                tintColor: colors.onSurface,
                labelColor: colors.background,
                variant: 'prominent',
              })}
            />
          ) : null}
        </VStack>
      </Host>
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
