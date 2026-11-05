import { StyleSheet, View } from 'react-native';

import {
  Button,
  ContentUnavailableView,
  Host,
  VStack,
} from '@expo/ui/swift-ui';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAppTheme } from '@/core';

import { type IconName } from './icons';

import { actionButtonModifiersIos } from './SheetFormIos';

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

export type EmptyStateProps = {
  /**
   * The Material Symbol drawn where iOS draws its `systemImage` — large and
   * muted, the same statement `ContentUnavailableView` opens with.
   */
  icon?: IconName;
  /**
   * iOS only — the SF Symbol its `ContentUnavailableView` draws. Accepted and
   * IGNORED here; this side names its Material twin via `icon`. Typed as the
   * iOS twin needs it, since that file takes this type rather than restating it.
   */
  systemImage?: SFSymbol;
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
