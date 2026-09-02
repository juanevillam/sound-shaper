import {
  Button,
  CircularWavyProgressIndicator,
  Row,
  Text,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, size } from '@expo/ui/jetpack-compose/modifiers';

import { useAppTheme } from '@portfolio/core';

type SheetBarProps = {
  title: string;
  saveLabel: string;
  saving: boolean;
  saveEnabled?: boolean;
  onSave: () => void;
};

// Top action row INSIDE a Compose ModalBottomSheet editor: title on the left, a
// filled Save pill on the right. Pure Compose — renders inside the sheet's Host,
// so it has no Host of its own.
// The sheet stands `SheetDragHandle` above this, not the native handle — see
// that component for why. Destructive delete lives at the BOTTOM, not here.
export function SheetBar({
  title,
  saveLabel,
  saving,
  saveEnabled = true,
  onSave,
}: SheetBarProps) {
  const { colors } = useAppTheme();

  return (
    <Row
      verticalAlignment="center"
      horizontalArrangement="spaceBetween"
      modifiers={[fillMaxWidth()]}
    >
      <Text style={{ typography: 'titleLarge' }} maxLines={1}>
        {title}
      </Text>
      <Button onClick={onSave} enabled={saveEnabled && !saving}>
        {saving ? (
          <CircularWavyProgressIndicator
            color={colors.onSurfaceMuted}
            modifiers={[size(20, 20)]}
          />
        ) : (
          <Text>{saveLabel}</Text>
        )}
      </Button>
    </Row>
  );
}
