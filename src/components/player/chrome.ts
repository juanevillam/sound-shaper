import { type IconName } from '@portfolio/mobile-ui';

// Shared contracts for the player-console pieces that have platform twins
// (`PlayerScrubber`, `PlayerCards`, `PlayerMenuButton`, `ClipActionsRow`).
//
// These live in their OWN module rather than in each component's base file on
// purpose: from inside `Foo.ios.tsx`, an import of `./Foo` resolves back to
// `Foo.ios.tsx` — Metro prefers the platform extension — so the file imports
// itself. Types survive that (they are erased), but any shared VALUE comes
// back `undefined`. A neutral module has no platform variant to collide with.

/** Fixed height of the Shape/Clips card row. */
export const CARDS_HEIGHT = 96;

/** Fixed height of the clip-framing action row that replaces the cards. */
export const CLIP_ACTIONS_HEIGHT = 56;

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
