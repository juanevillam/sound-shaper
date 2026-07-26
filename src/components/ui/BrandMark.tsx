import Svg, { Line } from 'react-native-svg';

type BrandMarkProps = {
  size: number;
  /** Themed foreground color; defaults to the brand mark grey. */
  color?: string;
};

// Five equalizer bars, centered on the midline — an uneven "frozen audio"
// shape (rise, dip, peak, settle) rather than a symmetric curve.
const BARS = [
  [10, 15],
  [17, 25],
  [24, 16],
  [31, 32],
  [38, 20],
] as const;

/**
 * Sound Shaper's mark — a five-bar equalizer: the shape of sound being tuned.
 * Crisp vector, 48-unit grid, stroke 3.25, round caps, no fill. Flat, matching
 * the app icon.
 */
export const BrandMark = ({ size, color = '#F5F5F5' }: BrandMarkProps) => (
  <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    {BARS.map(([x, h]) => (
      <Line
        key={x}
        x1={x}
        y1={24 - h / 2}
        x2={x}
        y2={24 + h / 2}
        stroke={color}
        strokeWidth={3.25}
        strokeLinecap="round"
      />
    ))}
  </Svg>
);
