import { router } from 'expo-router';

import { useI18n } from '@/i18n';
import { HeaderGlyphButtonIos } from '@/ui';

// iOS header action that opens Settings. Thin adapter over the shared
// `HeaderGlyphButtonIos` — the glyph's size and its label colouring belong to
// the package so every app's bar stays identical; only the
// route and the translation are this app's.
//
// ONE GLYPH, which is the portfolio's rule rather than this screen's choice:
// every app's home bar carries the gear and nothing else. This bar used to
// carry an Account glyph beside it (`HomeBarGlyphsIos`, deleted with this) —
// the account entry now leads the Settings sheet as its identity banner, which
// is Apple's own placement. See `SettingsAccountLink`.
//
// A lone glyph deliberately does NOT take the group's enlarged tap box: it
// already sits centred in UIKit's 44pt minimum capsule, and forcing the box
// there only stretches the capsule. The measurements are in
// `HeaderGlyphButton.ios.tsx`.
export function HeaderSettingsButton() {
  const { t } = useI18n();

  return (
    <HeaderGlyphButtonIos
      systemName="gearshape"
      label={t('app.settings')}
      onPress={() => router.push('/settings')}
    />
  );
}
