import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// The app's ONE audio player, module-level so playback survives navigation
// (mini-player on the tabs, full now-playing screen, background). Screens
// observe it with `useAudioPlayerStatus(audioPlayer)`; all control goes
// through the player store's actions.
export const audioPlayer = createAudioPlayer(null, { updateInterval: 250 });

/**
 * One-time audio session setup (root layout): keep playing with the screen
 * off / app backgrounded, and behave like a music app toward other audio
 * (take focus, don't mix).
 */
export const configureAudioSession = (): Promise<void> =>
  setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
    interruptionModeAndroid: 'doNotMix',
  });

/** Seconds → "m:ss" for the scrubber's time labels. */
export const formatTime = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};
