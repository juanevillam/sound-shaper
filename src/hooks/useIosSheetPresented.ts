import { Platform } from 'react-native';

import { usePathname } from 'expo-router';

import { IOS_FORM_SHEET_PATHS } from '@/lib/sheetRoutes';

/**
 * True while an iOS native form sheet (shaper, clips, editors, …) is the
 * focused route. Those sheets are UIKit presentations OVER the RN root, so
 * anything root-mounted (the trophy banner) is invisible under them — this is
 * the signal to hold such UI until the sheet dismisses. Sheets are plain stack
 * routes, so the focused pathname is exactly the presentation state: it flips
 * back on pop AND on the native swipe-down dismiss.
 *
 * Always false on Android: these surfaces there are Compose ModalBottomSheets
 * mounted in-place (the routes are never navigated to).
 */
export const useIosSheetPresented = () => {
  const pathname = usePathname();
  return Platform.OS === 'ios' && IOS_FORM_SHEET_PATHS.has(pathname);
};
