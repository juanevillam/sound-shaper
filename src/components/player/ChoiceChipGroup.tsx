import { Column, FilterChip, Row, Text } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  horizontalScroll,
  offset,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';

import { useAppTheme } from '@/core';
import { COMPOSE_SHEET_GUTTER } from '@/ui';

/** The gap above the label when the group follows another control. */
const GROUP_TOP = 14;

export type ChoiceChipGroupProps<T extends string> = {
  label: string;
  /** The supporting line under the label, when the choice needs one. */
  description?: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /**
   * Leading the sheet's content, the sheet's own header→content gap is the
   * space above, so the group adds none of its own.
   */
  first?: boolean;
};

/**
 * ONE CHOICE OUT OF A FEW, IN MATERIAL — the Android twin of the menu `Picker`
 * row iOS uses for the same choices: a label (and an optional supporting line)
 * over a `FilterChip` row. A selected chip is a SELECTION, which is what keeps
 * its accent on a monochrome sheet. It was the Shape sheet's `LevelChipGroup`
 * (Echo, Next Room) and moved here the day the Clips sheet's Repeat needed the
 * same anatomy, so the two sheets cannot drift into two designs for one idea.
 *
 * Compose-only: it renders inside a `ModalBottomSheet`'s Host.
 */
export function ChoiceChipGroup<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
  first = false,
}: ChoiceChipGroupProps<T>) {
  const { colors } = useAppTheme();

  return (
    <>
      <Column
        verticalArrangement={{ spacedBy: 2 }}
        modifiers={[
          fillMaxWidth(),
          padding(
            COMPOSE_SHEET_GUTTER,
            first ? 0 : GROUP_TOP,
            COMPOSE_SHEET_GUTTER,
            0,
          ),
        ]}
      >
        <Text color={colors.onSurface} style={{ typography: 'bodyLarge' }}>
          {label}
        </Text>
        {description ? (
          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'bodySmall' }}
          >
            {description}
          </Text>
        ) : null}
      </Column>
      {/* Edge-to-edge scroll with content padding, exactly the Presets row's
          arrangement — and the same drawn-box `offset` correction, so the
          label→chips gap reads as the sheet's rhythm rather than the 48dp
          touch box's slack. */}
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 8 }}
        modifiers={[
          fillMaxWidth(),
          offset(0, -7),
          horizontalScroll(),
          padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
        ]}
      >
        {options.map(option => (
          <FilterChip
            key={option.value}
            selected={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <FilterChip.Label>
              <Text maxLines={1}>{option.label}</Text>
            </FilterChip.Label>
          </FilterChip>
        ))}
      </Row>
    </>
  );
}
