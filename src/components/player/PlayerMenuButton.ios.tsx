import { StyleSheet, View } from 'react-native';

import { Button, Image, Menu } from '@expo/ui/swift-ui';
import { SwiftUIHost } from '@portfolio/mobile-ui';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';

import { type PlayerMenuButtonProps } from './chrome';

/**
 * iOS counterpart of `PlayerMenuButton` — a REAL SwiftUI `Menu`.
 *
 * It opened `ActionSheetIOS` before, which is the wrong control for a "…". An
 * action sheet is a MODAL that slides up from the bottom edge and takes the
 * whole screen's attention; a bar overflow is a MENU that unfurls from the
 * glyph you touched, keeps its context, and is what every "…" in iOS has been
 * since 14. Apple reserves the action sheet for a decision — usually
 * destructive — that deserves to interrupt. Two harmless navigations do not.
 *
 * It also cost a Cancel row, which a menu does not need: tapping outside
 * dismisses it, so HIG's "always last" cancel rule simply does not apply.
 *
 * THE HOST STATES ITS BOX, never `matchContents` — this sits in a row whose
 * other glyph is laid out beside it, and a host that measures its child answers
 * on the layout path. Same rule `TransportGlyphs.ios` records.
 */
const GLYPH_SIZE = 20;
/** The bar-glyph tap target the portfolio uses — `HeaderGlyphButton.ios`'s. */
const TAP_TARGET = 43;

export function PlayerMenuButton({ onInfo, onEdit }: PlayerMenuButtonProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  return (
    <View style={styles.box}>
      <SwiftUIHost style={styles.host} ignoreSafeArea="all">
        {/* THE LABEL STATES ITS COLOUR. A `Menu`'s label inherits the tint,
            and the tint is the system accent — so left alone this renders a
            blue "…" on a console whose whole point is that nothing on it is
            accented. It is the same class of miss as the `Slider`'s fill. */}
        <Menu
          label={
            <Image
              systemName="ellipsis"
              size={GLYPH_SIZE}
              color={colors.onSurface}
            />
          }
        >
          <Button
            label={t('player.menu.info')}
            systemImage="info.circle"
            onPress={onInfo}
          />
          <Button
            label={t('player.menu.edit')}
            systemImage="pencil"
            onPress={onEdit}
          />
        </Menu>
      </SwiftUIHost>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    height: TAP_TARGET,
    justifyContent: 'center',
    width: TAP_TARGET,
  },
  host: { height: TAP_TARGET, width: TAP_TARGET },
});
