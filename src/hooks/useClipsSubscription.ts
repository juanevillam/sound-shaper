import { useEffect } from 'react';

import { subscribeToClips } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';

/**
 * Keep one song's clips slice live while the player is mounted. Not cleared
 * on unmount: reopening the same song shows its cached clips instantly
 * (stale-while-revalidate, same as the songs subscription).
 */
export const useClipsSubscription = (songId: string | undefined) => {
  const setClips = useClipsStore(s => s.setClips);

  useEffect(() => {
    if (!songId) return;

    return subscribeToClips({
      songId,
      onNext: clips => setClips(songId, clips),
      onError: () => {},
    });
  }, [songId, setClips]);
};
