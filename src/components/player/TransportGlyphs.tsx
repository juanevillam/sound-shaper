import { StyleSheet, View } from 'react-native';

/**
 * ANDROID'S TRANSPORT GLYPHS — hand-drawn from plain views.
 *
 * Compose `Icon`s here blink on navigation returns (the drag-dots lesson), and
 * the shapes are simple enough to draw exactly. That reason is ANDROID'S, which
 * is the whole point of this file existing separately: it used to be the
 * justification on both platforms, so iOS inherited a Compose workaround and
 * drew SF Symbols' job out of CSS triangles. See `TransportGlyphs.ios`.
 *
 * SIZED SINCE 2026-09-08: the expanded console took the iOS transport's
 * size-not-fill hierarchy (play larger than the skips, no FAB), so the glyphs
 * scale from a `size` prop — the same point-size contract the iOS twins take,
 * with the drawn ink at a fixed ratio of it so the two platforms' rows read
 * the same weight. Omitting `size` keeps the collapsed banner's original
 * small set exactly (BASE below reproduces the old numbers at 1×).
 */

export type TransportGlyphProps = {
  color: string;
  /** The glyph's point size; omit for the banner's original small set. */
  size?: number;
};

/** The old drawn set's implicit box — `size` scales relative to this. */
const BASE = 18;

export const PlayGlyph = ({ color, size }: TransportGlyphProps) => {
  const s = (size ?? BASE) / BASE;

  return (
    <View
      style={[
        styles.playTriangle,
        {
          borderBottomWidth: 9 * s,
          borderLeftColor: color,
          borderLeftWidth: 14 * s,
          borderTopWidth: 9 * s,
          marginLeft: 3 * s,
        },
      ]}
    />
  );
};

export const PauseGlyph = ({ color, size }: TransportGlyphProps) => {
  const s = (size ?? BASE) / BASE;

  return (
    <View style={[styles.pauseRow, { gap: 4 * s }]}>
      <View
        style={[
          styles.pauseBar,
          {
            backgroundColor: color,
            borderRadius: 1.5 * s,
            height: 16 * s,
            width: 4.5 * s,
          },
        ]}
      />
      <View
        style={[
          styles.pauseBar,
          {
            backgroundColor: color,
            borderRadius: 1.5 * s,
            height: 16 * s,
            width: 4.5 * s,
          },
        ]}
      />
    </View>
  );
};

export const NextGlyph = ({ color, size }: TransportGlyphProps) => {
  const s = (size ?? BASE) / BASE;

  return (
    <View style={[styles.nextRow, { gap: 1.5 * s }]}>
      <View
        style={[
          styles.nextTriangle,
          {
            borderBottomWidth: 7 * s,
            borderLeftColor: color,
            borderLeftWidth: 11 * s,
            borderTopWidth: 7 * s,
          },
        ]}
      />
      <View
        style={[
          styles.nextBar,
          {
            backgroundColor: color,
            borderRadius: 1 * s,
            height: 14 * s,
            width: 2.5 * s,
          },
        ]}
      />
    </View>
  );
};

export const PreviousGlyph = ({ color, size }: TransportGlyphProps) => {
  const s = (size ?? BASE) / BASE;

  return (
    <View style={[styles.previousRow, { gap: 1.5 * s }]}>
      <View
        style={[
          styles.nextBar,
          {
            backgroundColor: color,
            borderRadius: 1 * s,
            height: 14 * s,
            width: 2.5 * s,
          },
        ]}
      />
      <View
        style={[
          styles.previousTriangle,
          {
            borderBottomWidth: 7 * s,
            borderRightColor: color,
            borderRightWidth: 11 * s,
            borderTopWidth: 7 * s,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  playTriangle: {
    borderBottomColor: 'transparent',
    borderTopColor: 'transparent',
  },
  pauseRow: { flexDirection: 'row' },
  pauseBar: {},
  nextRow: { alignItems: 'center', flexDirection: 'row' },
  nextTriangle: {
    borderBottomColor: 'transparent',
    borderTopColor: 'transparent',
  },
  nextBar: {},
  previousRow: { alignItems: 'center', flexDirection: 'row' },
  previousTriangle: {
    borderBottomColor: 'transparent',
    borderTopColor: 'transparent',
  },
});
