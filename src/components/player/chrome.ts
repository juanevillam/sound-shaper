import { Platform } from 'react-native';

import { type IconName } from '@portfolio/mobile-ui';

// Shared contracts for the player-console pieces that have platform twins
// (`PlayerScrubber`, `PlayerCards`, `PlayerMenuButton`, `ClipActionsRow`,
// `ClipHandles`).
//
// These live in their OWN module rather than in each component's base file on
// purpose: from inside `Foo.ios.tsx`, an import of `./Foo` resolves back to
// `Foo.ios.tsx` — Metro prefers the platform extension — so the file imports
// itself. Types survive that (they are erased), but any shared VALUE comes
// back `undefined`. A neutral module has no platform variant to collide with.

/**
 * Fixed height of the Shape/Clips card row. Android keeps the M3 two-line
 * card it shipped with; iOS runs shorter — the content is one title over one
 * caption, and an iOS list-style tile hugs that instead of padding it out.
 */
export const CARDS_HEIGHT = Platform.select({ ios: 76, default: 96 }) as number;

/** Fixed height of the clip-framing action row that replaces the cards. */
export const CLIP_ACTIONS_HEIGHT = 56;

/**
 * Height of the band the trim brackets ride in, laid over the scrubber's top
 * edge. It must not reach the elapsed/total label row below — on iOS the
 * SwiftUI slider host is 32pt, so the band matches it exactly.
 */
export const HANDLES_REGION_HEIGHT = Platform.select({
  ios: 32,
  default: 44,
}) as number;

export type PlayerScrubberProps = {
  /** Displayed playhead — the drag-local value while the thumb is held. */
  position: number;
  /** Slider range max; always > 0 so the track is never degenerate. */
  duration: number;
  /** The real track length, for the right-hand label. */
  totalDuration: number;
  /** Centre label while framing a clip ("0:36 – 0:42"), else null. */
  clipLabel?: string | null;
  onDrag: (value: number) => void;
  onDragEnd: () => void;
};

export type PlayerCard = {
  icon: IconName;
  key: string;
  label: string;
  onPress: () => void;
  summary: string;
};

export type PlayerCardsProps = {
  cards: readonly PlayerCard[];
};

export type PlayerMenuButtonProps = {
  onInfo: () => void;
  onEdit: () => void;
};

export type ClipActionsRowProps = {
  onCancel: () => void;
  onPreview: () => void;
  onSave: () => void;
};

export type ClipHandlesProps = {
  durationS: number;
  startS: number;
  endS: number;
  onChange: (startS: number, endS: number) => void;
};
