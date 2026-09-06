import {
  Button,
  CircularWavyProgressIndicator,
  Row,
  Text,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, size } from '@expo/ui/jetpack-compose/modifiers';

import { useAppTheme } from '@portfolio/core';

import { COMPOSE_SHEET_HEADER_HEIGHT } from './sheetMetrics';

type SheetBarProps = {
  title: string;
  /** The commit pill. Omit all three for a TITLE-ONLY header (a list sheet). */
  saveLabel?: string;
  saving?: boolean;
  saveEnabled?: boolean;
  onSave?: () => void;
};

// THE header row of every Compose ModalBottomSheet: title on the left and, on
// an editor, a filled Save pill on the right. Pure Compose — renders inside the
// sheet's Host, so it has no Host of its own.
// The row is `COMPOSE_SHEET_HEADER_HEIGHT` tall with or without the pill (the
// pill is a 40dp Material Button, the height is stated so a title-only header
// stands the same row), which is what puts every sheet's title ink on one line
// and every sheet's first content at one distance — see `sheetMetrics`.
// The sheet stands `SheetDragHandle` above this, not the native handle — see
// that component for why. Destructive delete lives at the BOTTOM, not here.
export function SheetBar({
  title,
  saveLabel,
  saving = false,
  saveEnabled = true,
  onSave,
}: SheetBarProps) {
  const { colors } = useAppTheme();

  return (
    <Row
      verticalAlignment="center"
      horizontalArrangement="spaceBetween"
      modifiers={[fillMaxWidth(), height(COMPOSE_SHEET_HEADER_HEIGHT)]}
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
      {saveLabel === undefined || onSave === undefined ? null : (
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
      )}
    </Row>
  );
}
