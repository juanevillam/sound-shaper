import { type ReactNode } from 'react';

import {
  Button,
  CircularWavyProgressIndicator,
  FilledTonalIconButton,
  Row,
  Text,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, size } from '@expo/ui/jetpack-compose/modifiers';

import { useAppTheme, withAlpha } from '@/core';

import { AppIcon } from './AppIcon';
import { type IconName } from './icons';
import { COMPOSE_SHEET_HEADER_HEIGHT } from './sheetMetrics';

/** The gap between two bar actions, and between the last one and the pill. */
const ACTION_GAP = 8;
const ACTION_ICON = 24;
/**
 * A TONAL CONTAINER, NOT THE ACCENT ONE. M3's `FilledTonalIconButton` fills
 * itself with `secondaryContainer` — the framework tinting a control by
 * default, which is the first thing the monochrome rule takes. A flat wash of
 * the sheet's own ink contains the glyph without saying anything with colour,
 * and steps the same amount in both appearances (a token would not: One UI's
 * container ladder is not monotonic).
 */
const ACTION_CONTAINER_ALPHA = 0.08;

type SheetBarProps = {
  title: string;
  /**
   * Glyph actions, leading the commit pill — `SheetBarAction` elements.
   *
   * THEY ARE CONTAINED, and that is the whole reason they go through this bar
   * rather than being dropped in by each sheet. The clips sheet and the clip
   * editor hand-rolled their own `Row` of bare `IconButton`s, which on a sheet
   * read as glyphs floating on the page — iOS gets away with the same
   * arrangement because its bar items are Liquid Glass capsules, i.e. already
   * contained (Juan, 2026-09-10).
   */
  actions?: ReactNode;
  /** The commit pill. Omit all three for a TITLE-ONLY header (a list sheet). */
  saveLabel?: string;
  saving?: boolean;
  saveEnabled?: boolean;
  onSave?: () => void;
};

/**
 * ONE BAR ACTION — the contained icon button a sheet bar carries.
 *
 * The commit stays a LABELLED PILL beside these (`saveLabel`), which is the
 * Android half of a deliberate split: iOS commits with a ✓ glyph in a glass
 * capsule, Material commits with a filled button carrying the word and, while
 * it works, a spinner in the word's place. Same job, each platform's own
 * grammar — the portfolio's rule, not an oversight.
 */
export function SheetBarAction({
  icon,
  label,
  onPress,
  enabled = true,
}: {
  icon: IconName;
  /** Already-translated screen-reader label — a glyph has no text of its own. */
  label: string;
  onPress: () => void;
  enabled?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <FilledTonalIconButton
      onClick={onPress}
      enabled={enabled}
      colors={{
        containerColor: withAlpha(colors.onSurface, ACTION_CONTAINER_ALPHA),
        contentColor: colors.onSurface,
      }}
    >
      <AppIcon
        name={icon}
        size={ACTION_ICON}
        tint={colors.onSurface}
        contentDescription={label}
      />
    </FilledTonalIconButton>
  );
}

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
  actions,
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
      {/* The leading group — the title alone. A back action once led it, for
          a sheet that swapped its content in place; the clip editor stacks as
          its own sheet now, so BACK dismisses just that sheet. */}
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: ACTION_GAP }}
      >
        <Text style={{ typography: 'titleLarge' }} maxLines={1}>
          {title}
        </Text>
      </Row>
      {/* ONE TRAILING GROUP — glyph actions, then the commit — so the bar has
          a single trailing edge whether it carries none, one or both. Stated
          as its own Row rather than as siblings of the title, which
          `spaceBetween` would spread across the bar. */}
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: ACTION_GAP }}
      >
        {actions}
        {/* MONOCHROME, the welcome-CTA mapping: a filled button's colour is
            inherited (Material fills with the accent by default), so the
            commit pill takes the ink — `onSurface` fill, `background` label —
            exactly as EmptyState's action and the Follow CTA do. The disabled
            state is Material's own (the pill dims itself), and the spinner
            takes the label's ink so it reads as the label it replaces. */}
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
    </Row>
  );
}
