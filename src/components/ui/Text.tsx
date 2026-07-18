import { createText } from '@portfolio/mobile-ui';

import { useI18n, type TranslationKey } from '@/i18n';

export type { TextVariant } from '@portfolio/mobile-ui';

// The component body lives in @portfolio/mobile-ui; this app's `TranslationKey`
// union flows in through `useI18n`'s translator, so the default (translating)
// variant still only accepts REAL translation keys — a typo'd key stays a
// compile error, never a runtime `[missing ...]` render.
export const Text = createText<TranslationKey>(useI18n);
