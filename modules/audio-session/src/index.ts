import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeAudioSession = {
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
