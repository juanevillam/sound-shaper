import { Host, type HostProps } from '@expo/ui/jetpack-compose';

import { useAppTheme } from '@/hooks/useAppTheme';

// Every Compose embed point goes through here so the whole native side follows
// the app's resolved light/dark scheme. There is NO brand seed: all portfolio
// apps ride the platform-default palette (wallpaper-derived Material You on
// Android).
export function ThemedHost(props: HostProps) {
  const { scheme } = useAppTheme();
  return <Host colorScheme={scheme} {...props} />;
}
