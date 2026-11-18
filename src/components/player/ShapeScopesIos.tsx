import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  AppState,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { useReducedMotion } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import { useAppTheme, withAlpha } from '@/core';
import { sampleAudio, stepEnvelope } from '@/lib/analyser';
import { coefficientsFor, magnitudeAt } from '@/lib/eqResponse';
import {
  ECHO_LEVELS,
  EQ_BANDS,
  EQ_MAX_DB,
  NEXT_ROOM_LEVELS,
  NEXT_ROOM_SHELF_HZ,
  type EffectLevel,
} from '@/lib/shapeDsp';

/**
 * STUDIO PARAMETER SCOPES (iOS) — Equalizer, Echo, and Next Room.
 *
 * Direct iOS twin of `web/src/ui/Scopes.tsx`:
 * - Single compact height (`SCOPE_HEIGHT = 38`) standardized across all three
 *   previews in `Shape`.
 * - Every trace stays within `[LINE_PAD_Y, SCOPE_HEIGHT - LINE_PAD_Y]`
 *   (`6.5 pt` clear of both top and bottom separator) so the stroke never
 *   touches or blends into the separator line, while area washes and live
 *   spectrum fills anchor flush on the bottom border.
 * - Spring glide (`useGlide`), edit wake (`useEditWake`), and live post-DSP
 *   spectrum / echo trail (`sampleAudio` + `stepEnvelope`) that stops `rAF`
 *   completely once paused and settled.
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

const isAppBackgrounded = (): boolean =>
  AppState.currentState !== 'active' && AppState.currentState !== 'unknown';

export function useGlide(
  target: readonly number[],
  spans: readonly number[],
  reduceMotion = false,
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

    if (alreadySettled || reduceMotion || isAppBackgrounded()) {
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

    const sub = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') snap();
    });

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
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduceMotion]);

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

const useSvgId = (prefix: string) =>
  `${prefix}-${useId().replace(/[^\w-]/g, '')}`;

export const formatSignedDb = (
  value: number,
  locale = 'en',
  digits = 1,
): string =>
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
  onWidth,
  children,
}: {
  onWidth?: (width: number) => void;
  children: (width: number) => ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const cbRef = useRef(onWidth);
  cbRef.current = onWidth;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth(prev => {
      if (prev !== next) cbRef.current?.(next);
      return next;
    });
  }, []);

  return (
    <View
      onLayout={onLayout}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.box}
    >
      {width > 0 ? (
        <Svg
          width={width}
          height={SCOPE_HEIGHT}
          viewBox={`0 0 ${width} ${SCOPE_HEIGHT}`}
        >
          {children(width)}
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Background Indicator #2 for frequency-domain scopes (`EqScope` &
 * `NextRoomScope`): rises smoothly on Play and melts down into `y = height`
 * on Pause before stopping `rAF`.
 */
function useLiveSpectrumPath(
  playing: boolean,
  width: number,
  height: number,
  maxRisePx: number,
  reduceMotion: boolean,
): string {
  const [pathD, setPathD] = useState('');
  const binsRef = useRef<Float32Array | null>(null);
  const gateRef = useRef(0);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    if (width <= 4 || reduceMotion) {
      setPathD('');
      return;
    }

    const bins = 42;
    if (!binsRef.current || binsRef.current.length !== bins) {
      binsRef.current = new Float32Array(bins);
    }
    const smooth = binsRef.current;
    const raw = new Float32Array(bins);

    let initialPeak = 0;
    for (let i = 0; i < bins; i += 1) {
      if (smooth[i] > initialPeak) initialPeak = smooth[i];
    }
    if (!playing && initialPeak < 0.003 && gateRef.current < 0.003) {
      setPathD('');
      return;
    }

    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      if (isAppBackgrounded()) {
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
      const pts: { x: number; y: number }[] = [];
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
        pts.push({
          x: -1 + u * span,
          y: height - val * maxRisePx,
        });
      }

      if (peak > 0.003) {
        const curve = smoothSvgPath(pts);
        const bottom = (height + 1).toFixed(1);
        setPathD(`${curve}L${(width + 1).toFixed(1)} ${bottom}L-1 ${bottom}Z`);
      } else {
        setPathD('');
        if (!isPlaying) {
          smooth.fill(0);
          gateRef.current = 0;
          return;
        }
      }

      raf = requestAnimationFrame(loop);
    };

    const sub = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf && (playingRef.current || gateRef.current > 0.003)) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    });

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      sub.remove();
    };
  }, [playing, width, height, maxRisePx, reduceMotion]);

  return pathD;
}

