import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeAudioSession = {
  excludeFromBackup: (path: string) => void;
  isOtherAudioPlaying: () => boolean;
};

/**
 * OPTIONAL, so a build without the module (tests, an un-rebuilt dev client)
 * gets `null` rather than a throw at module scope.
 */
const native = requireOptionalNativeModule<NativeAudioSession>('AudioSession');

/**
 * Whether another app is playing audio right now. Ask it only while this
 * app's own player is silent: on Android the answer counts this app too.
 * Unknown (no native module) reads as `true`, the answer that keeps us quiet.
 */
export const isOtherAudioPlaying = (): boolean =>
  native ? native.isOtherAudioPlaying() : true;

/**
 * Keep a directory — and everything in it — out of the iCloud / Finder
 * backup. iOS only; a no-op on Android and without the native module (an
 * un-rebuilt dev client). Throws if iOS refused the attribute, so a caller
 * that treats it as best-effort catches.
 */
export const excludeFromBackup = (path: string): void => {
  native?.excludeFromBackup?.(path);
};
