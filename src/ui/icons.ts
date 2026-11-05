import { type ImageProps } from '@expo/ui/swift-ui';

/**
 * Single source of truth mapping the app's icon names to SF Symbols. The names
 * are Material's — the set began as Material Symbols, when there was an Android
 * app — and stay so callers do not churn.
 */
export const SF_SYMBOLS = {
  add: 'plus',
  'content-cut': 'scissors',
  chevron: 'chevron.right',
  delete: 'trash',
  edit: 'pencil',
  // THE SOUNDING-ROW MARKER, and the SF side is not a translation of the
  // Material glyph — it is what this app's own iOS twin already draws for the
  // identical job. Sound Shaper's `clips` route marks the playing row with
  // `speaker.wave.2.fill`, so mapping the Material equalizer bars onto
  // `waveform` would have put two different marks on one feature's two
  // platforms. The name stays Material's because the icon SET is.
  'graphic-eq': 'speaker.wave.2.fill',
  image: 'photo',
  'more-vert': 'ellipsis',
  'music-note': 'music.note',
  person: 'person',
  settings: 'gearshape',
  tune: 'slider.horizontal.3',
  warning: 'exclamationmark.triangle',
} satisfies Record<string, NonNullable<ImageProps['systemName']>>;

export type IconName = keyof typeof SF_SYMBOLS;
