import { useEffect, useRef } from 'react';

import {
  canPublishWidget,
  clearWidgetSnapshot,
  publishWidgetSnapshot,
  type WidgetMedia,
} from './index';

/**
 * THE PUBLISH PROTOCOL, WHICH IS THE SAME IN EVERY APP.
 *
 * What an app puts on the Home Screen differs completely — a library of
 * sounds, a shelf of tops — but the rules around it never do, and both apps had
 * written them out separately (83.7% identical, caught by
 * `scripts/shared-code-audit.mjs`):
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
export const useWidgetPublisher = ({
  appGroup,
  scope = '',
  build,
  ready,
  settleMs = 500,
  signature,
  signedIn,
}: {
  appGroup: string;
  /** Subfolder of the container, for an app carrying several widgets. */
  scope?: string;
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

  useEffect(() => {
    if (!canPublishWidget) return;

    if (!signedIn) {
      published.current = null;
      void clearWidgetSnapshot(appGroup, scope);

      return;
    }

    if (!ready || published.current === signature) return;

    let cancelled = false;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { media, snapshot } = await latestBuild.current();

          if (cancelled) return;

          await publishWidgetSnapshot({ appGroup, scope, media, snapshot });

          // Marked published only once it actually is. Marking before the await
          // would make a failed publish look done, and the signature would have
          // to change before anything tried again.
          published.current = signature;
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
    };
  }, [appGroup, ready, scope, settleMs, signature, signedIn]);
};