function scopeOpacities(active: boolean, playing: boolean, live: boolean) {
  const areaOpacity = live ? 1 : active ? 0.56 : playing ? 0.52 : 0.24;
  const lineOpacity = live ? 1 : playing ? 0.72 : active ? 0.68 : 0.36;
  return { areaOpacity, lineOpacity };
}

// ── 1. Equalizer: compact 38pt 5-band biquad cascade + live spectrum ──────

const EQ_DB_SPAN = 15;
const EQ_SPANS = EQ_BANDS.map(() => EQ_MAX_DB * 2);

export function EqScope({
  gains,
  playing,
}: {
  gains: readonly number[];
  playing: boolean;
}) {
  const { colors, scheme } = useAppTheme();
  const isDark = scheme === 'dark';
  const reduceMotion = useReducedMotion();
  const editAwake = useEditWake(gains.join(','));
  const engaged = playing || editAwake;
  const targetGains = gains.map(g => g * (engaged ? 1 : 0.58));
  const { values, moving } = useGlide(targetGains, EQ_SPANS, reduceMotion);
  const fillId = useSvgId('eq-fill');
  const [measuredW, setMeasuredW] = useState(0);

  const active = gains.some(g => g !== 0);
  const live = active && (playing || moving || editAwake);
  const { areaOpacity, lineOpacity } = scopeOpacities(active, playing, live);

  const coefficients = EQ_BANDS.map((band, i) =>
    coefficientsFor(band, values[i] ?? 0, NYQUIST),
  );

  const spectrumD = useLiveSpectrumPath(
    playing,
    measuredW,
    SCOPE_HEIGHT,
    SCOPE_HEIGHT * 0.76,
    reduceMotion,
  );

  const edgeStopOpacity = isDark ? 0.14 : 0.08;
  const midStopOpacity = isDark ? 0.015 : 0.01;
  const specFill = withAlpha(colors.onSurface, isDark ? 0.08 : 0.045);
  const specStroke = withAlpha(colors.onSurface, isDark ? 0.17 : 0.11);

  return (
    <ScopeBox onWidth={setMeasuredW}>
      {width => {
        const mid = SCOPE_HEIGHT / 2;
        const swing = mid - LINE_PAD_Y;
        const y = (db: number) =>
          mid -
          (Math.max(-EQ_DB_SPAN, Math.min(EQ_DB_SPAN, db)) / EQ_DB_SPAN) *
            swing;

        const points: { x: number; y: number }[] = [];
        const count = Math.max(48, Math.round(width / 2.5));
        const xStart = -1.5;
        const xEnd = width + 1.5;
        for (let p = 0; p <= count; p += 1) {
          const x = xStart + (p / count) * (xEnd - xStart);
          const hz = hzAtX(Math.max(0, Math.min(width, x)), width);
          points.push({ x, y: y(responseDb(coefficients, hz)) });
        }
        const line = polylinePath(points);
        const area = `${line}L${xEnd.toFixed(1)} ${mid.toFixed(1)}L${xStart.toFixed(1)} ${mid.toFixed(1)}Z`;

        return (
          <>
            <Defs>
              <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0%"
                  stopColor={colors.onSurface}
                  stopOpacity={edgeStopOpacity}
                />
                <Stop
                  offset="50%"
                  stopColor={colors.onSurface}
                  stopOpacity={midStopOpacity}
                />
                <Stop
                  offset="100%"
                  stopColor={colors.onSurface}
                  stopOpacity={edgeStopOpacity}
                />
              </LinearGradient>
            </Defs>
            {spectrumD ? (
              <Path
                d={spectrumD}
                fill={specFill}
                stroke={specStroke}
                strokeWidth={0.75}
              />
            ) : null}
            {EQ_BANDS.map(band => {
              const bx = freqX(band.hz, width);
              return (
                <Line
                  key={band.hz}
                  x1={bx}
                  x2={bx}
                  y1={0}
                  y2={SCOPE_HEIGHT}
                  stroke={colors.listSeparator}
                  strokeWidth={0.75}
                  strokeDasharray="1.5, 2"
                />
              );
            })}
            <Line
              x1={-1}
              x2={width + 1}
              y1={mid}
              y2={mid}
              stroke={colors.listSeparator}
              strokeWidth={0.9}
            />
            <Path d={area} fill={`url(#${fillId})`} opacity={areaOpacity} />
            {isDark && live ? (
              <Path
                d={line}
                fill="none"
                stroke="#B8DCFF"
                strokeWidth={3.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.22}
              />
            ) : null}
            <Path
              d={line}
              fill="none"
              stroke={colors.onSurface}
              strokeWidth={1.45}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={lineOpacity}
            />
            {EQ_BANDS.map((band, i) => {
              const bandActive = gains[i] !== 0;
              const nodeOpacity = bandActive
                ? live
                  ? 1
                  : 0.85
                : playing
                  ? 0.9
                  : 0.65;
              return (
                <Circle
                  key={band.hz}
                  cx={freqX(band.hz, width)}
                  cy={y(responseDb(coefficients, band.hz))}
                  r={NODE_R}
                  fill={bandActive ? colors.onSurface : colors.onSurfaceMuted}
                  opacity={nodeOpacity}
                />
              );
            })}
          </>
        );
      }}
    </ScopeBox>
  );
}

