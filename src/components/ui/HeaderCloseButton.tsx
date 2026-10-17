// Android stub. These sheets are ordinary pushed screens with a Material app
// bar there, so nothing mounts this — but the type checker resolves the base
// specifier and never applies `.ios`, so the twin has to exist for
// `@/components/ui/HeaderCloseButton` to type-check at all. See
// `docs/standards.md` → "iOS-only components".
export function HeaderCloseButton() {
  return null;
}
