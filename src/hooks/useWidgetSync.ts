import { useEffect, useRef } from 'react';

import { Platform } from 'react-native';

import { useI18n } from '@/i18n';
import { thumbUrl } from '@/services/cloudinary/thumbUrl';
import { useAuthStore } from '@/store/auth';
import { useSoundsStore } from '@/store/sounds';

import WidgetBridge from '../../modules/widget-bridge';

/**
 * HOW MANY SOUNDS THE HOME SCREEN CAN HOLD — the largest family's capacity,
 * 4 columns × 4 rows in `targets/widget/LibraryWidget.swift`. Sending more
 * would download artwork nothing can draw.
 */
const WIDGET_CAPACITY = 16;

/**
 * A widget tile comes to roughly 80pt at every family; `thumbUrl` doubles for
 * density, so this asks Cloudinary for w_192 rather than a full-size cover.
 */
const TILE_WIDTH = 96;

/**
 * The grid is DRAGGED, and every intermediate order is a snapshot. Coalesce —
 * the widget only ever needs where the finger stopped.
 */
const SETTLE_MS = 500;

/**
 * PUBLISH THE LIBRARY TO THE HOME SCREEN WIDGET.
 *
 * The widget is a second process with its own sandbox: it holds no Firebase,
 * no session, and no copy. Everything it draws — the order, the artwork, the
 * words — is written here into the shared App Group container, and WidgetKit
 * is asked to reload at the same moment.
 *
 * Signing out CLEARS it. A widget keeps drawing its last snapshot until
 * something replaces it, so somebody else's library sitting on the Home Screen
 * after a sign-out would be a privacy bug rather than a stale cache.
 */
export const useWidgetSync = () => {
  const { locale, t } = useI18n();
  const sounds = useSoundsStore(s => s.sounds);
  const hasSettled = useSoundsStore(s => s.hasSettled);
  const isDragging = useSoundsStore(s => s.isDragging);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  // What was last published, so a re-render that changes nothing the widget
  // can see does not re-enter the native side.
  const published = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !WidgetBridge) return;

    if (!isAuthenticated) {
      published.current = null;
      void WidgetBridge.clear();

      return;
    }

    // Nothing is published before the first snapshot lands: an empty library
    // and a library nobody has asked for yet look identical from here, and
    // the second one would flash the widget's empty state on every launch.
    if (!hasSettled || isDragging) return;

    const items = sounds.slice(0, WIDGET_CAPACITY).map(sound => ({
      artUrl: sound.artUrl ? thumbUrl(sound.artUrl, TILE_WIDTH) : '',
      id: sound.id,
      name: sound.name,
    }));

    const strings = {
      description: t('widget.library.description'),
      displayName: t('widget.library.name'),
      empty: t('widget.library.empty'),
    };

    const signature = JSON.stringify({ items, locale, strings });

    if (published.current === signature) return;

    const timer = setTimeout(() => {
      published.current = signature;
      void WidgetBridge?.syncLibrary(items, strings);
    }, SETTLE_MS);

    return () => clearTimeout(timer);
  }, [hasSettled, isAuthenticated, isDragging, locale, sounds, t]);
};