// ── 2. Echo: compact 38pt reflection curve + live propagating trail ───────

const ECHO_WAVES = 5.5;
const ECHO_SPANS = [0.5, 1, 1] as const;

function echoDecayRate(fb: number, rippleAmt: number): number {
  const norm = Math.max(0, Math.min(1, (fb - 0.22) / 0.26));
  const activeDecay = 3.2 - norm * 1.95;
  return 5.4 * (1 - rippleAmt) + activeDecay * rippleAmt;
}

function useLiveEchoTrail(
  playing: boolean,
  width: number,
  height: number,
  decayRef: React.RefObject<number>,
  reduceMotion: boolean,
): string {
  const [pathD, setPathD] = useState('');
  const historyRef = useRef<Float32Array | null>(null);
  const gateRef = useRef(0);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    if (width <= 4 || reduceMotion) {
      setPathD('');
      return;
    }

    const slots = 48;
    if (!historyRef.current || historyRef.current.length !== slots) {
      historyRef.current = new Float32Array(slots);
    }
    const history = historyRef.current;

    let initialPeak = 0;
    for (let i = 0; i < slots; i += 1) {
      if (history[i] > initialPeak) initialPeak = history[i];
    }
    if (!playing && initialPeak < 0.003 && gateRef.current < 0.003) {
      setPathD('');
      return;
    }

    let headEnv = history[0] ?? 0;
    let accum = 0;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      if (isAppBackgrounded()) {
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
      const pts: { x: number; y: number }[] = [];

      for (let i = 0; i < slots; i += 1) {
        const u = i / (slots - 1);
        const atten = Math.exp(-decay * 0.72 * u);
        const val = history[i] * atten * (isPlaying ? 1 : gateRef.current);
        if (val > peak) peak = val;
        pts.push({
          x: -1 + u * span,
          y: height - val * maxRise,
        });
      }

      if (peak > 0.003) {
        const curve = smoothSvgPath(pts);
        const bottom = (height + 1).toFixed(1);
        setPathD(`${curve}L${(width + 1).toFixed(1)} ${bottom}L-1 ${bottom}Z`);
      } else {
        setPathD('');
        if (!isPlaying) {
          history.fill(0);
          gateRef.current = 0;
          return;
        }
      }

      raf = requestAnimationFrame(loop);
    };

    const sub = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf && (playingRef.current || gateRef.current > 0.003)) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    });

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      sub.remove();
    };
  }, [playing, width, height, decayRef, reduceMotion]);

  return pathD;
}

