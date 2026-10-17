import { useEffect, useRef, useState } from 'react';

import {
  canPublishWidget,
  clearWidgetSnapshot,
  publishWidgetSnapshot,
  type WidgetMedia,
} from './index';

/**
 * THE PUBLISH PROTOCOL — the rules around a publish, which do not depend on
 * what the widget draws. (In the portfolio this module came from, two apps had
 * written them out separately, 83.7% identical, before they were lifted here.)
 *
 *   · publish nothing until the first server snapshot has landed, because an
 *     empty collection and one nobody has asked for yet look identical from
 *     here, and the second would flash the widget's empty state every launch;
 *   · COALESCE, because a drag or a rename arrives as a burst of snapshots and
 *     the widget only needs where it stopped;
 *   · skip a render that changes nothing the widget can see, rather than
 *     re-entering the native side;
 *   · CLEAR ON SIGN-OUT — a widget keeps drawing its last snapshot until
 *     something replaces it, so somebody else's content left on the Home Screen
 *     is a privacy bug, not a stale cache;
 *   · drop an in-flight build whose inputs have already moved on.
 *
 * The app supplies only what is genuinely its own: the signature that says
 * something changed, and a `build` that turns its data into a snapshot.
 */
/**
 * How a publish with missing covers is retried: after 30s, then 60s, then 90s,
 * and then left to the next signature change or launch — a cover that fails
 * three times running is not coming back on its own this minute, and the
 * widget is drawing an art-less tile meanwhile, not an error.
 */
const MEDIA_RETRY_MS = 30_000;
const MAX_MEDIA_RETRIES = 3;

export const useWidgetPublisher = ({
  appGroup,
  build,
  ready,
  settleMs = 500,
  signature,
  signedIn,
}: {
  appGroup: string;
  /** Turn the app's current data into what the widget should draw. */
  build: () => Promise<{ media: WidgetMedia[]; snapshot: unknown }>;
  /** The data has actually arrived, and is not mid-gesture. */
  ready: boolean;
  settleMs?: number;
  /** Everything the widget can see, as one string. Changing it republishes. */
  signature: string;
  signedIn: boolean;
}) => {
  // `build` closes over this render's data and so is a new function every
  // render. Held in a ref rather than a dependency: `signature` is what decides
  // whether anything needs doing.
  const latestBuild = useRef(build);
  latestBuild.current = build;

  const published = useRef<string | null>(null);
  /**
   * A PUBLISH WITH A COVER MISSING IS NOT DONE. The writer reports how many
   * referenced files it could not fetch; while that is above zero the
   * signature is left unmarked, so the next pass for it publishes again, and
   * a bounded retry makes that next pass happen even when nothing else
   * changes. It used to be marked published regardless — a cover whose fetch
   * failed stayed missing until the next launch or the next edit.
   */
  const [retryTick, setRetryTick] = useState(0);
  const retries = useRef<{ signature: string; count: number }>({
    signature: '',
    count: 0,
  });

  useEffect(() => {
    if (!canPublishWidget) return;

    if (!signedIn) {
      published.current = null;
      void clearWidgetSnapshot(appGroup);

      return;
    }

    if (!ready || published.current === signature) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { media, snapshot } = await latestBuild.current();

          if (cancelled) return;

          const missing = await publishWidgetSnapshot({
            appGroup,
            media,
            snapshot,
          });

          if (cancelled) return;

          // Marked published only once it actually is — every cover included.
          // Marking before the await would make a failed publish look done,
          // and the signature would have to change before anything tried again.
          if (missing === 0) {
            published.current = signature;
            return;
          }

          if (retries.current.signature !== signature)
            retries.current = { signature, count: 0 };
          if (retries.current.count < MAX_MEDIA_RETRIES) {
            retries.current.count += 1;
            retryTimer = setTimeout(
              () => setRetryTick(tick => tick + 1),
              MEDIA_RETRY_MS * retries.current.count,
            );
          }
        } catch (error) {
          /**
           * A WIDGET FAILS SILENTLY BY NATURE — it just keeps drawing its last
           * snapshot, or its empty state — so a throw swallowed here is a bug
           * with no symptom to follow. Say it out loud.
           */
          console.warn('[widget-bridge] publish failed', error);
        }
      })();
    }, settleMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(retryTimer);
    };
  }, [appGroup, ready, retryTick, settleMs, signature, signedIn]);
};
