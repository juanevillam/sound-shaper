import { requireOptionalNativeModule } from 'expo-modules-core';

/** One sound as the widget needs it — nothing else crosses. */
export type WidgetLibraryItem = {
  artUrl: string;
  id: string;
  name: string;
};

type WidgetBridgeModule = {
  /**
   * Publish the library and every word the widget draws, then reload it.
   * Artwork is downloaded and cached into the shared container by the native
   * side; pass the same transformed URL the app displays.
   */
  syncLibrary: (
    items: WidgetLibraryItem[],
    strings: Record<string, string>,
  ) => Promise<void>;
  /** Wipe the shared container — sign-out and account deletion. */
  clear: () => Promise<void>;
};

/**
 * OPTIONAL, because this module is Apple-only and the import is not. Android
 * resolves the same file and must get `null` rather than a throw at module
 * scope — `requireNativeModule` would take the app down on launch there.
 */
export default requireOptionalNativeModule<WidgetBridgeModule>('WidgetBridge');
