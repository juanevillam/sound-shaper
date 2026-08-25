import { useRef, useState } from 'react';

import { PlayerScrubber } from '@/components/player/PlayerScrubber';
import { usePlayerStore } from '@/store/player';

import { type PlayerScrubberProps } from './chrome';

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
// `onSeek` and nothing else time-varying; this component and `BannerProgress`
// are the only two that re-render on the tick, and neither has children.
//
// The DRAG-LOCAL value lives here for the same reason. It used to be state on
// the sheet, which meant every frame of a scrub re-rendered the sheet too —
// the one moment in the player where that is least affordable.
// ---------------------------------------------------------------------------

type PlayerScrubberLiveProps = {
  /** Optical nudge for the elapsed/total TEXT; the track keeps the real edge. */
  copyInset?: number;
  /** Centre label while framing a clip ("0:36 – 0:42"), else null. */
  clipLabel?: string | null;
  /** iOS only: the trim frame's live edges — see `PlayerScrubberProps`. */
  clipRangeSv?: PlayerScrubberProps['clipRangeSv'];
  /** Commit a scrub. Also ends any clip replay — see the store's `seek`. */
  onSeek: (seconds: number) => void;
};

export function PlayerScrubberLive({
  copyInset,
  clipLabel,
  clipRangeSv,
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
      clipLabel={clipLabel}
      clipRangeSv={clipRangeSv}
      onDrag={value => {
        lastDragRef.current = value;
        setDragValue(value);
      }}
      onDragEnd={() => {
        onSeek(lastDragRef.current);
        setDragValue(null);
      }}
    />
  );
}
