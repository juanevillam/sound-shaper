import { useEffect } from 'react';

import { subscribeToSounds } from '@/services/firebase/sounds';
import { usePlayerStore } from '@/store/player';
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
        onNext: sounds => {
          setSounds(sounds);
          // The player keeps its OWN copy of the documents it loaded, so a
          // snapshot has to be handed to it as well or an edit never reaches
          // the banner. See `syncLibrary`.
          usePlayerStore.getState().syncLibrary(sounds);
        },
        onError: setError,
      }),
    [setSounds, setError, subNonce],
  );
};
