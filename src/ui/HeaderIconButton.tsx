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
export const HEADER_TOUCH_TARGET = 48;

/**
 * How far the glyph's CENTRE sits from the screen edge, matched to the
 * navigator's own back arrow so a screen with a custom leading action lines up
 * with one that has the real thing. Measured: the native arrow centres at
 * 28.09dp, a hosted one at 40.18dp — 12.09dp adrift, which reads as a jump
 * between screens. `leading` is the correction.
 *
 * THE RIPPLE IS 8dp WIDER THAN THE NATIVE ONE, AND THAT IS NOT A POSITION BUG.
 * Measured on a Galaxy A54: the ripple centres at 27.73dp against the native
 * 27.91 — the same place — but spans 47.29dp against 39.11, so its left edge
 * reaches 4.27dp from the screen where the native one stops at 8.53. It reads as
 * "shifted right"; it is actually "too wide at both ends".
 *
 * The cause is that @expo/ui sizes the ripple to the HOST, not to the button:
 * host 48 → ripple 47.29, host 56 → ripple 55.5, host 40 → ripple 39.11. M3 puts
 * a 40dp ripple inside a 48dp target and there is no way to ask for both — a
 * `size(40, 40)` modifier on the `IconButton` was tried and changed nothing.
 *
 * So this keeps the 48dp TARGET and accepts the wide ripple. The alternative was
 * measured too: a 40dp host renders the ripple at 39.11dp, matching the native
 * one exactly, and shrinks the target to 40dp — probed on the device, a tap at
 * 51.6dp registers on the native arrow and misses on that one. Material's floor
 * is 48. Filed in docs/pending-upstream.md.
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
const LEADING_PULL = 12;
