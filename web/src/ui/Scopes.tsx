import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { coefficientsFor, magnitudeAt } from '@app/lib/eqResponse';
import {
  ECHO_LEVELS,
  EQ_BANDS,
  EQ_MAX_DB,
  NEXT_ROOM_LEVELS,
  NEXT_ROOM_SHELF_HZ,
  type EffectLevel,
} from '@app/lib/shapeDsp';

import {
  isTabHidden,
  prefersReducedMotion,
  sampleAudio,
  stepEnvelope,
} from '../analyser';
import { locale } from '../i18n';

/**
 * STUDIO PARAMETER SCOPES — Equalizer, Echo, and Next Room.
 *
 * Geometry & craft rules:
 * - Single compact height (`SCOPE_HEIGHT = 38`) standardized across all three
 *   previews in `Shape`.
 * - Every `.scope-line` stays within `[LINE_PAD_Y, SCOPE_HEIGHT - LINE_PAD_Y]`
 *   (`6.5 px` clear of both top and `border-bottom`) so the stroke and its
 *   glow never touch or blend into the separator line, while area washes and
 *   live spectrum bars anchor flush on the bottom and side borders.
 * - Book Highlighter one-shot ink/wash entrance (`data-ink-state`), spring
 *   posture on Play <-> Pause, and smooth spectrum melt on Pause.
 */

export const SCOPE_HEIGHT = 38;
const LINE_PAD_Y = 6.5;

const NYQUIST = 24000;
const F_LO = 40;
const F_HI = 16000;
const SPEC_LO = 45;
const SPEC_HI = 13500;
const NODE_R = 2;
const SPRING_OMEGA = 19;
const INK_SETTLE_MS = 680;

