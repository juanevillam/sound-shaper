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

/** Playback-rate label, e.g. `1.5×` in English, `1,5×` in Spanish.
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
