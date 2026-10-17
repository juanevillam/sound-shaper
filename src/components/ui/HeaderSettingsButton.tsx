// Android never renders this: there the settings entry is a Compose
// `HeaderIconButton` in the Material app bar home draws as its own content —
// content rather than the navigator's header, so the expanded player can cover
// it (see home.tsx). The iOS variant (`HeaderSettingsButton.ios.tsx`) is the
// real one; this base exists so tsc resolves the import.
export function HeaderSettingsButton() {
  return null;
}
