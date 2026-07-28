import { IconButton } from '@expo/ui/jetpack-compose';
import { AppIcon, type IconName } from '@portfolio/mobile-ui';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';

// An action in the NAVIGATOR'S OWN app bar, as opposed to `IconButton`, which
// is for icons the app draws itself.
//
// Android: a real Compose `IconButton`, so the glyph, the touch target and the
// ripple are the platform's rather than ours — the same thing Topper's profile
// header does. This is also why the file is Android-only: importing
// `@expo/ui/jetpack-compose` from a shared module breaks the iOS bundle.

type HeaderIconButtonProps = {
  name: IconName;
  onPress: () => void;
  accessibilityLabel: string;
};

export function HeaderIconButton({
  name,
  onPress,
  accessibilityLabel,
}: HeaderIconButtonProps) {
  const { colors } = useAppTheme();

  return (
    <ThemedHost matchContents>
      <IconButton onClick={onPress}>
        <AppIcon
          name={name}
          tint={colors.onSurface}
          contentDescription={accessibilityLabel}
        />
      </IconButton>
    </ThemedHost>
  );
}
