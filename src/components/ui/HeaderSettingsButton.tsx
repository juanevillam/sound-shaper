// Android never renders this: Sound Shaper's Android settings entry is the
// Compose gear in home's own Material app bar, which is frozen for release.
// The iOS variant (`HeaderSettingsButton.ios.tsx`) is the real one; this base
// exists so tsc resolves the import.
export function HeaderSettingsButton() {
  return null;
}
