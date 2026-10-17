import { router } from 'expo-router';

import { useI18n } from '@/i18n';
import { HeaderGlyphButtonIos } from '@/ui';

// iOS header action that opens Settings. Thin adapter over
// `HeaderGlyphButtonIos` — the glyph's size and its label colouring belong to
// `src/ui`; only the route and the translation are here.
//
// ONE GLYPH, which is a standing rule rather than this screen's choice
// (`docs/standards.md` → "Every home bar carries one glyph"). This bar used to
// carry an Account glyph beside it (`HomeBarGlyphsIos`, deleted with this) —
// the account entry now leads the Settings sheet as its identity banner, which
// is Apple's own placement. See `SettingsAccountLink`.
//
// A lone glyph deliberately does NOT take the group's enlarged tap box: it
// already sits centred in UIKit's 44pt minimum capsule, and forcing the box
// there only stretches the capsule. The measurements are in
// `HeaderGlyphButtonIos.tsx`.
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
