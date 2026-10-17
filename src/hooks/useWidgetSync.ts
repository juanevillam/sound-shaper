import {
  useWidgetPublisher,
  widgetMediaFile,
  type WidgetMedia,
} from '@modules/widget-bridge';

import { useI18n } from '@/i18n';
import { thumbUrl } from '@/services/cloudinary/thumbUrl';
import { recordError } from '@/services/firebase/crashlytics';
import { useAuthStore } from '@/store/auth';
import { useSoundsStore } from '@/store/sounds';

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

const APP_GROUP = 'group.com.grostify.soundshaper';

/**
 * PUBLISH THE LIBRARY TO THE HOME SCREEN WIDGET.
 *
 * The widget is a second process with its own sandbox: it holds no Firebase, no
 * session, and no copy. What it draws — the order, the artwork, the words — is
 * shaped HERE, because the wire format belongs to this app and its widget; the
 * rules around publishing are `useWidgetPublisher`'s (`modules/widget-bridge`),
 * because they do not depend on what the widget draws.
 */
export const useWidgetSync = () => {
  const { locale, t } = useI18n();
  const sounds = useSoundsStore(s => s.sounds);
  const hasSettled = useSoundsStore(s => s.hasSettled);
  const isDragging = useSoundsStore(s => s.isDragging);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  const wanted = sounds.slice(0, WIDGET_CAPACITY);

  useWidgetPublisher({
    appGroup: APP_GROUP,
    onError: error => recordError(error, 'widget.publish'),
    build: async () => {
      const media: WidgetMedia[] = [];
      const items = [];

      for (const sound of wanted) {
        const url = sound.artUrl ? thumbUrl(sound.artUrl, TILE_WIDTH) : '';
        const file = url ? await widgetMediaFile(url) : null;

        if (file && url) media.push({ file, url });

        items.push({ artwork: file, id: sound.id, name: sound.name });
      }

      return {
        media,
        snapshot: {
          items,
          strings: {
            description: t('widget.library.description'),
            displayName: t('widget.library.name'),
            empty: t('widget.library.empty'),
          },
          version: 1,
        },
      };
    },
    // A drag is not a settled order: hold until the finger lifts.
    ready: hasSettled && !isDragging,
    signature: JSON.stringify({
      locale,
      sounds: wanted.map(sound => `${sound.id}:${sound.artUrl}:${sound.name}`),
    }),
    signedIn: isAuthenticated,
  });
};
