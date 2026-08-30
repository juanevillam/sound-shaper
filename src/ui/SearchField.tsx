import {
  Host,
  Icon,
  IconButton,
  Shape,
  TextField,
  Text as ComposeText,
  type ObservableState,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

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
  /**
   * `pill` (default) is the docked Material search field — a filled container
   * shaped into a pill, for a field that sits in a screen's content.
   *
   * `bare` is the field INSIDE an expanded app bar: no container, no leading
   * magnifier, no shape. Material's search view replaces the whole bar, so the
   * back arrow is already the leading affordance and a second magnifier beside
   * it is a duplicate; without a container the field reads as the bar's own
   * title slot having become an input, which is exactly what it is.
   */
  variant?: 'pill' | 'bare';
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
  variant = 'pill',
}: SearchFieldProps) {
  const { colors, scheme, seedColor } = useAppTheme();
  const bare = variant === 'bare';

  return (
    /* The app-side `ThemedHost` this used to take is a `Host` with the resolved
       scheme forwarded; a package component asks for the scheme itself, the
       same way `EmptyState` does. */
    /* A BARE FIELD STATES ITS BOX INSTEAD OF MATCHING ITS CONTENTS, because
       that is the only way it can live in a native header: `matchContents`
       reports its size after the fact, and inside a header title slot the
       answer never arrives — the screen renders blank. Same rule as every other
       host in a native row or sheet. */
    <Host
      colorScheme={scheme}
      seedColor={seedColor}
      {...(bare ? {} : { matchContents: { vertical: true } as const })}
      style={bare ? styles.hostBare : styles.host}
    >
      <TextField
        value={value}
        autoFocus={autoFocus}
        singleLine
        {...(bare ? {} : { shape: Shape.Pill({}) })}
        colors={{
          // Bare: the bar's own ground shows through, so the field melts into
          // the header rather than sitting on it as a second surface.
          focusedContainerColor: bare ? 'transparent' : colors.surfaceContainer,
          unfocusedContainerColor: bare
            ? 'transparent'
            : colors.surfaceContainer,
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
        modifiers={
          bare
            ? [fillMaxWidth(), padding(BARE_TITLE_INSET, 0, 0, 0)]
            : [fillMaxWidth()]
        }
      >
        {/* No magnifier in the bar — the back arrow is already the leading
            affordance there, and two glyphs for one job is one too many. */}
        {bare ? null : (
          <TextField.LeadingIcon>
            <Icon source={iconSource('search')} tint={colors.onSurfaceMuted} />
          </TextField.LeadingIcon>
        )}
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

/**
 * Lands the bare field's text on the app bar's TITLE keyline, so the search view
 * and a pushed screen's title share a left edge.
 *
 * Measured on a Galaxy A54: with a navigation icon present the bar's title
 * starts at 72.53dp (M3's 72) and the bare field's text started at 68.62 —
 * 3.91dp short. A `paddingStart` on the Host's RN style does not reach the
 * Compose content and was tried first; this is a Compose modifier, which does.
 */
const BARE_TITLE_INSET = 4;

const styles = {
  host: { width: '100%' as const },
  /**
   * The expanded app bar's title slot: stated, not measured (see the Host).
   *
   * 56, NOT 48, AND THE DIFFERENCE IS A CLIPPED DESCENDER. A Compose filled
   * `TextField` wants 56dp; squeezed into 48 it renders the line but cuts the
   * bottom off, which shows up as the "p" of "Search components" losing its
   * tail. Measured on a Galaxy A54: at 48 the placeholder's ink ends abruptly —
   * the per-row ink count falls 174, 211, 186, 151, 9, 4, a cut rather than a
   * taper — and at 56 it runs on as a 4px stem to the true baseline. Ink height
   * 13.16dp against 15.64.
   */
  hostBare: {
    width: '100%' as const,
    height: 56,
  },
};
