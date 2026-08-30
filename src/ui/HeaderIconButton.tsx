import { Host, IconButton } from '@expo/ui/jetpack-compose';

import { useAppTheme } from '@portfolio/core';

import { AppIcon } from './AppIcon';
import type { IconName } from './icons';

/**
 * AN ACTION IN THE NAVIGATOR'S OWN APP BAR — Android's twin of
 * `HeaderGlyphButtonIos`, and the only way any of the three apps should put a
 * glyph in a header.
 *
 * A real Compose `IconButton`, so the glyph, the 48dp touch target and the
 * RIPPLE are the platform's rather than ours.
 *
 * ITS BOX IS STATED, AND THAT IS THE WHOLE POINT OF THIS COMPONENT. Every
 * copy of this pattern in the portfolio hosted the button with
 * `matchContents`, which shrink-wraps the `Host` to the GLYPH — so Compose drew
 * the ripple into a 24dp box and it was clipped out of existence. Measured on a
 * Galaxy A54 against the navigator's own back arrow, which is native and
 * correct:
 *
 *   native back      ripple 39.4dp across, 9546 px changed, delta 46/255
 *   matchContents    "ripple" 16-20dp across, ~600-1600 px, delta 26/255
 *                    — i.e. the glyph dimming, and nothing else
 *
 * So the header buttons had no press feedback at all, only a glyph that got
 * slightly darker, on every Android screen in every app. The base
 * `HeaderGlyphButton.tsx` even asserted the opposite in its docblock ("Android
 * app bars use Compose `IconButton` + `AppIcon`, whose ripple is the affordance
 * there") — true of the control, false of how we mounted it.
 *
 * `HEADER_TOUCH_TARGET` is M3's icon-button size, which is also what the ripple
 * needs room for.
 */
export const HEADER_TOUCH_TARGET = 40;

/**
 * How far the glyph's CENTRE sits from the screen edge, matched to the
 * navigator's own back arrow so a screen with a custom leading action lines up
 * with one that has the real thing. Measured: the native arrow centres at
 * 28.09dp, a hosted one at 40.18dp. `leading` is that correction.
 *
 * WHY THE BOX IS 40 AND NOT 48. M3 draws a 40dp ripple inside a 48dp target, and
 * @expo/ui gives no way to ask for both: the ripple is sized to the HOST, not to
 * the button (host 40 -> 39.5dp, host 48 -> 47.3, host 56 -> 55.5; a
 * `size(40, 40)` modifier on the `IconButton` changes nothing). A 48dp host does
 * not fit the header's slot either, and the failure is not subtle — measured on a
 * Galaxy A54, the TRAILING buttons' ripple landed 17dp below its own glyph
 * (y-centre 80.89 against the glyph's 61.69) and was clipped to 31.29dp by the
 * bar's edge, while the leading one was correct. At 40 both are right:
 *
 *                    ripple width   y-centre
 *   native back         39.82dp      61.69dp
 *   trailing gear       39.47dp      61.51dp
 *   leading back        39.47dp      61.87dp
 *
 * THE COST IS THE TOUCH TARGET, and it was probed rather than assumed: a tap at
 * 51.6dp registers on the native arrow and misses this one. 40dp is under
 * Material's 48dp floor. The trade is stated in docs/pending-upstream.md.
 *
 * WHAT IS STILL NOT EQUAL is the ripple's COLOUR. Compose's darkens by about 2
 * L* where the native arrow lightens by 21.5, so the two read differently in the
 * same bar. It is not reachable from JS — `colors.contentColor` was measured to
 * change nothing (-2.19 with and without) — and fixing it means abandoning the
 * Compose `IconButton` for an RN `Pressable` with `android_ripple`, which also
 * means abandoning `AppIcon`, since these icons are Android XML vector drawables
 * that RN's `Image` cannot render. Not done without a decision.
 */
export const HEADER_NATIVE_LEADING_CENTRE = 28.09;

type HeaderIconButtonProps = {
  name: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  /**
   * Pull the button toward the screen edge so its glyph lands where the
   * navigator's own back arrow does. Only a LEADING action needs it; a trailing
   * one is already where the native slot puts it.
   */
  leading?: boolean;
};

export function HeaderIconButton({
  name,
  onPress,
  accessibilityLabel,
  leading = false,
}: HeaderIconButtonProps) {
  const { colors, scheme, seedColor } = useAppTheme();

  return (
    <Host
      colorScheme={scheme}
      seedColor={seedColor}
      style={{
        width: HEADER_TOUCH_TARGET,
        height: HEADER_TOUCH_TARGET,
        ...(leading ? { marginStart: -LEADING_PULL } : null),
      }}
    >
      <IconButton onClick={onPress}>
        <AppIcon
          name={name}
          size={24}
          tint={colors.onSurface}
          contentDescription={accessibilityLabel}
        />
      </IconButton>
    </Host>
  );
}

/**
 * The measured difference between where the header's leading slot puts a hosted
 * 48dp button and where the navigator draws its own back arrow. Solved on the
 * device rather than derived: React Navigation's leading container, Compose's
 * own button padding and the bar's start keyline all contribute, and none of
 * them is a number this side can read.
 */
const LEADING_PULL = 8;
