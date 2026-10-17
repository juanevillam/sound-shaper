import { router } from 'expo-router';

import { useI18n } from '@/i18n';
import { HEADER_CLOSE_GLYPH_SIZE, HeaderGlyphButtonIos } from '@/ui';

// A sheet's dismiss action. `xmark`, not "Done": nothing is being committed —
// Settings and the account screen apply as you go, so there is no edit to
// finish, only a panel to leave. Apple splits the two the same way: Done for
// commit-style modals (New Event, Compose), a close glyph for panels that apply
// as you go. This app's EDITOR sheets are the commit kind and take Cancel/Save
// instead — see `SheetFormIos`.
//
// The grabber alone was the only way out of these sheets before, which reads as
// "no way out" to anyone who doesn't already know the gesture.
//
// Size and colour come from the shared `HeaderGlyphButtonIos`; the dismiss
// glyph is the one bar item NOT sized against the title beside it, which is
// what `HEADER_CLOSE_GLYPH_SIZE` encodes.
export function HeaderCloseButtonIos() {
  const { t } = useI18n();

  return (
    <HeaderGlyphButtonIos
      systemName="xmark"
      size={HEADER_CLOSE_GLYPH_SIZE}
      label={t('common.close')}
      onPress={() => router.back()}
    />
  );
}
