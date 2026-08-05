import { type SettingsUsernameEditor } from './SettingsAccountSection';

/**
 * Android base so `tsc` resolves the import; Metro picks the `.ios` variant on
 * iOS. Nothing renders this — Android edits the username through its own
 * Compose text dialog, mounted by the screen rather than wrapped around a row.
 * Renders its children unchanged so an accidental Android call site shows the
 * row rather than losing it.
 */
export function UsernameEditRowIos({
  children,
}: {
  editor: SettingsUsernameEditor;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
