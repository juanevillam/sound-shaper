import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';

// ANDROID DOES NOT NAVIGATE HERE ANY MORE — the clip editor is a Compose
// SHEET (`ClipTrimSheet`, stacked over the Clips sheet that mounts it), not a
// pushed screen: a full route replaced the whole player mid-flow, which broke the sheet-over-player
// rhythm every other clip surface keeps (Juan, 2026-09-08). It lived as a
// pushed full-screen dialog for exactly one day; the iOS presentation is the
// `.ios.tsx` twin. This stub only guards the external deep link, exactly as
// `iosOnlyRoute` does for the other sheet routes.
function ClipTrimRouteStub() {
  return null;
}

export default iosOnlyRoute(ClipTrimRouteStub);
