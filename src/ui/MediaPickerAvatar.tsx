import { Platform, StyleSheet, Text, View } from 'react-native';

import { TEXT_VARIANTS } from './createText';
import {
  emptyMediaPlusStyle,
  EMPTY_MEDIA_CAPTION_GAP,
  EMPTY_MEDIA_PLUS,
} from './emptyMedia';
import { SquashPressable } from './SquashPressable';

/**
 * THE MEDIA SLOT AT THE TOP OF AN EDITOR SHEET — one component, every app.
 *
 * It lived in BOTH apps and had forked badly. Topper's took the whole iOS pass
 * (120pt Contacts-sized box, the shared empty-media plus, a caption inside the
 * press target, a real artwork radius); Sound Shaper's stayed exactly as it
 * shipped for Android and so, on iOS, drew a 72pt CIRCLE — the size Juan had
 * already rejected in Topper as "soo small", and a crop that app renders
 * nowhere else. `shared-code-audit` scored the pair 63.4%: low BECAUSE they had
 * drifted, which is the reading that matters.
 *
 * THE PACKAGE OWNS THE BOX, THE APP OWNS THE PICTURE. Every app fetches its
 * artwork through its own Cloudinary wrapper (`ItemImage`, `ArtImage` — each
 * with its own `thumbUrl` service and its own letterbox treatment), and none of
 * that can move into a package that declares no Firebase or Cloudinary
 * dependency. So the caller passes the rendered image as `preview` and this
 * owns everything else: the size, the corner, the placeholder, the press
 * feedback and the caption slot.
 */

/**
 * Exported so callers deriving a preview radius use the REAL box size.
 *
 * 120 ON BOTH, the Contacts photo-editor size. The picker FLOATS on the sheet
 * — there is no row fill for it to sit in on either platform — and at 72 it
 * read as a thumbnail rather than the sheet's subject (Juan: "soo small" on
 * iOS 2026-08, and again on Android 2026-09-07: "way smaller and idk why").
 *
 * It was `Platform.select({ ios: 120, default: 72 })`, and the note defending
 * the 72 said the Android disc "sits inside a filled Compose row — a different
 * container". That was never true of the editor sheets, which centre it in a
 * plain column exactly as iOS does; the 72 was the pre-iOS-pass number nobody
 * had revisited, which the note itself half-admitted ("no longer a decision
 * the freeze made"). One box, one number.
 */
export const MEDIA_PICKER_SIZE = 120;
const AVATAR_SIZE = MEDIA_PICKER_SIZE;
const AVATAR_RADIUS = AVATAR_SIZE / 2;

export type MediaPickerAvatarProps = {
  onPress: () => void;
  /**
   * Already-translated screen-reader label — the slot renders only a picture,
   * so it has no text of its own to be read. Packages have no translator.
   */
  accessibilityLabel: string;
  /** Disc background behind the placeholder. */
  surfaceColor: string;
  /** Ink of the placeholder glyph. */
  contentColor: string;
  /**
   * The rendered artwork, when there is any. The app supplies it because only
   * the app knows how to fetch its own media; this component decides only
   * WHERE it goes and what shape it is clipped to.
   */
  preview?: React.ReactNode;
  /** No-op the press, e.g. while the sheet is committing. */
  disabled?: boolean;
  /**
   * Already-translated label rendered UNDER the box, INSIDE the same pressable
   * — a create tile is one press target for art plus caption and this is the
   * same affordance.
   *
   * Omit it where the caption is a STATUS rather than an action — a status
   * inside a press target is worse than either arrangement. Sound Shaper's slot
   * used to be exactly that case, its art coming from the file's ID3 tag and
   * from nowhere else; it gained a real picker on 2026-08-21, so its caption is
   * an ACTION now ("Add Artwork" / "Change Artwork") and lives inside the press
   * target like Topper's.
   *
   * AND IT MUST NOT BECOME ONE WHILE THE SHEET IS BUSY, which is the same rule
   * arriving through a LAYOUT defect rather than through taste. THIS TEXT'S
   * INTRINSIC WIDTH SIZES THE PRESSABLE — the box is fixed, the caption is
   * usually the wider child — so swapping the wording mid-flight resizes the
   * control and the words under the artwork jump outward. Sound Shaper's
   * editor swapped to "Uploading sound…" on save, on BOTH platforms, and Juan
   * caught the shift on iOS (2026-09-11). A busy sheet already has one
   * indicator, in the commit control's own slot; this one was both a second
   * and a moving one. Keep the caption constant across a save and let
   * `captionColor` carry the disabled state.
   */
  caption?: string;
  /** Caption ink — the accent (it labels an action), muted while disabled. */
  captionColor?: string;
  /**
   * Corner radius of the preview. Defaults to a full circle, which is right
   * for a PERSON — Topper's editors name a top and a top item, and a disc is
   * what a photo of a thing takes there.
   *
   * PASS THE ARTWORK RADIUS FOR ARTWORK. A picture standing for a recording is
   * a rounded square everywhere the platforms draw one, so Sound Shaper's sound
   * editor states `artworkRadius` on BOTH platforms; without it that sheet
   * disc-cropped an album cover the app renders as a rounded square in every
   * other slot. The slot should preview the crop the media will actually render
   * in.
   */
  radius?: number;
};

