// A failure said INSIDE a Compose sheet, because the toast cannot be seen from
// in there. It lives in `@portfolio/mobile-ui` now that Topper takes it too;
// re-exported here to keep this app's import path stable, the same shim pattern
// `SheetBar` and `SquashPressable` use.
export { SheetErrorLine } from '@portfolio/mobile-ui';
