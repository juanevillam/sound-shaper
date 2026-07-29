// Android base for `BannerGlass.ios.tsx`. Material has no Liquid Glass and
// wants none: a floating surface there is defined by its tonal fill and its
// elevation, both of which the banner already has. Renders nothing, so the
// surface's own colour shows through unchanged.
//
// The file exists so the import resolves on both platforms — the iOS twin
// pulls in `@expo/ui/swift-ui`, which must not reach the Android bundle.

export type BannerGlassProps = {
  width: number;
  height: number;
  radius: number;
};

export function BannerGlass(_props: BannerGlassProps) {
  return null;
}
