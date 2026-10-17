import { Platform, type ImageSourcePropType } from 'react-native';

import Add from '@expo/material-symbols/add.xml';
import ChevronRight from '@expo/material-symbols/chevron_right.xml';
import ContentCut from '@expo/material-symbols/content_cut.xml';
import Delete from '@expo/material-symbols/delete.xml';
import Edit from '@expo/material-symbols/edit.xml';
import GraphicEq from '@expo/material-symbols/graphic_eq.xml';
import Image from '@expo/material-symbols/image.xml';
import Logout from '@expo/material-symbols/logout.xml';
import MoreVert from '@expo/material-symbols/more_vert.xml';
import MusicNote from '@expo/material-symbols/music_note.xml';
import Person from '@expo/material-symbols/person.xml';
import Settings from '@expo/material-symbols/settings.xml';
import Tune from '@expo/material-symbols/tune.xml';
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
  'content-cut': ContentCut,
  chevron: ChevronRight,
  delete: Delete,
  edit: Edit,
  // The sounding-row marker — Material's equalizer bars, which is also this
  // app's own now-playing emblem over a grid tile. Pairs with the accent so
  // colour is not the only indicator.
  'graphic-eq': GraphicEq,
  image: Image,
  logout: Logout,
  'more-vert': MoreVert,
  'music-note': MusicNote,
  person: Person,
  settings: Settings,
  tune: Tune,
} satisfies Record<string, ImageSourcePropType>;

export type IconName = keyof typeof icons;

/** Resolve a typed icon name to a source usable by `@expo/ui` `Icon`. */
export const iconSource = (name: IconName): ImageSourcePropType => icons[name];

/**
 * Warm the drawable cache for every icon so the first render of each one does
 * not pay a Metro fetch/decode cost. Call once at app startup; fire-and-forget.
 *
 * ANDROID ONLY, and the set is why: these are Android VECTOR DRAWABLE XML,
 * which iOS cannot render at all. Nothing on iOS ever asks
 * for one, because every surface that calls `iconSource` (`SettingsScreen`,
 * `SettingsAccountSection`, `ManageAccountScreen`, `WelcomeScreen`) is an
 * Android base with an `.ios.tsx` twin beside it, and `AppIcon.ios` draws SF
 * Symbols instead. Unguarded, every iOS cold start resolved the whole set
 * (60 assets at the time) to warm a cache with no readers.
 *
 * Resolves to an empty array off Android so callers keep their
 * fire-and-forget shape.
 */
export const preloadIcons = (): Promise<Asset[]> =>
  Platform.OS === 'android'
    ? Asset.loadAsync(Object.values(icons) as number[])
    : Promise.resolve([]);
