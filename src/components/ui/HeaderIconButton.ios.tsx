import { IconButton } from '@/components/ui/IconButton';

// iOS counterpart of `HeaderIconButton`. Nothing mounts it today — iOS draws
// its own header rather than using the navigator's bar — but the twin has to
// exist, because the Android file imports `@expo/ui/jetpack-compose` and a
// shared import path must resolve on both platforms.
//
// If a screen ever does put an action in a native iOS bar, note that it should
// be a bare SwiftUI `Image` in `headerRight` instead: UIKit gives a real bar
// button item its Liquid Glass automatically on iOS 26, and wrapping it in
// anything of our own is what loses that.

type HeaderIconButtonProps = {
  name: React.ComponentProps<typeof IconButton>['name'];
  onPress: () => void;
  accessibilityLabel: string;
};

export function HeaderIconButton({
  name,
  onPress,
  accessibilityLabel,
}: HeaderIconButtonProps) {
  return (
    <IconButton
      name={name}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
