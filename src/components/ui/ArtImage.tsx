import { useEffect, useState } from 'react';

import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

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
  /**
   * Cross-dissolve length. Pass 0 where the caller animates the swap itself —
   * two stacked fades just make the art look slow to arrive.
   */
  fadeMs?: number;
  uri: string;
};

// Cover art comes in every aspect ratio, which looks ragged in a fixed box. So
// the full image is shown uncropped (`contain`) over a blurred, zoomed copy of
// itself (`cover`) — the blur fills the letterbox with a color-matched backdrop
// drawn from the image itself, no dominant-color extraction needed. Same idiom
// as Topper's ItemImage.
const BACKDROP_BLUR = 18;
// Each platform blurs at a different point in the pipeline, so the SAME radius
// lands differently. Android (Glide `BlurTransformation(r, sampling=4)`) blurs
// at VIEW size — always heavy. iOS (SDWebImage `SDImageBlurTransformer`, and it
// halves the radius) blurs the DECODED source bitmap before the view shrinks
// it, so 18 on a 2048px cover squeezed into the player's hero slot comes out
// sub-pixel — a SHARP zoomed copy behind the art instead of a wash. Only shows
// on non-square art (square covers leave no letterbox), which is why it hid
// here. Pinning iOS's backdrop to one tiny source makes the blur
// size-independent and matches Android at every slot. Topper's ItemImage does
// the same.
const BACKDROP_SOURCE_WIDTH = 64;
// Short cross-dissolve so artwork fades in instead of popping. Cached images
// load synchronously and skip it, so lists of already-seen art never flash.
const FADE_MS = 200;

export function ArtImage({
  style,
  displayWidth,
  onError,
  fadeMs = FADE_MS,
  uri,
}: ArtImageProps) {
  const source = { uri: displayWidth ? thumbUrl(uri, displayWidth) : uri };
  const backdropUri =
    Platform.OS === 'ios' ? thumbUrl(uri, BACKDROP_SOURCE_WIDTH) : source.uri;
  const backdropSource = { uri: backdropUri };
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
        source={backdropSource}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={BACKDROP_BLUR}
        transition={fadeMs}
        recyclingKey={uri}
        cachePolicy="memory-disk"
      />
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={fadeMs}
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