const noop = () => {};

export function MediaPickerAvatar({
  onPress,
  accessibilityLabel,
  surfaceColor,
  contentColor,
  preview,
  disabled = false,
  radius = AVATAR_RADIUS,
  caption,
  captionColor,
}: MediaPickerAvatarProps) {
  return (
    // Full-width row so the preview centres RN-side: `RNHostView` passes no
    // size of its own, so the child has to carry its own box AND centre itself
    // in a full-width wrapper.
    <View style={styles.center}>
      <SquashPressable
        onPress={disabled ? noop : onPress}
        accessibilityLabel={accessibilityLabel}
        // CENTRE THE PRESS TARGET'S OWN CHILDREN. The wrapper above centres
        // this pressable; inside it the avatar is a FIXED-width box beside a
        // caption that is usually wider ("Change Photo"), and at the default
        // `stretch` the fixed child lands at flex-start — so the square sat
        // LEFT of the words under it (Juan, 2026-09-07). Invisible while the
        // box was wider than its caption, which is why only Android showed it.
        style={styles.press}
      >
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: preview ? 'transparent' : surfaceColor,
              borderRadius: radius,
            },
          ]}
        >
          {/* THE PLUS, ALWAYS — the affordance every media picker in the
              portfolio draws for an empty slot. An `emoji` fallback prop stood
              here and Sound Shaper's Android editor was its one caller,
              drawing 🎵 where its own iOS twin and every Topper picker draw
              the plus (Juan, 2026-09-10); the prop went with the drift. */}
          {preview ?? (
            <Text style={[styles.plus, { color: contentColor }]}>
              {Platform.OS === 'ios' ? EMPTY_MEDIA_PLUS : '＋'}
            </Text>
          )}
        </View>
        {caption ? (
          <Text
            style={[
              styles.caption,
              captionColor ? { color: captionColor } : null,
            ]}
          >
            {caption}
          </Text>
        ) : null}
      </SquashPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', width: '100%' },
  press: { alignItems: 'center' },
  avatar: {
    alignItems: 'center',
    borderRadius: AVATAR_RADIUS,
    height: AVATAR_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
    width: AVATAR_SIZE,
  },
  // The create tile's caption terms — same gap, same type step, so the two
  // "tap to fill this box" affordances read identically. `TEXT_VARIANTS` is
  // the apps' own scale, so this is `bodyMedium` in both without the package
  // needing either app's `Text`.
  caption: {
    ...TEXT_VARIANTS.bodyMedium,
    marginTop: EMPTY_MEDIA_CAPTION_GAP,
    textAlign: 'center',
  },
  // THE SHARED SPEC ON BOTH — the glyph is a RATIO of the box it sits in
  // (`emptyMediaPlusStyle`), which is the rule every create tile follows.
  // Android had a flat 28, fine in a 72 box and lost in a 120 one; a
  // hard-coded glyph size cannot survive its container changing.
  plus: emptyMediaPlusStyle(MEDIA_PICKER_SIZE),
});
