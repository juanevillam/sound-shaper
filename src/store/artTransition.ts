import { create } from 'zustand';

// Hand-rolled shared-element handoff: the pressed tile measures its artwork
// in WINDOW coordinates and parks it here; the destination screen consumes it
// once and morphs an overlay copy from that rect into its hero. This exists
// because the real thing is off the table — Reanimated's sharedTransitionTag
// is compiled out on the new architecture — but our art surfaces are pure RN
// now, so they CAN be measured (unlike Topper's Compose-hosted thumbnails).
export type ArtHandoff = {
  /** Source rect, window coordinates (square tiles: size = width = height). */
  x: number;
  y: number;
  size: number;
  /** The artwork payload — playlist tiles are an emoji on a tinted square. */
  emoji: string;
};

type ArtTransitionState = {
  handoff: ArtHandoff | null;
  setHandoff: (handoff: ArtHandoff) => void;
  /** Read-and-clear: a handoff animates at most once. */
  consume: () => ArtHandoff | null;
};

export const useArtTransitionStore = create<ArtTransitionState>()(
  (set, get) => ({
    handoff: null,
    setHandoff: handoff => set({ handoff }),
    consume: () => {
      const { handoff } = get();

      if (handoff) set({ handoff: null });

      return handoff;
    },
  }),
);
