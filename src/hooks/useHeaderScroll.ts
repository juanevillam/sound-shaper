import { useHeaderScroll as useSharedHeaderScroll } from '@portfolio/mobile-ui';

/**
 * Thin adapter over the shared M3 app-bar hook — the threshold, the gesture-end
 * sampling and the measurements behind them live on `useHeaderScroll` in
 * `@portfolio/mobile-ui`.
 *
 * IT SUPPLIES NO COLOURS, so it writes nothing to the navigator's header. The
 * bar's ground is stated once in the stack's `screenOptions` and does not change
 * on scroll; the shared hook's docblock has the argument. What comes back is
 * `scrolled` plus the scroll props, which is all this app ever needed from it —
 * home draws its OWN bar as content (so the expanded player can cover it) and
 * paints it from `scrolled` itself.
 *
 * The `ownBar` flag went with the colours. It existed to stop the hook painting
 * a header that screen does not use, and there is no painting left to stop.
 */
export const useHeaderScroll = () => useSharedHeaderScroll();
