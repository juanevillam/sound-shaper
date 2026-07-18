import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Image } from 'expo-image';

import { useAppTheme } from '@/hooks/useAppTheme';
import { thumbUrl } from '@/services/cloudinary/thumbUrl';

type ArtImageProps = {
  /** Box style — set the size + borderRadius here; the image fills it. */
  style?: StyleProp<ViewStyle>;
  /**
   * Layout width (dp) of the slot. When set, a Cloudinary cover URL is fetched
   * as a display-sized variant instead of the full embedded art; omit for
   * hero/detail renders that want the full asset.
   */
  displayWidth?: number;
  uri: string;
};

// Cover art comes in every aspect ratio, which looks ragged in a fixed box. So
// the full image is shown uncropped (`contain`) over a blurred, zoomed copy of
// itself (`cover`) — the blur fills the letterbox with a color-matched backdrop
// drawn from the image itself, no dominant-color extraction needed. Same idiom
// as Topper's ItemImage (minus the Cloudinary display-width variants — art here
// serves from Firebase Storage as stored).
const BACKDROP_BLUR = 18;
// Short cross-dissolve so artwork fades in instead of popping. Cached images
// load synchronously and skip it, so lists of already-seen art never flash.
const FADE_MS = 200;

export function ArtImage({ style, displayWidth, uri }: ArtImageProps) {
  const { colors } = useAppTheme();
  const source = { uri: displayWidth ? thumbUrl(uri, displayWidth) : uri };

  return (
    // A neutral tinted box behind both layers is the placeholder the art fades
    // in over — the same surface as every other empty media slot in the app.
    <View
      style={[styles.box, { backgroundColor: colors.surfaceVariant }, style]}
    >
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={BACKDROP_BLUR}
        transition={FADE_MS}
        recyclingKey={uri}
        cachePolicy="memory-disk"
      />
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={FADE_MS}
        recyclingKey={uri}
        cachePolicy="memory-disk"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
});
