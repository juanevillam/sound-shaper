// Playback now runs through the sound-shaping graph — see `lib/audioEngine.ts`
// (the graph + transport) and `components/player/AudioEngine.tsx` (the mounted
// streaming <Audio> element). The audio session is activated on play and kept
// alive in the background by the media foreground service the audio-api config
// plugin installs, so there's no app-start session setup here anymore.

import type { Locale } from '@/i18n';

/** Seconds → "m:ss" for the scrubber's time labels. */
export const formatTime = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

/**
 * THE SPEED RANGE IS NARROW AND FINELY STEPPED, AND BOTH HALVES ARE THE SAME
 * DECISION (Juan, 2026-09-16). It was 0.5×–1.5× in tenths, which spent most of
 * a slider's travel on the two ends nobody reaches for: at 0.5× a song is a
 * dirge and at 1.5× it is a chipmunk, so eight of the eleven stops were there
 * to be scrolled past. 0.75×–1.25× in twentieths keeps the same eleven stops
 * and spends all of them where the listening actually happens — 0.85×, 0.95×,
 * 1.1×, 1.25× — so the useful speeds are picked rather than aimed at.
 *
 * THE RANGE IS SYMMETRIC AROUND 1× ON PURPOSE: the slider's midpoint is
 * "untouched", which is the one value a person has to be able to get back to
 * without reading the label.
 *
 * These live here rather than in either sheet because BOTH twins state them —
 * iOS's `(app)/shaper.tsx` and Android's `ShaperSheet.tsx` each carried their
 * own copy of all three, which is the drift `rateLabel` moved here to avoid.
 */
export const RATE_MIN = 0.75;
export const RATE_MAX = 1.25;
export const RATE_STEP = 0.05;

/**
 * Compose's `Slider` counts the stops BETWEEN the two ends, so the eleven
 * values 0.75 … 1.25 are nine. SwiftUI takes `step` directly and has no use
 * for this.
 */
export const RATE_SLIDER_STEPS =
  Math.round((RATE_MAX - RATE_MIN) / RATE_STEP) - 1;

/**
 * A slider's raw value → the nearest stop, clamped to the range.
 *
 * FLOAT MATH ON THESE STEPS DRIFTS, and it drifts twice over: a slider hands
 * back 0.7000000000000001 on its own, and `Math.round(v / 0.05) * 0.05` re-
 * introduces it (19 × 0.05 is 0.9500000000000001). The fixed-decimal pass is
 * what keeps a stop exactly the number its label prints, so `rate === 1`
 * — which the trophy trigger and the shape summary both test — stays true.
 *
 * It used to be `Math.round(value / RATE_STEP) / 10` inline in both sheets, a
 * form that silently encoded the step being a tenth.
 */
export const snapRate = (value: number): number => {
  const stepped = Math.round(value / RATE_STEP) * RATE_STEP;
  const clamped = Math.min(RATE_MAX, Math.max(RATE_MIN, stepped));
  return Number(clamped.toFixed(2));
};

/**
 * THE iOS SLIDER RUNS ON STOP INDICES, NOT ON RATES (2026-10-10). SwiftUI's
 * `Slider` draws its tick marks natively when given a `step` — Booker's Text
 * Size shows them — but at 0.75…1.25 by 0.05 the span is not a whole number
 * of steps in floating point (0.5 / 0.05 is 9.999…), and this slider drew
 * none. Index 0…`RATE_LAST_STOP` by 1 is exact; the rate is derived from it.
 */
export const RATE_LAST_STOP = Math.round((RATE_MAX - RATE_MIN) / RATE_STEP);

export const rateToStop = (rate: number): number =>
  Math.round((rate - RATE_MIN) / RATE_STEP);

export const stopToRate = (stop: number): number =>
  snapRate(RATE_MIN + Math.round(stop) * RATE_STEP);

/** Playback-rate label, e.g. `1.25×` in English, `1,25×` in Spanish.
 *
 *  THE SEPARATOR FOLLOWS THE APP'S LANGUAGE, NOT THE DEVICE'S. It used to be a
 *  hardcoded comma, so English and Chinese — both decimal-POINT locales — read
 *  "1,2×". The device locale is the wrong source of truth too: the app's
 *  language is its own setting, and the two disagree the moment somebody runs
 *  the app in Spanish on an English phone. So callers pass the `locale` they
 *  already hold from `useI18n`, the same way the trophy screens format their
 *  percentages and dates.
 *
 *  Lives here rather than in ShaperSheet so the iOS twin does not have to
 *  re-export it (a `Foo.ios.tsx` cannot import values from `./Foo`). */
export const rateLabel = (rate: number, locale: Locale) =>
  `${new Intl.NumberFormat(locale).format(rate)}\u00d7`;
