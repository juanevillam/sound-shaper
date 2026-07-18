import { useEffect } from 'react';

import { subscribeToClips } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';

/**
 * Keep one song's clips slice live while the now-playing screen is mounted.
 * Not cleared on unmount: reopening the same song shows its cached clips
 * instantly (stale-while-revalidate, same as the songs subscription).
 */
export const useClipsSubscription = (
  playlistId: string | null,
  songId: string | undefined,
) => {
  const setClips = useClipsStore(s => s.setClips);

  useEffect(() => {
    if (!playlistId || !songId) return;

    return subscribeToClips({
      playlistId,
      songId,
      onNext: clips => setClips(songId, clips),
      onError: () => {},
    });
  }, [playlistId, songId, setClips]);
};
