import {
  AudioContext,
  AudioManager,
  type AudioNode,
  type AudioParam,
  type AudioTagHandle,
  type AnalyserNode,
  type BiquadFilterNode,
  type GainNode,
} from 'react-native-audio-api';

import { headroomTrimDb } from './eqResponse';

// ---------------------------------------------------------------------------
// The sound-shaping engine: the ONE Web-Audio graph every sound plays through.
// The <AudioEngine> component owns the streaming <Audio> element and calls
// `buildGraph` on load; this module holds the graph nodes and applies the
// shaper settings (which live in the shaper store) to them live.
//
//   mediaSource → trim(gain) → band₀ … bandₙ (biquad) → analyser → destination
//
// Band gains are in dB (Web Audio biquad `gain` is dB for peaking/shelf). The
// trim is a linear gain converted from dB, and it is DERIVED, never chosen —
// see below.
// ---------------------------------------------------------------------------

export type EqBand = {
  hz: number;
  label: string;
  type: 'lowshelf' | 'peaking' | 'highshelf';
  q?: number;
};

// A musical 5-band graphic EQ: shelves at the extremes, peaks in between.
// The shelves declare no `q` ON PURPOSE — the native filter's shelf
// coefficients take no Q at all (slope is hardcoded S = 1), so one would be
// silently ignored. See `eqResponse.ts`.
export const EQ_BANDS: EqBand[] = [
  { hz: 80, label: '80', type: 'lowshelf' },
  { hz: 250, label: '250', type: 'peaking', q: 1 },
  { hz: 1000, label: '1k', type: 'peaking', q: 1 },
  { hz: 4000, label: '4k', type: 'peaking', q: 1 },
  { hz: 12000, label: '12k', type: 'highshelf' },
];

export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;

// ---------------------------------------------------------------------------
// THERE IS NO PREAMP CONTROL, AND THAT IS THE POINT.
//
// The trim in front of the filters is computed from the curve itself
// (`headroomTrimDb`) so a boost cannot clip. It was previously a manual dB
// setting that defaulted to 0 and had NO UI on either platform — no slider, no
// row, and its `player.eq.preamp` string was never rendered — so in practice
// the chain ran with no headroom protection at all. A second, hand-driven
// preamp beside the automatic one would only raise the question of which is
// which, so there is exactly one gain node and one meaning for it.
// ---------------------------------------------------------------------------

// How fast a parameter moves to a new value. An instantaneous AudioParam write
// is a step discontinuity in the signal — measured at 30.9x the natural
// sample-to-sample slew of a 100 Hz tone on a preset change, and 19.1x while
// dragging a band in 1 dB steps. That is the click, and the zipper noise.
// Scheduling the same moves with `setTargetAtTime` puts both back at ~1x, i.e.
// gone.
//
// 12 ms is a one-pole time constant, so a move is ~95% done in 36 ms: short
// enough that dragging still feels live, long enough that nothing steps. The
// SAME constant drives the trim, which was verified rather than assumed — on a
// limited master a flat→bass switch peaks at -0.40 dBFS mid-transition, so the
// trim never lags the boost it is compensating.
const RAMP_SECONDS = 0.012;

const flatGains = (): number[] => EQ_BANDS.map(() => 0);
const dbToLinear = (db: number): number => Math.pow(10, db / 20);

type Graph = {
  mediaSource: AudioNode;
  trim: GainNode;
  bands: BiquadFilterNode[];
  analyser: AnalyserNode;
};

/**
 * THE OUTPUT TAP — what the expanded player's backdrop breathes on.
 *
 * It sits at the END of the chain, after the bands, so it measures what the
 * person is actually HEARING rather than what the file contains: a curve that
 * scoops the mids is visible in the wash, and so is the headroom trim. It also
 * has to be BETWEEN the last band and `destination` rather than hung off the
 * side, because a node nothing pulls from is never rendered.
 *
 * IT IS RATE-CORRECT BY CONSTRUCTION, which is the whole reason it is here
 * rather than a timer. `NowPlayingBars` keeps time with the music by dividing
 * its durations by `rate` — a metronome that ignores the content. This is the
 * content, at whatever speed it is being played, with no multiplier to keep in
 * sync and nothing to get wrong when the rate changes mid-sound.
 *
 * `fftSize` is the smallest the spec allows. The consumer wants ONE number —
 * an envelope — and a bigger window buys resolution nobody reads while costing
 * a bigger array to copy on every poll.
 */
const ANALYSER_FFT_SIZE = 32;

let context: AudioContext | null = null;
let handle: AudioTagHandle | null = null;
let graph: Graph | null = null;

