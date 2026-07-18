import { useEffect, useState } from 'react';

/**
 * True only once `delayMs` has elapsed since mount. A loading placeholder
 * (spinner, skeleton) waits this long before appearing, so a cached/instant
 * first snapshot — which settles inside the window — never flashes one.
 * Mount-scoped; not reset on rerender.
 */
export const useDelayedShow = (delayMs: number): boolean => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return show;
};
