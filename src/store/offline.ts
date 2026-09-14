import { create } from 'zustand';

/**
 * WHICH SOUNDS ARE ON THE PHONE — the render-visible half of the mirror
 * (`lib/offlineAudio.ts`), so a download landing re-renders the one thing that
 * cares: the engine's choice of source.
 *
 * The FILESYSTEM is the source of truth and this map is derived from it on
 * every sync pass, which is why nothing here is persisted. A store that
 * remembered "downloaded" across launches would be a second truth, and the
 * first thing to go stale the moment iOS reclaims space or a file is deleted
 * by any other route.
 */
type OfflineState = {
  /** soundId → local `file://` uri of a whole, playable file. */
  local: Record<string, string>;
  setLocal: (soundId: string, uri: string) => void;
  /** Replace the whole map — a sync pass's scan of the directory. */
  setAll: (local: Record<string, string>) => void;
  drop: (soundId: string) => void;
  clear: () => void;
};

const EMPTY: Record<string, string> = {};

export const useOfflineStore = create<OfflineState>()(set => ({
  local: EMPTY,
  setLocal: (soundId, uri) =>
    set(state =>
      state.local[soundId] === uri
        ? state
        : { local: { ...state.local, [soundId]: uri } },
    ),
  setAll: local => set({ local }),
  drop: soundId =>
    set(state => {
      if (!state.local[soundId]) return state;
      const local = { ...state.local };
      delete local[soundId];
      return { local };
    }),
  clear: () => set({ local: EMPTY }),
}));
