import { useRef, useState } from 'react';

import { PlayerScrubber } from '@/components/player/PlayerScrubber';
import { usePlayerStore } from '@/store/player';

// ---------------------------------------------------------------------------
// THE ONE COMPONENT IN THE PLAYER THAT SUBSCRIBES TO `position`.
//
// The transport reports its position every 100ms (react-native-audio-api's
// `onPositionChangedInterval`), which is right — a playhead that ticks once a
// second visibly stutters against a dragging thumb. What was wrong is WHO that
// tick woke: `PlayerSheet` read `position` straight out of the store, so ten
// times a second the whole sheet re-rendered — every gesture recipe, both
// neighbour covers, the cards, the console's entire tree — to move one thumb
// and two labels. While COLLAPSED it did the same for a 3pt line.
//
// So the read lives at the leaf that draws it. `PlayerSheet` now hands down
// `onSeek` and nothing else time-varying; this component is the only one in
// the player that re-renders on the tick, and it has no children.
//
// The DRAG-LOCAL value lives here for the same reason. It used to be state on
// the sheet, which meant every frame of a scrub re-rendered the sheet too —
// the one moment in the player where that is least affordable.
// ---------------------------------------------------------------------------

type PlayerScrubberLiveProps = {
  /** Optical nudge for the elapsed/total TEXT; the track keeps the real edge. */
  copyInset?: number;
  /** Commit a scrub. Also ends any clip replay — see the store's `seek`. */
  onSeek: (seconds: number) => void;
};

export function PlayerScrubberLive({
  copyInset,
  onSeek,
}: PlayerScrubberLiveProps) {
  const storePosition = usePlayerStore(s => s.position);
  const storeDuration = usePlayerStore(s => s.duration);

  // Held while the thumb is down: the 100ms status stream would fight it.
  const [dragValue, setDragValue] = useState<number | null>(null);
  const lastDragRef = useRef(0);

  return (
    <PlayerScrubber
      copyInset={copyInset}
      position={dragValue ?? storePosition}
      // Never 0, so the track is never degenerate before the duration lands.
      duration={storeDuration > 0 ? storeDuration : 1}
      totalDuration={storeDuration}
      onDrag={value => {
        lastDragRef.current = value;
        setDragValue(value);
      }}
      onDragEnd={moved => {
        if (moved !== false) onSeek(lastDragRef.current);
        setDragValue(null);
      }}
    />
  );
}
