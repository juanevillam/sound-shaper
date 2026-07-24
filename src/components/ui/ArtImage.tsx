import { useEffect, useState } from 'react';

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Image } from 'expo-image';

import { Skeleton } from '@/components/ui/Skeleton';
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
  /** Raised when the art can't be fetched, so the caller can fall back. */
  onError?: () => void;
  uri: string;
};

// Cover art comes in every aspect ratio, which looks ragged in a fixed box. So
// the full image is shown uncropped (`contain`) over a blurred, zoomed copy of
// itself (`cover`) — the blur fills the letterbox with a color-matched backdrop
// drawn from the image itself, no dominant-color extraction needed. Same idiom
// as Topper's ItemImage.
const BACKDROP_BLUR = 18;
// Short cross-dissolve so artwork fades in instead of popping. Cached images
// load synchronously and skip it, so lists of already-seen art never flash.
const FADE_MS = 200;

export function ArtImage({ style, displayWidth, onError, uri }: ArtImageProps) {
  const source = { uri: displayWidth ? thumbUrl(uri, displayWidth) : uri };
  // Until the art decodes the slot PULSES: a still grey square is
  // indistinguishable from a broken image, which is exactly how a slow load
  // used to read.
  const [loaded, setLoaded] = useState(false);

  // A recycled row pointing at new art is loading again.
  useEffect(() => setLoaded(false), [uri]);

  return (
    <View style={[styles.box, style]}>
      {loaded ? null : (
        // `style` lands last in Skeleton's style array, so the explicit 100%
        // height here overrides its default block height.
        <Skeleton radius={0} style={styles.placeholder} />
      )}
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
        onLoad={() => setLoaded(true)}
        // A dead URL (deleted asset, bad transform, no network) must not leave
        // a blank tile forever — tell the caller to show the glyph instead.
        onError={onError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  placeholder: {
    bottom: 0,
    height: '100%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },
});
