import { type ViewProps } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';
import { Screen as BaseScreen } from '@/ui';

export const Screen = ({ children, ...rest }: ViewProps) => {
  const { colors } = useAppTheme();
  return (
    <BaseScreen
      backgroundColor={colors.background}
      // Top comes from the navigation header; left/right guard the display
      // cutout in landscape. Bottom is owned by each screen's inner content.
      edges={['left', 'right']}
      {...rest}
    >
      {children}
    </BaseScreen>
  );
};
