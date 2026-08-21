// The editor sheets' media slot is shared by every portfolio app, so the
// component lives in `@portfolio/mobile-ui`. Re-exported here to keep this
// app's import paths stable, the same shim pattern `SquashPressable` uses.
//
// This app carried a FORK of it — 72pt and hard-circular, the shape it shipped
// with for Android, which on iOS meant the sheet drew a size Juan had already
// rejected in Topper and a crop this app renders nowhere else. See the
// package component's docstring.
//
// The PICTURE stays app-side: `ArtImage` carries this app's Cloudinary
// `thumbUrl` variants and its letterbox backdrop. Callers pass it as `preview`.
export {
  MediaPickerAvatar,
  MEDIA_PICKER_SIZE,
  type MediaPickerAvatarProps,
} from '@portfolio/mobile-ui';
