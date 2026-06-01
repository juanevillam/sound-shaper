import React from 'react';

import { Icon } from '@expo/ui/jetpack-compose';

import { type IconName, iconSource } from './icons';

export type AppIconProps = Omit<React.ComponentProps<typeof Icon>, 'source'> & {
  name: IconName;
};

/**
 * Android (Jetpack Compose) icon rendered from the shared icon set. Pass a
 * typed `name` instead of a `require()`d source; every other `@expo/ui` `Icon`
 * prop (size, tint, contentDescription, modifiers) passes straight through.
 */
export const AppIcon = ({ name, ...rest }: AppIconProps) => (
  <Icon source={iconSource(name)} {...rest} />
);
