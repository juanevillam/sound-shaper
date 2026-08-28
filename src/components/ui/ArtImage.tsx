import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { emptyMediaColor, type MediaContainer } from '@portfolio/mobile-ui';
import { Image } from 'expo-image';

import { useAppTheme } from '@/hooks/useAppTheme';
import { thumbUrl } from '@/services/cloudinary/thumbUrl';

type ArtImageProps = {
  /**
   * WHERE THE SLOT SITS — forwarded by `SoundArt` so the loading box under the
   * image steps with its container exactly as the initial-letter fallback does
   * (see `emptyMediaColor`).
   */
  container?: MediaContainer;
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
  container,
  style,
  displayWidth,
  onError,
  fadeMs = FADE_MS,
  uri,
}: ArtImageProps) {
  const { colors, scheme } = useAppTheme();
  const sizedUri = displayWidth ? thumbUrl(uri, displayWidth) : uri;
  const source = { uri: sizedUri };
  const backdropUri =
    Platform.OS === 'ios' ? thumbUrl(uri, BACKDROP_SOURCE_WIDTH) : sizedUri;
  const backdropSource = { uri: backdropUri };

  return (
    // A neutral tinted box behind both layers is the placeholder the art fades
    // in over — the SHARED empty-media material (`emptyMediaColor`), so a slot
    // mid-load matches the initial-letter box it may fail over to.
    //
    // IT WAS A SWEEPING BONE, and that is the one placement the shared
    // language does not want. `SkeletonBone` is a PROMISE about content whose
    // shape is known and is arriving; a cover is a picture that may simply
    // never exist — every art-less sound in the library fails over to
    // `InitialArt` — so a bone here animated, then handed over to a static
    // grey box, saying "loading" about something that had already finished.
    // The still material is also what `SoundArt`'s two branches share, so the
    // slot's colour no longer changes on the frame the art resolves. Topper's
    // `ItemImage` records the same fix; this file is the twin that missed it.
    <View
      style={[
        styles.box,
        { backgroundColor: emptyMediaColor({ colors, container, scheme }) },
        style,
      ]}
    >
      <Image
        source={backdropSource}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={BACKDROP_BLUR}
        transition={fadeMs}
        // KEYED PER LAYER, by the url each one actually loads. A shared raw
        // `uri` told expo-image's recycler that two views holding different
        // assets were the same picture.
        recyclingKey={backdropUri}
        cachePolicy="memory-disk"
      />
      {/* Only the FOREGROUND layer reports failure: the backdrop is the same
          asset at 64px, so if the art is gone both fail, and reporting twice
          would just re-set the same state. */}
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={fadeMs}
        recyclingKey={sizedUri}
        cachePolicy="memory-disk"
        // A dead URL (deleted asset, bad transform, no network) must not leave
        // a blank tile forever — tell the caller to show the initial instead.
        onError={onError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
});
