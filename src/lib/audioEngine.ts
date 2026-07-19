import {
  AudioContext,
  AudioManager,
  type AudioNode,
  type AudioTagHandle,
  type BiquadFilterNode,
  type GainNode,
} from 'react-native-audio-api';

// ---------------------------------------------------------------------------
// The sound-shaping engine: the ONE Web-Audio graph every song plays through.
// The <AudioEngine> component owns the streaming <Audio> element and calls
// `buildGraph` on load; this module holds the graph nodes and applies the
// shaper settings (which live in the shaper store) to them live.
//
//   mediaSource → preamp(gain) → band₀ … bandₙ (biquad) → destination
//
// Band gains are in dB (Web Audio biquad `gain` is dB for peaking/shelf); the
// preamp is a linear gain converted from dB.
// ---------------------------------------------------------------------------

export type EqBand = {
  hz: number;
  label: string;
  type: 'lowshelf' | 'peaking' | 'highshelf';
  q?: number;
};

// A musical 5-band graphic EQ: shelves at the extremes, peaks in between.
export const EQ_BANDS: EqBand[] = [
  { hz: 80, label: '80', type: 'lowshelf' },
  { hz: 250, label: '250', type: 'peaking', q: 1 },
  { hz: 1000, label: '1k', type: 'peaking', q: 1 },
  { hz: 4000, label: '4k', type: 'peaking', q: 1 },
  { hz: 12000, label: '12k', type: 'highshelf' },
];

export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;
export const PREAMP_MIN_DB = -12;
export const PREAMP_MAX_DB = 12;

const flatGains = (): number[] => EQ_BANDS.map(() => 0);
const dbToLinear = (db: number): number => Math.pow(10, db / 20);

type Graph = {
  mediaSource: AudioNode;
  preamp: GainNode;
  bands: BiquadFilterNode[];
};

let context: AudioContext | null = null;
let handle: AudioTagHandle | null = null;
let graph: Graph | null = null;

// The last-applied settings, so a freshly-built graph (new song) inherits the
// current shaping instead of resetting to flat.
const settings = { gains: flatGains(), preamp: 0 };

export const audioEngine = {
  /** The shared context — created lazily, reused for every song's graph. */
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

    const preamp = ctx.createGain();
    const bands = EQ_BANDS.map(band => {
      const filter = ctx.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.hz;
      if (band.q) filter.Q.value = band.q;
      filter.gain.value = 0;
      return filter;
    });

    let node: AudioNode = mediaSource;
    node.connect(preamp);
    node = preamp;
    for (const band of bands) {
      node.connect(band);
      node = band;
    }
    node.connect(ctx.destination);

    graph = { mediaSource, preamp, bands };
    this.apply(settings.gains, settings.preamp);
  },

  /** Drop the previous song's nodes so reloads don't accumulate orphans. */
  teardownGraph(): void {
    if (!graph) return;
    try {
      graph.mediaSource.disconnect();
      graph.preamp.disconnect();
      graph.bands.forEach(band => band.disconnect());
    } catch {
      // The old media source rides a disposed <Audio>; ignore if already gone.
    }
    graph = null;
  },

  /** Push a full settings snapshot onto the live graph (song change / reset). */
  apply(gains: number[], preamp: number): void {
    settings.gains = [...gains];
    settings.preamp = preamp;
    if (!graph) return;
    gains.forEach((db, index) => {
      const band = graph?.bands[index];
      if (band) band.gain.value = db;
    });
    graph.preamp.gain.value = dbToLinear(preamp);
  },

  setBandGain(index: number, db: number): void {
    settings.gains[index] = db;
    const band = graph?.bands[index];
    if (band) band.gain.value = db;
  },

  setPreamp(db: number): void {
    settings.preamp = db;
    if (graph) graph.preamp.gain.value = dbToLinear(db);
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
