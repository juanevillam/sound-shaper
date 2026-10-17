import * as Crypto from 'expo-crypto';
import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * ONE ASSET THE WIDGET WILL DRAW. `file` is what the snapshot references and
 * what the widget resolves inside the container's `media/` directory; `url` is
 * where to fetch it from if that file is not already there.
 */
export type WidgetMedia = {
  file: string;
  url: string;
};

type NativeWidgetBridge = {
  clear: (appGroup: string) => Promise<void>;
  publish: (
    appGroup: string,
    snapshot: string,
    media: WidgetMedia[],
  ) => Promise<void>;
};

/**
 * OPTIONAL, because this module is Apple-only and the import is not. Android
 * resolves the same file and must get `null` rather than a throw at module
 * scope.
 */
const native = requireOptionalNativeModule<NativeWidgetBridge>('WidgetBridge');

/** Whether an iOS widget can be published from this build at all. */
export const canPublishWidget = native !== null;

/**
 * THE FILE NAME BOTH PROCESSES AGREE ON, derived from the asset's own URL.
 *
 * It is computed HERE rather than natively because the widget reads the name
 * out of the snapshot, and the snapshot is written by this side — so the side
 * that names the file has to be the side that records the name. Being derived
 * from the URL also makes it content-addressed for free: a replaced cover is a
 * new name, so nothing races a cached file, and an unchanged one is never
 * fetched twice.
 */
export const widgetMediaFile = async (url: string): Promise<string> => {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    url,
  );

  return `${digest.slice(0, 16)}.img`;
};

/**
 * Publish an app's own snapshot — any JSON-serialisable shape, because the wire
 * format belongs to the app and its widget, not to this module — plus the
 * media it references, and reload the widget.
 *
 * A no-op off iOS.
 */
export const publishWidgetSnapshot = async ({
  appGroup,
  media,
  snapshot,
}: {
  appGroup: string;
  media: WidgetMedia[];
  snapshot: unknown;
}): Promise<void> => {
  await native?.publish(appGroup, JSON.stringify(snapshot), media);
};

/** Wipe the shared container — sign-out and account deletion. */
export const clearWidgetSnapshot = async (appGroup: string): Promise<void> => {
  await native?.clear(appGroup);
};

export { useWidgetPublisher } from './useWidgetPublisher';
