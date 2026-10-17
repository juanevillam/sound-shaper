import Svg, { Path, Text as SvgText } from 'react-native-svg';

/**
 * ANDROID'S CLIP-EDITOR GLYPHS — the platform half the shared editor cannot
 * carry itself (`ClipTrimEditor` / `ClipTrimFrame` are one file per surface,
 * and only the GLYPHS differ by platform; the iOS twin renders SF Symbols).
 *
 * THE SKIP INTERVAL IS ±15 ON BOTH PLATFORMS (Juan, 2026-09-08 — the ±10
 * split shipped for a day on "Material has no 15 badge", and one number
 * matters more than a stock badge): the ring is Material's own
 * `replay_10`/`forward_10` geometry with the digits re-set as type. The
 * editor reads `SKIP_SECONDS` and the a11y copy takes the number as a
 * parameter, so neither platform's label can lie about its glyph.
 *
 * EVERYTHING HERE IS DRAWN, NOT HOSTED. The skip glyphs are Material's own
 * vector-drawable paths (from `@expo/material-symbols`) re-rendered through
 * `react-native-svg`, and the cap chevrons are stroked paths —
 * `DisclosureChevron`'s technique. A Compose `Icon` host would carry the
 * navigation-return blink `TransportGlyphs` documents, and inside a
 * gesture-animated trim cap a bridged host has no business at all.
 */
/**
 * Material's `replay_10` / `forward_10` ARROW RINGS, digits stripped — the
 * badge says 15 here (below), matching iOS's ±15 (Juan, 2026-09-08: one
 * number both platforms; Material ships no 15 badge, so the digits are set
 * in type over Google's own ring geometry).
 */
const REPLAY_RING =
  'M339.5,851.5Q274,823 225.5,774.5Q177,726 148.5,660.5Q120,595 120,520L200,520Q200,637 281.5,718.5Q363,800 480,800Q597,800 678.5,718.5Q760,637 760,520Q760,403 678.5,321.5Q597,240 480,240L474,240L536,302L480,360L320,200L480,40L536,98L474,160L480,160Q555,160 620.5,188.5Q686,217 734.5,265.5Q783,314 811.5,379.5Q840,445 840,520Q840,595 811.5,660.5Q783,726 734.5,774.5Q686,823 620.5,851.5Q555,880 480,880Q405,880 339.5,851.5Z';

const FORWARD_RING =
  'M339.5,851.5Q274,823 225.5,774.5Q177,726 148.5,660.5Q120,595 120,520Q120,445 148.5,379.5Q177,314 225.5,265.5Q274,217 339.5,188.5Q405,160 480,160L486,160L424,98L480,40L640,200L480,360L424,302L486,240L480,240Q363,240 281.5,321.5Q200,403 200,520Q200,637 281.5,718.5Q363,800 480,800Q597,800 678.5,718.5Q760,637 760,520L840,520Q840,595 811.5,660.5Q783,726 734.5,774.5Q686,823 620.5,851.5Q555,880 480,880Q405,880 339.5,851.5Z';

/**
 * The digits, set to sit where Material's own do (its "10" spans y 400→640):
 * Roboto Medium at the same cap height, centred in the ring.
 */
const DIGITS_FONT_SIZE = 300;
const DIGITS_X = 480;
const DIGITS_Y = 645;

export type TrimGlyphProps = { color: string; size: number };

const Digits = ({ color }: { color: string }) => (
  <SvgText
    fill={color}
    fontSize={DIGITS_FONT_SIZE}
    fontWeight="500"
    textAnchor="middle"
    x={DIGITS_X}
    y={DIGITS_Y}
  >
    15
  </SvgText>
);

export const SkipBackGlyph = ({ color, size }: TrimGlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 960 960">
    <Path d={REPLAY_RING} fill={color} />
    <Digits color={color} />
  </Svg>
);

export const SkipForwardGlyph = ({ color, size }: TrimGlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 960 960">
    <Path d={FORWARD_RING} fill={color} />
    <Digits color={color} />
  </Svg>
);

/** A trim cap's compact chevron — stroked path, both directions. */
export const CapChevron = ({
  color,
  size,
  direction,
}: TrimGlyphProps & { direction: 'left' | 'right' }) => (
  <Svg width={size} height={size} viewBox="0 0 17 17">
    <Path
      d={
        direction === 'left'
          ? 'M11 3.5 L6.5 8.5 L11 13.5'
          : 'M6 3.5 L10.5 8.5 L6 13.5'
      }
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);
