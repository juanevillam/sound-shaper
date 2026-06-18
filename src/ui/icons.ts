import { type ImageSourcePropType } from 'react-native';

import Add from '@expo/material-symbols/add.xml';
import ArrowDownward from '@expo/material-symbols/arrow_downward.xml';
import ArrowUpward from '@expo/material-symbols/arrow_upward.xml';
import Check from '@expo/material-symbols/check.xml';
import ChevronRight from '@expo/material-symbols/chevron_right.xml';
import Close from '@expo/material-symbols/close.xml';
import DarkMode from '@expo/material-symbols/dark_mode.xml';
import Delete from '@expo/material-symbols/delete.xml';
import DragIndicator from '@expo/material-symbols/drag_indicator.xml';
import Edit from '@expo/material-symbols/edit.xml';
import Favorite from '@expo/material-symbols/favorite.xml';
import Flight from '@expo/material-symbols/flight.xml';
import Groups from '@expo/material-symbols/groups.xml';
import Home from '@expo/material-symbols/home.xml';
import Info from '@expo/material-symbols/info.xml';
import Language from '@expo/material-symbols/language.xml';
import Lock from '@expo/material-symbols/lock.xml';
import Logout from '@expo/material-symbols/logout.xml';
import MoreVert from '@expo/material-symbols/more_vert.xml';
import Notifications from '@expo/material-symbols/notifications.xml';
import Palette from '@expo/material-symbols/palette.xml';
import Person from '@expo/material-symbols/person.xml';
import PersonAdd from '@expo/material-symbols/person_add.xml';
import Public from '@expo/material-symbols/public.xml';
import RocketLaunch from '@expo/material-symbols/rocket_launch.xml';
import Search from '@expo/material-symbols/search.xml';
import Send from '@expo/material-symbols/send.xml';
import Settings from '@expo/material-symbols/settings.xml';
import Share from '@expo/material-symbols/share.xml';
import Star from '@expo/material-symbols/star.xml';
import Trophy from '@expo/material-symbols/trophy.xml';
import Widgets from '@expo/material-symbols/widgets.xml';
import { Asset } from 'expo-asset';

/**
 * Single source of truth mapping icon names → Material Symbols vector drawables.
 *
 * Outlined icons are imported per-name from `@expo/material-symbols` (Google's
 * official set; Metro only bundles the ones imported here). Filled variants are
 * not shipped by the package, so they live as local drawables generated with
 * its CLI (`npx @expo/material-symbols --fill <name>`). Add an icon by importing
 * it (or dropping a generated `.xml` in `assets/icons/`) and adding one line
 * below; the `IconName` union updates automatically.
 */
const icons = {
  add: Add,
  'arrow-downward': ArrowDownward,
  'arrow-upward': ArrowUpward,
  check: Check,
  chevron: ChevronRight,
  close: Close,
  'dark-mode': DarkMode,
  delete: Delete,
  'drag-indicator': DragIndicator,
  edit: Edit,
  favorite: Favorite,
  'favorite-filled': require('./assets/icons/favorite-filled.xml'),
  flight: Flight,
  groups: Groups,
  home: Home,
  'home-filled': require('./assets/icons/home-filled.xml'),
  info: Info,
  language: Language,
  lock: Lock,
  logout: Logout,
  'more-vert': MoreVert,
  notifications: Notifications,
  'notifications-filled': require('./assets/icons/notifications-filled.xml'),
  palette: Palette,
  person: Person,
  'person-add': PersonAdd,
  'person-filled': require('./assets/icons/person-filled.xml'),
  public: Public,
  'rocket-launch': RocketLaunch,
  search: Search,
  send: Send,
  settings: Settings,
  'settings-filled': require('./assets/icons/settings-filled.xml'),
  share: Share,
  star: Star,
  'star-filled': require('./assets/icons/star-filled.xml'),
  trophy: Trophy,
  widgets: Widgets,
} satisfies Record<string, ImageSourcePropType>;

export type IconName = keyof typeof icons;

/** Resolve a typed icon name to a source usable by `@expo/ui` `Icon`. */
export const iconSource = (name: IconName): ImageSourcePropType => icons[name];

/**
 * Warm the drawable cache for every icon so the first render of each one does
 * not pay a Metro fetch/decode cost. Call once at app startup; fire-and-forget.
 */
export const preloadIcons = (): Promise<Asset[]> =>
  Asset.loadAsync(Object.values(icons) as number[]);