export function EchoScope({
  level,
  playing,
}: {
  level: EffectLevel;
  playing: boolean;
}) {
  const { colors, scheme } = useAppTheme();
  const isDark = scheme === 'dark';
  const reduceMotion = useReducedMotion();
  const active = level !== 'off';
  const editAwake = useEditWake(level);
  const engaged = playing || editAwake ? 1 : 0.74;
  const targetFb = active ? ECHO_LEVELS[level].feedback : 0.22;
  const { values, moving } = useGlide(
    [targetFb, active ? 1 : 0, engaged],
    ECHO_SPANS,
    reduceMotion,
  );
  const [fb, rippleAmt, posture] = values;
  const live = active && (playing || moving || editAwake);
  const { areaOpacity, lineOpacity } = scopeOpacities(active, playing, live);
  const fillId = useSvgId('echo-fill');
  const [measuredW, setMeasuredW] = useState(0);

  const decay = echoDecayRate(fb, rippleAmt);
  const decayRef = useRef(decay);
  decayRef.current = decay;

  const trailD = useLiveEchoTrail(
    playing,
    measuredW,
    SCOPE_HEIGHT,
    decayRef,
    reduceMotion,
  );

  const edgeStopOpacity = isDark ? 0.14 : 0.08;
  const midStopOpacity = isDark ? 0.015 : 0.01;
  const specFill = withAlpha(colors.onSurface, isDark ? 0.08 : 0.045);
  const specStroke = withAlpha(colors.onSurface, isDark ? 0.17 : 0.11);

  return (
    <ScopeBox onWidth={setMeasuredW}>
      {width => {
        const lineFloor = SCOPE_HEIGHT - LINE_PAD_Y;
        const lineSpan = lineFloor - LINE_PAD_Y;
        const maxRise = lineSpan * (0.68 + 0.32 * rippleAmt) * posture;
        const xStart = -1.5;
        const xEnd = width + 1.5;
        const count = Math.max(56, Math.round(width / 2));
        const pts: { x: number; y: number }[] = [];

        for (let p = 0; p <= count; p += 1) {
          const x = xStart + (p / count) * (xEnd - xStart);
          const u = Math.max(0, Math.min(1, x / Math.max(1, width)));
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
            <Defs>
              <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0%"
                  stopColor={colors.onSurface}
                  stopOpacity={edgeStopOpacity}
                />
                <Stop
                  offset="100%"
                  stopColor={colors.onSurface}
                  stopOpacity={midStopOpacity}
                />
              </LinearGradient>
            </Defs>
            {trailD ? (
              <Path
                d={trailD}
                fill={specFill}
                stroke={specStroke}
                strokeWidth={0.75}
              />
            ) : null}
            <Path d={area} fill={`url(#${fillId})`} opacity={areaOpacity} />
            {isDark && live ? (
              <Path
                d={line}
                fill="none"
                stroke="#B8DCFF"
                strokeWidth={3.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.22}
              />
            ) : null}
            <Path
              d={line}
              fill="none"
              stroke={colors.onSurface}
              strokeWidth={1.45}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={lineOpacity}
            />
          </>
        );
      }}
    </ScopeBox>
  );
}

