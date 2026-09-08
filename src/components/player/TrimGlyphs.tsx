import Svg, { Path } from 'react-native-svg';

/**
 * ANDROID'S CLIP-EDITOR GLYPHS — the platform half the shared editor cannot
 * carry itself (`ClipTrimEditor` / `ClipTrimFrame` are one file per surface,
 * and only the GLYPHS differ by platform; the iOS twin renders SF Symbols).
 *
 * THE SKIP INTERVAL IS THE PLATFORM'S: ±15 is Voice Memos' number and SF
 * ships `gobackward.15`; Material Symbols has no 15-second badge at all
 * (5/10/30 only), and Google's own audio surfaces skip 10 — so Android skips
 * ±10 with Material's own `replay_10` / `forward_10` geometry. The editor
 * reads `SKIP_SECONDS` and the a11y copy takes the number as a parameter, so
 * neither platform's label can lie about its glyph.
 *
 * EVERYTHING HERE IS DRAWN, NOT HOSTED. The skip glyphs are Material's own
 * vector-drawable paths (from `@expo/material-symbols`) re-rendered through
 * `react-native-svg`, and the cap chevrons are stroked paths —
 * `DisclosureChevron`'s technique. A Compose `Icon` host would carry the
 * navigation-return blink `TransportGlyphs` documents, and inside a
 * gesture-animated trim cap a bridged host has no business at all.
 */
export const SKIP_SECONDS = 10;

/** Material `replay_10`, verbatim path, 960-unit grid. */
const REPLAY_10 =
  'M339.5,851.5Q274,823 225.5,774.5Q177,726 148.5,660.5Q120,595 120,520L200,520Q200,637 281.5,718.5Q363,800 480,800Q597,800 678.5,718.5Q760,637 760,520Q760,403 678.5,321.5Q597,240 480,240L474,240L536,302L480,360L320,200L480,40L536,98L474,160L480,160Q555,160 620.5,188.5Q686,217 734.5,265.5Q783,314 811.5,379.5Q840,445 840,520Q840,595 811.5,660.5Q783,726 734.5,774.5Q686,823 620.5,851.5Q555,880 480,880Q405,880 339.5,851.5ZM360,640L360,460L300,460L300,400L420,400L420,640L360,640ZM500,640Q483,640 471.5,628.5Q460,617 460,600L460,440Q460,423 471.5,411.5Q483,400 500,400L580,400Q597,400 608.5,411.5Q620,423 620,440L620,600Q620,617 608.5,628.5Q597,640 580,640L500,640ZM520,580L560,580Q560,580 560,580Q560,580 560,580L560,460Q560,460 560,460Q560,460 560,460L520,460Q520,460 520,460Q520,460 520,460L520,580Q520,580 520,580Q520,580 520,580Z';

/** Material `forward_10`, verbatim path, 960-unit grid. */
const FORWARD_10 =
  'M360,640L360,460L300,460L300,400L420,400L420,640L360,640ZM500,640Q483,640 471.5,628.5Q460,617 460,600L460,440Q460,423 471.5,411.5Q483,400 500,400L580,400Q597,400 608.5,411.5Q620,423 620,440L620,600Q620,617 608.5,628.5Q597,640 580,640L500,640ZM520,580L560,580Q560,580 560,580Q560,580 560,580L560,460Q560,460 560,460Q560,460 560,460L520,460Q520,460 520,460Q520,460 520,460L520,580Q520,580 520,580Q520,580 520,580ZM339.5,851.5Q274,823 225.5,774.5Q177,726 148.5,660.5Q120,595 120,520Q120,445 148.5,379.5Q177,314 225.5,265.5Q274,217 339.5,188.5Q405,160 480,160L486,160L424,98L480,40L640,200L480,360L424,302L486,240L480,240Q363,240 281.5,321.5Q200,403 200,520Q200,637 281.5,718.5Q363,800 480,800Q597,800 678.5,718.5Q760,637 760,520L840,520Q840,595 811.5,660.5Q783,726 734.5,774.5Q686,823 620.5,851.5Q555,880 480,880Q405,880 339.5,851.5Z';

export type TrimGlyphProps = { color: string; size: number };

export const SkipBackGlyph = ({ color, size }: TrimGlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 960 960">
    <Path d={REPLAY_10} fill={color} />
  </Svg>
);

export const SkipForwardGlyph = ({ color, size }: TrimGlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 960 960">
    <Path d={FORWARD_10} fill={color} />
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
