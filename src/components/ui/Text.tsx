import { useI18n, type TranslationKey } from '@/i18n';
import { createText } from '@/ui';

export type { TextVariant } from '@/ui';

// The component body lives in `src/ui`; this app's `TranslationKey`
// union flows in through `useI18n`'s translator, so the default (translating)
// variant still only accepts REAL translation keys — a typo'd key stays a
// compile error, never a runtime `[missing ...]` render.
export const Text = createText<TranslationKey>(useI18n);
