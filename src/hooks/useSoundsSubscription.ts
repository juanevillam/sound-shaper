import { useEffect } from 'react';

import { subscribeToSounds } from '@/services/firebase/sounds';
import { useSoundsStore } from '@/store/sounds';

/**
 * Keep the flat library slice in sync with users/{uid}/sounds for the whole
 * session (mounted once in the authenticated layout).
 */
export const useSoundsSubscription = () => {
  const setSounds = useSoundsStore(s => s.setSounds);
  const setError = useSoundsStore(s => s.setError);
  // Re-attaches the listener when the user retries after an error.
  const subNonce = useSoundsStore(s => s.subNonce);

  useEffect(
    () =>
      subscribeToSounds({
        onNext: setSounds,
        onError: setError,
      }),
    [setSounds, setError, subNonce],
  );
};
