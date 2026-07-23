import { useEffect } from 'react';

import { subscribeToShapes } from '@/services/firebase/shapes';
import { useShapesStore } from '@/store/shapes';

/**
 * Keep the saved shapes live while the shaper sheet is mounted. Not cleared on
 * unmount: reopening shows the cached chips instantly (stale-while-revalidate,
 * same as the clips subscription).
 */
export const useShapesSubscription = () => {
  const setShapes = useShapesStore(s => s.setShapes);

  useEffect(
    () =>
      subscribeToShapes({
        onNext: setShapes,
        onError: () => {},
      }),
    [setShapes],
  );
};