// ── 3. Next Room: compact 38pt 3-shelf wall roll-off + live spectrum ──────

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
  const { colors, scheme } = useAppTheme();
  const isDark = scheme === 'dark';
  const reduceMotion = useReducedMotion();
  const active = level !== 'off';
  const editAwake = useEditWake(level);
  const engaged = playing || editAwake ? 1 : 0;
  const depth = active ? NEXT_ROOM_LEVELS[level].depthDb : 0;
  const { values, moving } = useGlide(
    [depth, engaged],
    ROOM_SPANS,
    reduceMotion,
  );
  const [d, awake] = values;
  const live = active && (playing || moving || editAwake);
  const { areaOpacity, lineOpacity } = scopeOpacities(active, playing, live);
  const coefficients = ROOM_SHELVES.map(band =>
    coefficientsFor(band, d * (0.65 + 0.35 * awake), NYQUIST),
  );
  const fillId = useSvgId('room-fill');
  const [measuredW, setMeasuredW] = useState(0);

  const spectrumD = useLiveSpectrumPath(
    playing,
    measuredW,
    SCOPE_HEIGHT,
    SCOPE_HEIGHT * 0.76,
    reduceMotion,
  );

  const edgeStopOpacity = isDark ? 0.14 : 0.08;
  const midStopOpacity = isDark ? 0.015 : 0.01;
  const specFill = withAlpha(colors.onSurface, isDark ? 0.08 : 0.045);
  const specStroke = withAlpha(colors.onSurface, isDark ? 0.17 : 0.11);

  return (
    <ScopeBox onWidth={setMeasuredW}>
      {width => {
        const topY =
          ROOM_TOP_STANDBY + (ROOM_TOP_LIVE - ROOM_TOP_STANDBY) * awake;
        const lineFloor = SCOPE_HEIGHT - LINE_PAD_Y;
        const y = (db: number) =>
          topY +
          (Math.min(0, Math.max(ROOM_FLOOR_DB, db)) / ROOM_FLOOR_DB) *
            (lineFloor - topY);

        const points: { x: number; y: number }[] = [];
        const count = Math.max(48, Math.round(width / 2.5));
        const xStart = -1.5;
        const xEnd = width + 1.5;
        for (let p = 0; p <= count; p += 1) {
          const x = xStart + (p / count) * (xEnd - xStart);
          const hz = hzAtX(Math.max(0, Math.min(width, x)), width);
          points.push({ x, y: y(responseDb(coefficients, hz)) });
        }
        const line = polylinePath(points);
        const bottom = (SCOPE_HEIGHT + 1).toFixed(1);
        const area = `${line}L${xEnd.toFixed(1)} ${bottom}L${xStart.toFixed(1)} ${bottom}Z`;

        return (
          <>
            <Defs>
              <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0%"
                  stopColor={colors.onSurface}
                  stopOpacity={edgeStopOpacity}
                />
                <Stop
                  offset="100%"
                  stopColor={colors.onSurface}
                  stopOpacity={midStopOpacity}
                />
              </LinearGradient>
            </Defs>
            {spectrumD ? (
              <Path
                d={spectrumD}
                fill={specFill}
                stroke={specStroke}
                strokeWidth={0.75}
              />
            ) : null}
            <Path d={area} fill={`url(#${fillId})`} opacity={areaOpacity} />
            {isDark && live ? (
              <Path
                d={line}
                fill="none"
                stroke="#B8DCFF"
                strokeWidth={3.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.22}
              />
            ) : null}
            <Path
              d={line}
              fill="none"
              stroke={colors.onSurface}
              strokeWidth={1.45}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={lineOpacity}
            />
          </>
        );
      }}
    </ScopeBox>
  );
}

const styles = StyleSheet.create({
  box: {
    height: SCOPE_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
});
