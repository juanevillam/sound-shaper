import { createLayoutStore } from '@/core';

import { SUPPORTED_LOCALES } from '@/i18n/translations';

// Locale preference lives here because it is tied to this app's translation set
// (`SUPPORTED_LOCALES`). Theme preference is app-agnostic and lives in
// `src/core`'s `useThemeStore`.
export const useLayoutStore = createLayoutStore(SUPPORTED_LOCALES, 'en');
