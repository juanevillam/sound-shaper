export { sampleAudio, stepEnvelope, type AudioSample } from '@app/lib/analyser';

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isTabHidden = (): boolean =>
  typeof document !== 'undefined' && document.hidden;
