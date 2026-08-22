import {
  AudioContext,
  AudioManager,
  type AudioNode,
  type AudioTagHandle,
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
//   mediaSource → trim(gain) → band₀ … bandₙ (biquad) → destination
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

const flatGains = (): number[] => EQ_BANDS.map(() => 0);
const dbToLinear = (db: number): number => Math.pow(10, db / 20);

type Graph = {
  mediaSource: AudioNode;
  trim: GainNode;
  bands: BiquadFilterNode[];
};

let context: AudioContext | null = null;
let handle: AudioTagHandle | null = null;
let graph: Graph | null = null;

// The last-applied settings, so a freshly-built graph (new sound) inherits the
// current shaping instead of resetting to flat.
const settings = { gains: flatGains() };

/** Push `settings` onto the live graph, recomputing the headroom trim. */
const pushSettings = (): void => {
  if (!graph || !context) return;

  settings.gains.forEach((db, index) => {
    const band = graph?.bands[index];
    if (band) band.gain.value = db;
  });

  const trim = headroomTrimDb(EQ_BANDS, settings.gains, context.sampleRate);
  graph.trim.gain.value = dbToLinear(trim);
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

    let node: AudioNode = mediaSource;
    node.connect(trim);
    node = trim;
    for (const band of bands) {
      node.connect(band);
      node = band;
    }
    node.connect(ctx.destination);

    graph = { mediaSource, trim, bands };
    pushSettings();
  },

  /** Drop the previous sound's nodes so reloads don't accumulate orphans. */
  teardownGraph(): void {
    if (!graph) return;
    try {
      graph.mediaSource.disconnect();
      graph.trim.disconnect();
      graph.bands.forEach(band => band.disconnect());
    } catch {
      // The old media source rides a disposed <Audio>; ignore if already gone.
    }
    graph = null;
  },

  /** Push a full curve onto the live graph (preset / saved shape / reset). */
  apply(gains: number[]): void {
    settings.gains = [...gains];
    pushSettings();
  },

  setBandGain(index: number, db: number): void {
    settings.gains[index] = db;
    pushSettings();
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
