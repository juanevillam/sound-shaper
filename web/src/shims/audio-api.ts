/**
 * `react-native-audio-api` on the web: the package copies the browser's Web
 * Audio API node for node, so the shared engine (`src/lib/audioEngine.ts`)
 * runs on the browser's own classes.
 *
 * Read-only analyser tap: any `GainNode` connecting to `ctx.destination`
 * (`audioEngine`'s final `fade` node and `djFx`'s `level` node) also feeds a
 * passive, unconnected `AnalyserNode` so the scopes observe the exact post-DSP
 * signal without altering the music chain by a single bit.
 */
export type AudioNode = globalThis.AudioNode;
export type AudioParam = globalThis.AudioParam;
export type AudioBuffer = globalThis.AudioBuffer;
export type BiquadFilterNode = globalThis.BiquadFilterNode;
export type ConvolverNode = globalThis.ConvolverNode;
export type GainNode = globalThis.GainNode;

const NativeAudioContext = globalThis.AudioContext;

let activeTap: {
  context: globalThis.AudioContext;
  analyser: globalThis.AnalyserNode;
} | null = null;

/** Passive post-DSP tap on the shared `AudioContext`, null before first load. */
export const getAudioTap = () => activeTap;

class TappedAudioContext extends NativeAudioContext {
  private tapNode: globalThis.AnalyserNode | null = null;

  private ensureTap(): globalThis.AnalyserNode {
    if (!this.tapNode) {
      const analyser = this.createAnalyser();
      analyser.fftSize = 2048;
      analyser.minDecibels = -84;
      analyser.maxDecibels = -10;
      analyser.smoothingTimeConstant = 0.72;
      this.tapNode = analyser;
      activeTap = { context: this, analyser };
    }
    return this.tapNode;
  }

  override createGain(): globalThis.GainNode {
    const gain = super.createGain();
    const rawConnect = gain.connect.bind(gain) as (
      ...args: unknown[]
    ) => unknown;
    const rawDisconnect = gain.disconnect.bind(gain) as (
      ...args: unknown[]
    ) => void;
    const destination = this.destination;

    gain.connect = ((target: unknown, ...rest: unknown[]) => {
      const out = rawConnect(target, ...rest);
      if (target === destination) {
        try {
          rawConnect(this.ensureTap());
        } catch {
          // Ignore teardown races; the audio path itself is already wired.
        }
      }
      return out;
    }) as globalThis.GainNode['connect'];

    gain.disconnect = ((...args: unknown[]) => {
      rawDisconnect(...args);
      if (args.length === 0 || args[0] === destination) {
        if (this.tapNode) {
          try {
            rawDisconnect(this.tapNode);
          } catch {
            // Already disconnected.
          }
        }
      }
    }) as globalThis.GainNode['disconnect'];

    return gain;
  }
}

export const AudioContext =
  TappedAudioContext as unknown as typeof globalThis.AudioContext;
export type AudioContext = globalThis.AudioContext;

/**
 * The app's streaming <Audio> handle: on the web it IS the media element,
 * plus the one method the engine calls that the element names differently.
 */
export type AudioTagHandle = HTMLAudioElement & {
  seekToTime(seconds: number): void;
};

/** A media element made into the engine's handle. */
export const asHandle = (el: HTMLAudioElement): AudioTagHandle =>
  Object.assign(el, {
    seekToTime(seconds: number) {
      el.currentTime = seconds;
    },
  });

/** iOS's audio session has no web counterpart; a browser plays when asked. */
export const AudioManager = {
  setAudioSessionActivity: async (_active: boolean): Promise<void> => {},
};
