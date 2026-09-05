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
      {/* MONOCHROME, the welcome-CTA mapping: a filled button's colour is
          inherited (Material fills with the accent by default), so the commit
          pill takes the ink — `onSurface` fill, `background` label — exactly
          as EmptyState's action and the Follow CTA do. The disabled state is
          Material's own (the pill dims itself), and the spinner takes the
          label's ink so it reads as the label it replaces. */}
      <Button
        onClick={onSave}
        enabled={saveEnabled && !saving}
        colors={{
          containerColor: colors.onSurface,
          contentColor: colors.background,
        }}
      >
        {saving ? (
          <CircularWavyProgressIndicator
            color={colors.background}
            modifiers={[size(20, 20)]}
          />
        ) : (
          <Text color={colors.background}>{saveLabel}</Text>
        )}
      </Button>
    </Row>
  );
}
