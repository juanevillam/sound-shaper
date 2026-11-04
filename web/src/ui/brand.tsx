/**
 * Sound Shaper's mark and its icon tile, as the welcome screens draw them.
 *
 * The mark is `src/components/ui/BrandMark.tsx`'s five bars on the 48-unit
 * grid. The tile is juanevillam.com's `AppTile.astro` — a port of the app's
 * `BrandTile`, dark: the iOS superellipse (n = 4.5), its measured shine and a
 * blurred contact shadow. When `BrandTile` retunes, retune this and the site.
 */
const BARS = [
  [10, 15],
  [17, 25],
  [24, 16],
  [31, 32],
  [38, 20],
] as const;

const INK = '#F5F5F5';

export const BrandMark = ({
  size,
  color = INK,
}: {
  size: number;
  color?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    aria-hidden="true"
  >
    {BARS.map(([x, h]) => (
      <line
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
  </svg>
);

const SQUIRCLE_N = 4.5;
const SQUIRCLE_STEPS = 256;

const squirclePath = (s: number) => {
  const r = s / 2;
  const exp = 2 / SQUIRCLE_N;
  const points: string[] = [];

  for (let i = 0; i <= SQUIRCLE_STEPS; i += 1) {
    const a = (i / SQUIRCLE_STEPS) * 2 * Math.PI;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const x = r + Math.sign(cos) * r * Math.abs(cos) ** exp;
    const y = r + Math.sign(sin) * r * Math.abs(sin) ** exp;

    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  return `M${points.join('L')}Z`;
};

// BrandTile's measured dark values.
const GRADIENT: [string, string][] = [
  ['0', '#727272'],
  ['0.008', '#5A5A59'],
  ['0.016', '#414141'],
  ['0.2', '#2C2D2D'],
  ['0.5', '#222222'],
  ['0.8', '#181817'],
  ['0.984', '#1E1D1E'],
  ['0.992', '#2E2E2D'],
  ['1', '#3E3E3E'],
];
const SHADOW = { opacity: 0.5, blur: 0.045, dy: 0.05 };
const SHADOW_PAD = 0.18;

export const BrandTile = ({ size }: { size: number }) => {
  const pad = Math.round(size * SHADOW_PAD);
  const canvas = size + pad * 2;
  const path = squirclePath(size);
  const glyph = size * 0.94;
  const scale = glyph / 48;
  const offset = pad + (size - glyph) / 2;

  return (
    <svg
      width={canvas}
      height={canvas}
      viewBox={`0 0 ${canvas} ${canvas}`}
      style={{ margin: -pad, display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tile-shine" x1="0" y1="0" x2="0" y2="1">
          {GRADIENT.map(([stop, color]) => (
            <stop key={stop} offset={stop} stopColor={color} />
          ))}
        </linearGradient>
        <filter id="tile-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={size * SHADOW.blur} />
        </filter>
      </defs>
      <path
        d={path}
        fill="#000000"
        opacity={SHADOW.opacity}
        filter="url(#tile-shadow)"
        transform={`translate(${pad}, ${pad + size * SHADOW.dy})`}
      />
      <path
        d={path}
        fill="url(#tile-shine)"
        transform={`translate(${pad}, ${pad})`}
      />
      <g transform={`translate(${offset}, ${offset}) scale(${scale})`}>
        {BARS.map(([x, h]) => (
          <line
            key={x}
            x1={x}
            y1={24 - h / 2}
            x2={x}
            y2={24 + h / 2}
            stroke={INK}
            strokeWidth={3.25}
            strokeLinecap="round"
          />
        ))}
      </g>
    </svg>
  );
};