// The last-applied settings, so a freshly-built graph (new sound) inherits the
// current shaping instead of resetting to flat.
const settings = { gains: flatGains() };

/**
 * A fresh graph starts at its target outright; a live change slides there.
 * Fading the EQ in over the first 36 ms of a sound would be its own artefact.
 */
const writeParam = (
  param: AudioParam,
  value: number,
  at: number,
  immediate: boolean,
): void => {
  if (immediate) param.setValueAtTime(value, at);
  else param.setTargetAtTime(value, at, RAMP_SECONDS);
};

/** Push `settings` onto the live graph, recomputing the headroom trim. */
const pushSettings = (immediate: boolean): void => {
  if (!graph || !context) return;

  const at = context.currentTime;
  settings.gains.forEach((db, index) => {
    const band = graph?.bands[index];
    if (band) writeParam(band.gain, db, at, immediate);
  });

  const trim = headroomTrimDb(EQ_BANDS, settings.gains, context.sampleRate);
  writeParam(graph.trim.gain, dbToLinear(trim), at, immediate);
};

export const audioEngine = {
  /** The shared context — created lazily, reused for every sound's graph. */
  getContext(): AudioContext {
    if (!context) context = new AudioContext();
    return context;
  },

  registerHandle(next: AudioTagHandle | null): void {
    handle = next;
  },

  /**
   * Wire the just-loaded media element through a fresh EQ chain. Call from the
   * <Audio> `onLoad` (createMediaElementSource throws before the source is
   * ready). The previous graph's nodes are dropped with their <Audio>.
   */
  buildGraph(tag: AudioTagHandle): void {
    this.teardownGraph();

    const ctx = this.getContext();
    const mediaSource = ctx.createMediaElementSource(tag);

    const trim = ctx.createGain();
    const bands = EQ_BANDS.map(band => {
      const filter = ctx.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.hz;
      if (band.q) filter.Q.value = band.q;
      filter.gain.value = 0;
      return filter;
    });

    const analyser = ctx.createAnalyser();
    analyser.fftSize = ANALYSER_FFT_SIZE;

    let node: AudioNode = mediaSource;
    node.connect(trim);
    node = trim;
    for (const band of bands) {
      node.connect(band);
      node = band;
    }
    node.connect(analyser);
    analyser.connect(ctx.destination);

    graph = { mediaSource, trim, bands, analyser };
    pushSettings(true);
  },

  /** Drop the previous sound's nodes so reloads don't accumulate orphans. */
  teardownGraph(): void {
    if (!graph) return;
    try {
      graph.mediaSource.disconnect();
      graph.trim.disconnect();
      graph.bands.forEach(band => band.disconnect());
      graph.analyser.disconnect();
    } catch {
      // The old media source rides a disposed <Audio>; ignore if already gone.
    }
    graph = null;
  },

  /**
   * The CURRENT OUTPUT LEVEL, 0..1 — RMS of the time-domain window.
   *
   * RMS, NOT PEAK, AND THAT IS A REVERSAL. This returned the window's peak
   * first, on the reasoning that a light should answer to the loud moment
   * rather than to an average. On device that read as FLASHING — Juan's word,
   * and the right one: a peak over 32 samples jumps on every transient, so the
   * light strobed at the attack of each hit instead of glowing with the music.
   *
   * RMS is the energy of the window rather than its worst sample, which is
   * what "how loud is this right now" actually means to an ear. It is also the
   * measure that makes the envelope in `useAudioLevel` meaningful — smoothing
   * a spike train mostly just delays the spikes.
   *
   * Returns 0 when there is no graph, which is the honest answer between
   * sounds and the one that lets the light settle rather than freeze.
   */
  level(): number {
    if (!graph) return 0;

    const samples = new Float32Array(graph.analyser.fftSize);
    graph.analyser.getFloatTimeDomainData(samples);

    let sumSquares = 0;
    for (const sample of samples) sumSquares += sample * sample;

    return Math.min(Math.sqrt(sumSquares / samples.length), 1);
  },

  /** Push a full curve onto the live graph (preset / saved shape / reset). */
  apply(gains: number[]): void {
    settings.gains = [...gains];
    pushSettings(false);
  },

  setBandGain(index: number, db: number): void {
    settings.gains[index] = db;
    pushSettings(false);
  },

  // --- Transport (delegates to the streaming <Audio> handle) ---------------
  play(): void {
    handle?.play();
  },
  pause(): void {
    handle?.pause();
  },
  seek(seconds: number): void {
    handle?.seekToTime(seconds);
  },

  /** Activate the audio session (playback category, keeps the FG service). */
  activateSession(): Promise<void> {
    return AudioManager.setAudioSessionActivity(true);
  },
};
