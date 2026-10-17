import { Box, Host, IconButton } from '@expo/ui/jetpack-compose';
import { size } from '@expo/ui/jetpack-compose/modifiers';

import { useAppTheme } from '@/core';

import { AppIcon } from './AppIcon';
import type { IconName } from './icons';

/**
 * AN ACTION IN THE NAVIGATOR'S OWN APP BAR — Android's twin of
 * `HeaderGlyphButtonIos`, and the only way any of the three apps should put a
 * glyph in a header. A real Compose `IconButton`, so the glyph, the touch target
 * and the ripple are the platform's rather than ours.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LET THE BUTTON SIZE ITSELF; SIZE THE BOX AROUND IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A Compose `IconButton` already IS what we want: a 48dp interactive target with
 * a 40dp ripple inside it. Everything that went wrong here came from not letting
 * it be that, and it took three tries to stop fighting it. Measured throughout on
 * a Galaxy A54 against the navigator's own back arrow, which is native and
 * therefore the reference.
 *
 *  1. `matchContents` — the portfolio's original. Shrink-wraps the `Host` to the
 *     GLYPH, so the ripple was drawn into a 24dp box and clipped out of
 *     existence. Every header button in every app had no press feedback at all,
 *     only a glyph that dimmed slightly. The base `HeaderGlyphButton.tsx`
 *     asserted the opposite in its own docblock — true of the control, false of
 *     how we mounted it.
 *
 *  2. A STATED `Host` (48, then 40). The ripple is sized to the HOST, not to the
 *     button — host 40 → 39.5dp, 48 → 47.3, 56 → 55.5 — so a 48dp host drew a
 *     48dp ripple that crowded the screen edge, and on the TRAILING actions it
 *     also landed 17dp below its own glyph and was clipped by the bar. Dropping
 *     to 40 fixed the geometry and cost the touch target: a tap 26dp off centre
 *     missed, where the same tap lands on the native arrow.
 *
 *  3. A sized `Box` inside a `matchContents` Host — this. The Host takes its size
 *     from the content, the `Box` states the 48dp slot, and the `IconButton`
 *     renders at its NATURAL size inside it, which is the whole point: Compose
 *     draws its own 40dp ripple and claims its own ≥48dp target, and neither is
 *     something this side has to compute.
 *
 * What it measures, against the navigator's own arrow:
 *
 *                    ripple    x-centre   y-centre
 *   native back      39.82dp    27.91dp    61.69dp
 *   leading back     39.82dp    27.91dp    61.69dp   <- identical
 *   trailing gear    40.18dp   343.82dp    61.51dp
 *
 * The leading one matches to the decimal; the trailing ones sit 0.36dp wider and
 * 0.18dp higher, which is rasterisation rather than layout. Trailing pitch is 48.18dp and the end inset 40.00 —
 * M3's own 48 and 16 + 24. The target is BIGGER than the native arrow's, not
 * smaller: probed by tapping outward from the centre, ours still registers at
 * +28dp and misses at +34, where the native one registers at +23.7 and misses at
 * +29.
 *
 * THE ONE THING STILL NOT EQUAL is the ripple's COLOUR: Compose's darkens by
 * about 2 L* where the native arrow lightens by 21.5. Not reachable from JS —
 * `colors.contentColor` measured -2.19 with and without — and the only fix is an
 * RN `Pressable`, rejected on 2026-08-29: these stay native (Juan: "as native as
 * possible, no rn pressables"), which is also the rule this repo already has.
 * A closed question. See docs/pending-upstream.md.
 */

/** M3's icon-button slot. The `IconButton` sizes ITSELF inside it. */
const HEADER_SLOT = 48;

/**
 * The measured difference between where the header's leading container puts this
 * button and where the navigator draws its own back arrow. Solved on the device
 * rather than derived: React Navigation's container, Compose's own padding and
 * the bar's start keyline all contribute, and none of them is a number this side
 * can read. Only a LEADING action needs it — a trailing one already lands on
 * M3's 48dp pitch and 40dp end inset with no correction at all.
 */
const LEADING_PULL = 12;

type HeaderIconButtonProps = {
  name: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  /**
   * Pull the button onto the keyline the navigator's own back arrow uses, so a
   * screen with a custom leading action lines up with one that has the real
   * thing. Only a LEADING action needs it.
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
      matchContents
      style={leading ? { marginStart: -LEADING_PULL } : undefined}
    >
      <Box
        contentAlignment="center"
        modifiers={[size(HEADER_SLOT, HEADER_SLOT)]}
      >
        <IconButton onClick={onPress}>
          <AppIcon
            name={name}
            size={24}
            tint={colors.onSurface}
            contentDescription={accessibilityLabel}
          />
        </IconButton>
      </Box>
    </Host>
  );
}
