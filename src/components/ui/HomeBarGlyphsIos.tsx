import { HeaderGlyphGroupIos } from '@portfolio/mobile-ui';
import { router } from 'expo-router';

import { useI18n } from '@/i18n';

/**
 * Home's trailing bar items: Account, then Settings.
 *
 * ACCOUNT LIVES ON THE HOME BAR in this app because the portfolio's rule is
 * that its entry sits where the person's identity already does — the Profile
 * tab in Topper, and here, with no profile tab, the home bar. Settings is app
 * CONFIGURATION only and is identical in every app.
 *
 * ONE MERGED PILL, not two capsules, and that is UIKit's doing rather than a
 * choice: `headerRight` is a single custom-view bar item, so iOS draws exactly
 * one glass capsule around whatever it holds. `HeaderGlyphGroupIos` is what
 * gives each glyph its own 43pt target inside that pill — the measurements, and
 * the reason a lone glyph must NOT take the same box, live in that file.
 *
 * This replaced two hand-built `BarIconButton`s that asked SwiftUI for
 * `.glassEffect` explicitly, because home drew its own header and had no real
 * navigation bar to get the material from. It has one now, so the glass, the
 * press response and the scroll-edge behaviour are all UIKit's again.
 */
export function HomeBarGlyphsIos() {
  const { t } = useI18n();

  return (
    <HeaderGlyphGroupIos
      glyphs={[
        {
          systemName: 'person.crop.circle',
          label: t('settings.account.title'),
          onPress: () => router.push('/manage-account'),
        },
        {
          systemName: 'gearshape',
          label: t('app.settings'),
          onPress: () => router.push('/settings'),
        },
      ]}
    />
  );
}
