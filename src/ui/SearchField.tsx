import {
  Host,
  Icon,
  IconButton,
  Shape,
  TextField,
  Text as ComposeText,
  type ObservableState,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

import { useAppTheme } from '@portfolio/core';

import { iconSource } from './icons';

type SearchFieldProps = {
  /** Native observable holding the field text. Create with `useNativeState('')`
   *  in the parent so it can clear/refill the field (X, recent tap). */
  value: ObservableState<string>;
  placeholder: string;
  /** Accessibility label for the trailing clear button, already translated. */
  clearLabel: string;
  /** Show the trailing clear (✕) — only when there's text to clear. */
  showClear: boolean;
  onValueChange: (query: string) => void;
  onClear: () => void;
  onFocusChange?: (focused: boolean) => void;
  onSubmit?: (query: string) => void;
  /**
   * Take focus and raise the keyboard on mount. For a field that APPEARS on
   * demand — a search mode the bar just opened — where making someone tap a
   * field they only just summoned is a wasted step. A field that is simply
   * present on the screen leaves this off.
   */
  autoFocus?: boolean;
};

/**
 * THE ANDROID SEARCH FIELD — one component for every app that searches.
 *
 * Material 3 search field: a filled `TextField` shaped into a pill with its
 * indicator line hidden, so it reads as a search bar.
 *
 * IT IS NOT A `SearchBar`, AND THAT IS A MEASURED DECISION, NOT A PREFERENCE.
 * @expo/ui 57 ships both `SearchBar` and `DockedSearchBar` and the soft
 * keyboard never opens on focus in either — the starter's own showcases for
 * both carry the note. A pill `TextField` is the native Material control that
 * does work, and it additionally exposes the two things the search bars do not:
 * a CONTROLLED value (so the screen can clear or refill the field) and a
 * trailing icon slot (the ✕). Re-check both on every `@expo/ui` bump; if the
 * IME is fixed, `SearchBar` is the component this should become.
 *
 * It lived in Topper, alone, and moved here the day the starter needed the same
 * pill — which is the "a surface solved in one app must be THE SAME COMPONENT
 * in the others" rule catching a duplicate before it was written rather than
 * months after. It reads the palette straight from `@portfolio/core`, the same
 * way `EmptyState` does, and takes its one string as a prop because a package
 * has no app translator.
 */
export function SearchField({
  value,
  placeholder,
  clearLabel,
  showClear,
  onValueChange,
  onClear,
  onFocusChange,
  onSubmit,
  autoFocus = false,
}: SearchFieldProps) {
  const { colors, scheme, seedColor } = useAppTheme();

  return (
    /* The app-side `ThemedHost` this used to take is a `Host` with the resolved
       scheme forwarded; a package component asks for the scheme itself, the
       same way `EmptyState` does. */
    <Host
      colorScheme={scheme}
      seedColor={seedColor}
      matchContents={{ vertical: true }}
      style={styles.host}
    >
      <TextField
        value={value}
        autoFocus={autoFocus}
        singleLine
        shape={Shape.Pill({})}
        colors={{
          focusedContainerColor: colors.surfaceContainer,
          unfocusedContainerColor: colors.surfaceContainer,
          // Hide the filled field's bottom indicator so it reads as a pill.
          focusedIndicatorColor: 'transparent',
          unfocusedIndicatorColor: 'transparent',
          cursorColor: colors.primary,
          focusedTextColor: colors.onSurface,
          unfocusedTextColor: colors.onSurface,
          focusedPlaceholderColor: colors.onSurfaceMuted,
          unfocusedPlaceholderColor: colors.onSurfaceMuted,
        }}
        keyboardOptions={{
          imeAction: 'search',
          autoCorrectEnabled: false,
          capitalization: 'none',
        }}
        keyboardActions={onSubmit ? { onSearch: onSubmit } : undefined}
        onValueChange={onValueChange}
        onFocusChanged={onFocusChange}
        modifiers={[fillMaxWidth()]}
      >
        <TextField.LeadingIcon>
          <Icon source={iconSource('search')} tint={colors.onSurfaceMuted} />
        </TextField.LeadingIcon>
        <TextField.Placeholder>
          <ComposeText color={colors.onSurfaceMuted}>{placeholder}</ComposeText>
        </TextField.Placeholder>
        {/* Keep the slot mounted and toggle its content: adding/removing the
            whole TrailingIcon slot doesn't reliably reconcile when the value is
            set programmatically (e.g. tapping a recent), leaving a stale state. */}
        <TextField.TrailingIcon>
          {showClear ? (
            <IconButton onClick={onClear}>
              <Icon
                source={iconSource('close')}
                tint={colors.onSurfaceMuted}
                contentDescription={clearLabel}
              />
            </IconButton>
          ) : null}
        </TextField.TrailingIcon>
      </TextField>
    </Host>
  );
}

const styles = { host: { width: '100%' as const } };
