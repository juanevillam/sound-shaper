import { IconButton } from '@/components/ui/IconButton';

// iOS counterpart of `HeaderIconButton`. Nothing mounts it today — iOS draws
// its own header rather than using the navigator's bar — but the twin has to
// exist, because the Android file imports `@expo/ui/jetpack-compose` and a
// shared import path must resolve on both platforms.
//
// If a screen ever does put an action in a native iOS bar, use
// `HeaderGlyphButtonIos` / `HeaderGlyphGroupIos` from `@portfolio/mobile-ui` —
// the shared bar glyph every portfolio app's iOS bars use (label colour, 24pt
// glyph, and the group's 43pt tap targets). Don't hand-roll a SwiftUI `Image`:
// that path drifted twice in Topper (an accent-tinted glyph, and ink-sized tap
// targets).

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
