import {
  Icon,
  NavigationBar,
  NavigationBarItem,
  type NavigationBarItemColors,
  Text,
} from '@expo/ui/jetpack-compose';
import { iconSource } from '@portfolio/mobile-ui';
import { type BottomTabBarProps } from 'expo-router/js-tabs';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { type TranslationKey, useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';

const ICON_SIZE = 24;

// Outlined glyph when idle, filled (or recolored) when selected — the standard
// M3 idiom. `search` has no filled variant, so Explore reuses the same glyph and
// only its tint flips on selection.
const META: Record<
  string,
  {
    icon: ReturnType<typeof iconSource>;
    selectedIcon: ReturnType<typeof iconSource>;
    labelKey: TranslationKey;
  }
> = {
  home: {
    icon: iconSource('home'),
    selectedIcon: iconSource('home-filled'),
    labelKey: 'tabs.home',
  },
  explore: {
    icon: iconSource('search'),
    selectedIcon: iconSource('search'),
    labelKey: 'tabs.explore',
  },
  profile: {
    icon: iconSource('person'),
    selectedIcon: iconSource('person-filled'),
    labelKey: 'tabs.profile',
  },
};

// Sound Shaper's bottom navigation: an @expo/ui Material 3 NavigationBar driven
// by expo-router's tab state — the same bar as Topper's, so the two apps read
// as siblings. Detail screens (playlist-detail, settings) push OVER the bar
// from the parent stack.
export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useAppTheme();
  const { t } = useI18n();

  // Only the selected-state indicator pill needs theming here; icon tints and
  // the label color are set per slot below (an explicit Icon `tint` wins over
  // itemColors, and bare Icons render black without one).
  const itemColors: NavigationBarItemColors = {
    selectedIndicatorColor: colors.secondaryContainer,
  };

  return (
    <ThemedHost matchContents={{ vertical: true }}>
      <NavigationBar containerColor={colors.surfaceContainer}>
        {state.routes.map((route, index) => {
          const meta = META[route.name];
          if (!meta) return null;

          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              haptics.selection();
              navigation.navigate(route.name);
            }
          };

          return (
            <NavigationBarItem
              key={route.key}
              selected={focused}
              colors={itemColors}
              onClick={onPress}
            >
              {/* @expo/ui 57 never renders the SelectedIcon slot (Android only
                  reads the "icon" slot), so the Icon slot swaps the glyph
                  itself — keeps the pill's native morph animation. */}
              <NavigationBarItem.Icon>
                <Icon
                  source={focused ? meta.selectedIcon : meta.icon}
                  size={ICON_SIZE}
                  tint={
                    focused
                      ? colors.onSecondaryContainer
                      : colors.onSurfaceMuted
                  }
                />
              </NavigationBarItem.Icon>
              <NavigationBarItem.Label>
                <Text
                  color={focused ? colors.onSurface : colors.onSurfaceMuted}
                >
                  {t(meta.labelKey)}
                </Text>
              </NavigationBarItem.Label>
            </NavigationBarItem>
          );
        })}
      </NavigationBar>
    </ThemedHost>
  );
}
