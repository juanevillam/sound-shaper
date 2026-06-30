import Svg, { Path } from 'react-native-svg';

// A filled trophy silhouette (cup + two handles + stem + foot) on a 24-grid.
// `evenodd` punches the handle openings out of the solid fill. Exported so the
// platinum banner's icon-glint clip reuses the IDENTICAL silhouette (one source
// of truth).
export const TROPHY_PATH =
  'M18 2H6v1H3a1 1 0 0 0-1 1v2a4 4 0 0 0 4 4h.55A6 6 0 0 0 11 13.91V17H8.5a1 1 0 0 0-1 1H7a1 1 0 0 0-1 1v1h12v-1a1 1 0 0 0-1-1h-.5a1 1 0 0 0-1-1H13v-3.09A6 6 0 0 0 17.45 10H18a4 4 0 0 0 4-4V4a1 1 0 0 0-1-1h-3V2ZM6 5v3a2 2 0 0 1-2-2V5h2Zm14 1a2 2 0 0 1-2 2V5h2v1Z';

// A padlock (Material "lock"), with the keyhole + shackle gap punched out via
// evenodd. Shown for a locked trophy so it reads as "not earned yet" — a clear
// lock, never a stone-grey trophy.
const LOCK_PATH =
  'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z';

type TrophyIconProps = {
  /** Fill color — the caller decides (a tier color when earned, a muted role
   *  when locked), so the icon itself never hardcodes a hue. */
  color: string;
  size: number;
  /** Render a padlock instead of the trophy — an unearned trophy. */
  locked?: boolean;
};

/** A flat, monochrome trophy glyph — or a padlock when locked. */
export const TrophyIcon = ({
  color,
  size,
  locked = false,
}: TrophyIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d={locked ? LOCK_PATH : TROPHY_PATH}
      fill={color}
      fillRule="evenodd"
    />
  </Svg>
);
