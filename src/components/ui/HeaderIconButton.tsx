import { HeaderIconButton as SharedHeaderIconButton } from '@portfolio/mobile-ui';

// Thin adapter over the shared header action, which moved into
// `@portfolio/mobile-ui` when expo-ui-starter needed the same button. The import
// path stays so this app's screens do not churn; the measured reason it states
// its 48dp box (a `matchContents` host clips the ripple out of existence) lives
// on the shared component.
export const HeaderIconButton = SharedHeaderIconButton;
