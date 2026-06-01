import { type ImageSourcePropType } from 'react-native';

/**
 * Single source of truth mapping icon names → bundled Android vector
 * drawables. Add an icon by dropping its `.xml` in `assets/icons/` and
 * adding one line here; the `IconName` union updates automatically.
 */
const icons = {
  add: require('./assets/icons/add.xml'),
  chevron: require('./assets/icons/chevron.xml'),
  close: require('./assets/icons/close.xml'),
  edit: require('./assets/icons/edit.xml'),
  favorite: require('./assets/icons/favorite.xml'),
  flight: require('./assets/icons/flight.xml'),
  home: require('./assets/icons/home.xml'),
  info: require('./assets/icons/info.xml'),
  notifications: require('./assets/icons/notifications.xml'),
  send: require('./assets/icons/send.xml'),
  settings: require('./assets/icons/settings.xml'),
  share: require('./assets/icons/share.xml'),
  star: require('./assets/icons/star.xml'),
} satisfies Record<string, ImageSourcePropType>;

export type IconName = keyof typeof icons;

/** Resolve a typed icon name to a source usable by `@expo/ui` `Icon`. */
export const iconSource = (name: IconName): ImageSourcePropType => icons[name];
