/**
 * `react-native-audio-api` on the web: the package copies the browser's Web
 * Audio API node for node, so the shared engine (`src/lib/audioEngine.ts`)
 * runs on the browser's own classes. Only what the engine imports is here.
 */
export type AudioNode = globalThis.AudioNode;
export type AudioParam = globalThis.AudioParam;
export type AudioBuffer = globalThis.AudioBuffer;
export type BiquadFilterNode = globalThis.BiquadFilterNode;
export type ConvolverNode = globalThis.ConvolverNode;
export type GainNode = globalThis.GainNode;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const AudioContext = globalThis.AudioContext;
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