export function useGlide(
  target: readonly number[],
  spans: readonly number[],
): { values: number[]; moving: boolean } {
  const key = target.join('|');
  const goal = useRef<number[]>([...target]);
  goal.current = [...target];
  const pos = useRef<number[]>([...target]);
  const vel = useRef<number[]>(target.map(() => 0));
  const [frame, setFrame] = useState(() => ({
    values: [...target],
    moving: false,
  }));

  useEffect(() => {
    const to = goal.current;
    if (pos.current.length !== to.length) {
      pos.current = [...to];
      vel.current = to.map(() => 0);
    }

    const alreadySettled = to.every((g, i) => {
      const span = spans[i] || 1;
      return (
        Math.abs((pos.current[i] ?? g) - g) <= span * 0.0008 &&
        Math.abs(vel.current[i] ?? 0) <= span * 0.01
      );
    });

    if (alreadySettled || prefersReducedMotion() || isTabHidden()) {
      pos.current = [...to];
      vel.current = to.map(() => 0);
      setFrame(prev =>
        prev.moving || prev.values.some((v, i) => v !== to[i])
          ? { values: [...to], moving: false }
          : prev,
      );
      return;
    }

    let raf = 0;
    let last = performance.now();

    const snap = () => {
      cancelAnimationFrame(raf);
      pos.current = [...goal.current];
      vel.current = goal.current.map(() => 0);
      setFrame({ values: [...goal.current], moving: false });
    };

    const onVisibility = () => {
      if (isTabHidden()) snap();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const tick = (now: number) => {
      const dt = Math.max(0.001, Math.min(0.1, (now - last) / 1000));
      last = now;
      const exp = Math.exp(-SPRING_OMEGA * dt);
      let settled = true;

      for (let i = 0; i < to.length; i += 1) {
        const g = to[i];
        const span = spans[i] || 1;
        const d = pos.current[i] - g;
        const v0 = vel.current[i];
        const c = v0 + SPRING_OMEGA * d;
        const nx = g + (d + c * dt) * exp;
        const nv = (v0 - c * SPRING_OMEGA * dt) * exp;
        pos.current[i] = nx;
        vel.current[i] = nv;
        if (Math.abs(nx - g) > span * 0.0008 || Math.abs(nv) > span * 0.01) {
          settled = false;
        }
      }

      if (settled) {
        pos.current = [...to];
        vel.current = to.map(() => 0);
        setFrame({ values: [...to], moving: false });
        return;
      }

      setFrame({ values: [...pos.current], moving: true });
      raf = requestAnimationFrame(tick);
    };

    setFrame({ values: [...pos.current], moving: true });
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return frame;
}

function useEditWake(signature: string, holdMs = 650): boolean {
  const initial = useRef(signature);
  const [awake, setAwake] = useState(false);

  useEffect(() => {
    if (signature === initial.current) return;
    initial.current = signature;
    setAwake(true);
    const id = setTimeout(() => setAwake(false), holdMs);
    return () => clearTimeout(id);
  }, [signature, holdMs]);

  return awake;
}

let lastScopeWidth = 320;

const useBoxWidth = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(lastScopeWidth);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (raw: number) => {
      const next = Math.round(raw);
      if (next <= 0) return;
      lastScopeWidth = next;
      setWidth(prev => (prev === next ? prev : next));
    };
    apply(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      apply(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
};

function useInkEntrance(): 'drawing' | 'done' {
  const [inkState, setInkState] = useState<'drawing' | 'done'>(() =>
    prefersReducedMotion() ? 'done' : 'drawing',
  );

  useEffect(() => {
    if (inkState === 'done') return;
    const timer = setTimeout(() => setInkState('done'), INK_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [inkState]);

  return inkState;
}

const useSvgId = (prefix: string) =>
  `${prefix}-${useId().replace(/[^\w-]/g, '')}`;

export const formatSignedDb = (value: number, digits = 1): string =>
  `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: 'exceptZero',
  })
    .format(Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value)
    .replace('-', '\u2212')} dB`;

// ── Shared DSP & curve helpers ────────────────────────────────────────────

const polylinePath = (points: readonly { x: number; y: number }[]): string => {
  if (!points.length) return '';
  let d = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += `L${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
  }
  return d;
};

const smoothSvgPath = (points: readonly { x: number; y: number }[]): string => {
  if (points.length < 2) return polylinePath(points);
  let d = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${cp1x.toFixed(2)} ${cp1y.toFixed(2)},${cp2x.toFixed(2)} ${cp2y.toFixed(2)},${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
};

const freqX = (hz: number, width: number): number =>
  (Math.log(hz / F_LO) / Math.log(F_HI / F_LO)) * Math.max(1, width);

const hzAtX = (x: number, width: number): number =>
  F_LO * Math.pow(F_HI / F_LO, x / Math.max(1, width));

const responseDb = (
  coefficients: ReturnType<typeof coefficientsFor>[],
  hz: number,
): number => {
  let linear = 1;
  for (const c of coefficients) linear *= magnitudeAt(c, hz / NYQUIST);
  return 20 * Math.log10(Math.max(linear, 1e-6));
};

export function eqExtremeDb(gains: readonly number[]): number {
  if (gains.every(g => g === 0)) return 0;
  const coefficients = EQ_BANDS.map((band, i) =>
    coefficientsFor(band, gains[i] ?? 0, NYQUIST),
  );
  let extreme = 0;
  const steps = 80;
  for (let s = 0; s <= steps; s += 1) {
    const hz = F_LO * Math.pow(F_HI / F_LO, s / steps);
    const db = responseDb(coefficients, hz);
    if (Math.abs(db) > Math.abs(extreme)) extreme = db;
  }
  return extreme;
}

const ROOM_SHELVES = NEXT_ROOM_SHELF_HZ.map(hz => ({
  hz,
  type: 'highshelf' as const,
}));

export function nextRoom1kDb(level: EffectLevel): number {
  if (level === 'off') return 0;
  const coeffs = ROOM_SHELVES.map(band =>
    coefficientsFor(band, NEXT_ROOM_LEVELS[level].depthDb, NYQUIST),
  );
  return responseDb(coeffs, 1000);
}

export function echoTapDb(level: EffectLevel): number {
  if (level === 'off') return 0;
  return 20 * Math.log10(ECHO_LEVELS[level].feedback);
}

function ScopeBox({
  boxRef,
  width,
  active,
  playing,
  live,
  className,
  children,
}: {
  boxRef: React.RefObject<HTMLDivElement | null>;
  width: number;
  active: boolean;
  playing: boolean;
  live: boolean;
  className?: string;
  children: (width: number) => ReactNode;
}) {
  const inkState = useInkEntrance();

  return (
    <div
      ref={boxRef}
      data-ink-state={inkState}
      className={[
        'scope',
        className,
        active && 'is-active',
        playing && 'is-playing',
        live && 'is-live',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ height: SCOPE_HEIGHT } as CSSProperties}
      aria-hidden="true"
    >
      {width > 0 && (
        <svg
          viewBox={`0 0 ${width} ${SCOPE_HEIGHT}`}
          preserveAspectRatio="none"
        >
          {children(width)}
        </svg>
      )}
    </div>
  );
}

/**
 * Background Indicator #2 for frequency-domain scopes (`EqScope` &
 * `NextRoomScope`): rises smoothly on Play and melts down into `y = height`
 * on Pause before stopping `rAF`.
 */
function useLiveSpectrumPath(
  pathRef: React.RefObject<SVGPathElement | null>,
  playing: boolean,
  width: number,
  height: number,
  maxRisePx: number,
) {
  const binsRef = useRef<Float32Array | null>(null);
  const ptsRef = useRef<{ x: number; y: number }[] | null>(null);
  const gateRef = useRef(0);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const pathEl = pathRef.current;
    if (!pathEl || width <= 4 || prefersReducedMotion()) {
      pathEl?.setAttribute('d', '');
      return;
    }

    const bins = 42;
    if (!binsRef.current || binsRef.current.length !== bins) {
      binsRef.current = new Float32Array(bins);
    }
    if (!ptsRef.current || ptsRef.current.length !== bins) {
      ptsRef.current = Array.from({ length: bins }, () => ({ x: 0, y: 0 }));
    }
    const smooth = binsRef.current;
    const pts = ptsRef.current;
    const raw = new Float32Array(bins);

    let initialPeak = 0;
    for (let i = 0; i < bins; i += 1) {
      if (smooth[i] > initialPeak) initialPeak = smooth[i];
    }
    if (!playing && initialPeak < 0.003 && gateRef.current < 0.003) {
      pathEl.setAttribute('d', '');
      return;
    }

    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      if (isTabHidden()) {
        raf = 0;
        return;
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const isPlaying = playingRef.current;
      gateRef.current = stepEnvelope(
        gateRef.current,
        isPlaying ? 1 : 0,
        dt,
        0.15,
        0.18,
      );
      const gate = gateRef.current;

      const sample = isPlaying
        ? sampleAudio(raw, SPEC_LO, SPEC_HI)
        : { active: false, rms: 0 };

      let peak = 0;
      const span = width + 2;

      for (let i = 0; i < bins; i += 1) {
        const u = i / (bins - 1);
        const target = sample.active ? raw[i] * gate : 0;
        smooth[i] = stepEnvelope(
          smooth[i],
          target,
          dt,
          0.06,
          isPlaying ? 0.2 : 0.13,
        );
        const val = smooth[i];
        if (val > peak) peak = val;
        pts[i].x = -1 + u * span;
        pts[i].y = height - val * maxRisePx;
      }

      if (peak > 0.003) {
        const curve = smoothSvgPath(pts);
        const bottom = (height + 1).toFixed(1);
        pathEl.setAttribute(
          'd',
          `${curve}L${(width + 1).toFixed(1)} ${bottom}L-1 ${bottom}Z`,
        );
      } else {
        pathEl.setAttribute('d', '');
        if (!isPlaying) {
          smooth.fill(0);
          gateRef.current = 0;
          return;
        }
      }

      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      if (isTabHidden()) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf && (playingRef.current || gateRef.current > 0.003)) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pathRef, playing, width, height, maxRisePx]);
}

// ── 1. Equalizer: compact 38px 5-band biquad cascade + live spectrum ──────

const EQ_DB_SPAN = 15;
const EQ_SPANS = EQ_BANDS.map(() => EQ_MAX_DB * 2);

export function EqScope({
  gains,
  playing,
}: {
  gains: readonly number[];
  playing: boolean;
}) {
  const editAwake = useEditWake(gains.join(','));
  const engaged = playing || editAwake;
  const targetGains = gains.map(g => g * (engaged ? 1 : 0.58));
  const { values, moving } = useGlide(targetGains, EQ_SPANS);
  const fillId = useSvgId('eq-fill');
  const specRef = useRef<SVGPathElement>(null);
  const { ref, width } = useBoxWidth();

  const active = gains.some(g => g !== 0);
  const live = active && (playing || moving || editAwake);

  const coefficients = EQ_BANDS.map((band, i) =>
    coefficientsFor(band, values[i] ?? 0, NYQUIST),
  );

  useLiveSpectrumPath(
    specRef,
    playing,
    width,
    SCOPE_HEIGHT,
    SCOPE_HEIGHT * 0.76,
  );

  return (
    <ScopeBox
      boxRef={ref}
      width={width}
      active={active}
      playing={playing}
      live={live}
      className="scope-eq"
    >
      {w => {
        const mid = SCOPE_HEIGHT / 2;
        const swing = mid - LINE_PAD_Y;
        const y = (db: number) =>
          mid -
          (Math.max(-EQ_DB_SPAN, Math.min(EQ_DB_SPAN, db)) / EQ_DB_SPAN) *
            swing;

        const points: { x: number; y: number }[] = [];
        const count = Math.max(48, Math.round(w / 2.5));
        const xStart = -1.5;
        const xEnd = w + 1.5;
        for (let p = 0; p <= count; p += 1) {
          const x = xStart + (p / count) * (xEnd - xStart);
          const hz = hzAtX(Math.max(0, Math.min(w, x)), w);
          points.push({ x, y: y(responseDb(coefficients, hz)) });
        }
        const line = polylinePath(points);
        const area = `${line}L${xEnd.toFixed(1)} ${mid.toFixed(1)}L${xStart.toFixed(1)} ${mid.toFixed(1)}Z`;

        return (
          <>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" className="scope-fill-edge" />
                <stop offset="50%" className="scope-fill-mid" />
                <stop offset="100%" className="scope-fill-edge" />
              </linearGradient>
            </defs>
            <path ref={specRef} className="scope-spectrum" />
            {EQ_BANDS.map(band => {
              const bx = freqX(band.hz, w);
              return (
                <line
                  key={band.hz}
                  className="scope-grid"
                  x1={bx}
                  x2={bx}
                  y1={0}
                  y2={SCOPE_HEIGHT}
                />
              );
            })}
            <line className="scope-zero" x1={-1} x2={w + 1} y1={mid} y2={mid} />
            <path d={area} className="scope-area" fill={`url(#${fillId})`} />
            <path d={line} pathLength={1} className="scope-line" />
            {EQ_BANDS.map((band, i) => (
              <circle
                key={band.hz}
                cx={freqX(band.hz, w)}
                cy={y(responseDb(coefficients, band.hz))}
                r={NODE_R}
                style={{ '--node-i': i } as CSSProperties}
                className={
                  gains[i] !== 0 ? 'scope-node is-active' : 'scope-node'
                }
              />
            ))}
          </>
        );
      }}
    </ScopeBox>
  );
}

// ── 2. Echo: compact 38px reflection curve + live propagating trail ───────
//
// `.scope-line` stays strictly inside `[LINE_PAD_Y, SCOPE_HEIGHT - LINE_PAD_Y]`
// (`6.5 .. 31.5`), never touching `border-bottom` (`38`), while `scope-area`
// and `scope-spectrum` fill flush down to `y = 39`.

const ECHO_WAVES = 5.5;
const ECHO_SPANS = [0.5, 1, 1] as const;

function echoDecayRate(fb: number, rippleAmt: number): number {
  const norm = Math.max(0, Math.min(1, (fb - 0.22) / 0.26));
  const activeDecay = 3.2 - norm * 1.95;
  return 5.4 * (1 - rippleAmt) + activeDecay * rippleAmt;
}

function useLiveEchoTrail(
  pathRef: React.RefObject<SVGPathElement | null>,
  playing: boolean,
  width: number,
  height: number,
  decayRef: React.RefObject<number>,
) {
  const historyRef = useRef<Float32Array | null>(null);
  const ptsRef = useRef<{ x: number; y: number }[] | null>(null);
  const gateRef = useRef(0);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const pathEl = pathRef.current;
    if (!pathEl || width <= 4 || prefersReducedMotion()) {
      pathEl?.setAttribute('d', '');
      return;
    }

    const slots = 48;
    if (!historyRef.current || historyRef.current.length !== slots) {
      historyRef.current = new Float32Array(slots);
    }
    if (!ptsRef.current || ptsRef.current.length !== slots) {
      ptsRef.current = Array.from({ length: slots }, () => ({ x: 0, y: 0 }));
    }
    const history = historyRef.current;
    const pts = ptsRef.current;

    let initialPeak = 0;
    for (let i = 0; i < slots; i += 1) {
      if (history[i] > initialPeak) initialPeak = history[i];
    }
    if (!playing && initialPeak < 0.003 && gateRef.current < 0.003) {
      pathEl.setAttribute('d', '');
      return;
    }

    let headEnv = history[0] ?? 0;
    let accum = 0;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      if (isTabHidden()) {
        raf = 0;
        return;
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const isPlaying = playingRef.current;
      gateRef.current = stepEnvelope(
        gateRef.current,
        isPlaying ? 1 : 0,
        dt,
        0.15,
        0.16,
      );

      const sample = isPlaying ? sampleAudio() : { active: false, rms: 0 };
      const rawLevel = sample.active
        ? Math.min(1, Math.pow(sample.rms * 2.6, 0.8))
        : 0;
      headEnv = stepEnvelope(
        headEnv,
        rawLevel,
        dt,
        0.035,
        isPlaying ? 0.14 : 0.1,
      );

      accum += dt * 46;
      while (accum >= 1) {
        accum -= 1;
        for (let i = slots - 1; i > 0; i -= 1) {
          history[i] = history[i - 1] * (isPlaying ? 1 : 0.94);
        }
        history[0] = headEnv;
      }

      if (!isPlaying) {
        const damp = Math.exp(-dt / 0.14);
        for (let i = 0; i < slots; i += 1) history[i] *= damp;
      }

      let peak = 0;
      const decay = decayRef.current;
      const maxRise = height * 0.76;
      const span = width + 2;

      for (let i = 0; i < slots; i += 1) {
        const u = i / (slots - 1);
        const atten = Math.exp(-decay * 0.72 * u);
        const val = history[i] * atten * (isPlaying ? 1 : gateRef.current);
        if (val > peak) peak = val;
        pts[i].x = -1 + u * span;
        pts[i].y = height - val * maxRise;
      }

      if (peak > 0.003) {
        const curve = smoothSvgPath(pts);
        const bottom = (height + 1).toFixed(1);
        pathEl.setAttribute(
          'd',
          `${curve}L${(width + 1).toFixed(1)} ${bottom}L-1 ${bottom}Z`,
        );
      } else {
        pathEl.setAttribute('d', '');
        if (!isPlaying) {
          history.fill(0);
          gateRef.current = 0;
          return;
        }
      }

      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      if (isTabHidden()) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf && (playingRef.current || gateRef.current > 0.003)) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pathRef, playing, width, height, decayRef]);
}

export function EchoScope({
  level,
  playing,
}: {
  level: EffectLevel;
  playing: boolean;
}) {
  const active = level !== 'off';
  const editAwake = useEditWake(level);
  const engaged = playing || editAwake ? 1 : 0.74;
  const targetFb = active ? ECHO_LEVELS[level].feedback : 0.22;
  const { values, moving } = useGlide(
    [targetFb, active ? 1 : 0, engaged],
    ECHO_SPANS,
  );
  const [fb, rippleAmt, posture] = values;
  const live = active && (playing || moving || editAwake);
  const fillId = useSvgId('echo-fill');
  const trailRef = useRef<SVGPathElement>(null);
  const { ref, width } = useBoxWidth();

  const decay = echoDecayRate(fb, rippleAmt);
  const decayRef = useRef(decay);
  decayRef.current = decay;

  useLiveEchoTrail(trailRef, playing, width, SCOPE_HEIGHT, decayRef);

  return (
    <ScopeBox
      boxRef={ref}
      width={width}
      active={active}
      playing={playing}
      live={live}
      className="scope-echo"
    >
      {w => {
        // Line floor sits `LINE_PAD_Y` (6.5px) above `border-bottom` so the
        // glowing trace never touches or mixes with the bottom border.
        const lineFloor = SCOPE_HEIGHT - LINE_PAD_Y;
        const lineSpan = lineFloor - LINE_PAD_Y;
        const maxRise = lineSpan * (0.68 + 0.32 * rippleAmt) * posture;
        const xStart = -1.5;
        const xEnd = w + 1.5;
        const count = Math.max(56, Math.round(w / 2));
        const pts: { x: number; y: number }[] = [];

        for (let p = 0; p <= count; p += 1) {
          const x = xStart + (p / count) * (xEnd - xStart);
          const u = Math.max(0, Math.min(1, x / Math.max(1, w)));
          const env = Math.exp(-decay * u);
          const mod =
            1 - rippleAmt * 0.44 * (1 - Math.cos(2 * Math.PI * ECHO_WAVES * u));
          pts.push({ x, y: lineFloor - maxRise * env * mod });
        }

        const line = polylinePath(pts);
        const bottom = (SCOPE_HEIGHT + 1).toFixed(1);
        const area = `${line}L${xEnd.toFixed(1)} ${bottom}L${xStart.toFixed(1)} ${bottom}Z`;

        return (
          <>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" className="scope-fill-edge" />
                <stop offset="100%" className="scope-fill-mid" />
              </linearGradient>
            </defs>
            <path ref={trailRef} className="scope-spectrum" />
            <path d={area} className="scope-area" fill={`url(#${fillId})`} />
            <path d={line} pathLength={1} className="scope-line" />
          </>
        );
      }}
    </ScopeBox>
  );
}

// ── 3. Next Room: compact 38px 3-shelf wall roll-off + live spectrum ──────
//
// `.scope-line` rolls off inside `[topY, SCOPE_HEIGHT - LINE_PAD_Y]` so even on
// High (-42 dB) the trace stays 6.5px clear above `border-bottom`.

const ROOM_TOP_LIVE = LINE_PAD_Y + 1;
const ROOM_TOP_STANDBY = LINE_PAD_Y + 4;
const ROOM_FLOOR_DB = -44;
const ROOM_SPANS = [14, 1] as const;

export function NextRoomScope({
  level,
  playing,
}: {
  level: EffectLevel;
  playing: boolean;
}) {
  const active = level !== 'off';
  const editAwake = useEditWake(level);
  const engaged = playing || editAwake ? 1 : 0;
  const depth = active ? NEXT_ROOM_LEVELS[level].depthDb : 0;
  const { values, moving } = useGlide([depth, engaged], ROOM_SPANS);
  const [d, awake] = values;
  const live = active && (playing || moving || editAwake);
  const coefficients = ROOM_SHELVES.map(band =>
    coefficientsFor(band, d * (0.65 + 0.35 * awake), NYQUIST),
  );
  const fillId = useSvgId('room-fill');
  const specRef = useRef<SVGPathElement>(null);
  const { ref, width } = useBoxWidth();

  useLiveSpectrumPath(
    specRef,
    playing,
    width,
    SCOPE_HEIGHT,
    SCOPE_HEIGHT * 0.76,
  );

  return (
    <ScopeBox
      boxRef={ref}
      width={width}
      active={active}
      playing={playing}
      live={live}
      className="scope-room"
    >
      {w => {
        const topY =
          ROOM_TOP_STANDBY + (ROOM_TOP_LIVE - ROOM_TOP_STANDBY) * awake;
        const lineFloor = SCOPE_HEIGHT - LINE_PAD_Y;
        const y = (db: number) =>
          topY +
          (Math.min(0, Math.max(ROOM_FLOOR_DB, db)) / ROOM_FLOOR_DB) *
            (lineFloor - topY);

        const points: { x: number; y: number }[] = [];
        const count = Math.max(48, Math.round(w / 2.5));
        const xStart = -1.5;
        const xEnd = w + 1.5;
        for (let p = 0; p <= count; p += 1) {
          const x = xStart + (p / count) * (xEnd - xStart);
          const hz = hzAtX(Math.max(0, Math.min(w, x)), w);
          points.push({ x, y: y(responseDb(coefficients, hz)) });
        }
        const line = polylinePath(points);
        const bottom = (SCOPE_HEIGHT + 1).toFixed(1);
        const area = `${line}L${xEnd.toFixed(1)} ${bottom}L${xStart.toFixed(1)} ${bottom}Z`;

        return (
          <>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" className="scope-fill-edge" />
                <stop offset="100%" className="scope-fill-mid" />
              </linearGradient>
            </defs>
            <path ref={specRef} className="scope-spectrum" />
            <path d={area} className="scope-area" fill={`url(#${fillId})`} />
            <path d={line} pathLength={1} className="scope-line" />
          </>
        );
      }}
    </ScopeBox>
  );
}
