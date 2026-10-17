import { useEffect } from 'react';

import { subscribeToClips } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';

/**
 * Keep one sound's clips slice live while the player is mounted. Not cleared
 * on unmount: reopening the same sound shows its cached clips instantly
 * (stale-while-revalidate, same as the sounds subscription).
 */
export const useClipsSubscription = (soundId: string | undefined) => {
  const setClips = useClipsStore(s => s.setClips);
  const setFailed = useClipsStore(s => s.setFailed);
  const retryNonce = useClipsStore(s => s.retryNonce);

  useEffect(() => {
    if (!soundId) return;

    return subscribeToClips({
      soundId,
      onNext: clips => setClips(soundId, clips),
      onError: () => setFailed(soundId),
    });
  }, [soundId, setClips, setFailed, retryNonce]);
};
