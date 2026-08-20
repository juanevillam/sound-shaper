import { type LabScreen } from '@/dev/uiStateLab';

/**
 * DEV-ONLY LAB UI — Android stub. The state lab is an iOS-only experiment; this
 * exists so the shared import path resolves for the type checker, which does not
 * apply the `.ios` suffix. Never rendered.
 *
 * `LabScreen` is IMPORTED, not restated: two copies of the union would have to
 * be kept in step, and one of them lives in a frozen Android file.
 */
export function UiStateLabBar(_props: { screen: LabScreen }): null {
  return null;
}
