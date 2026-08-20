import { StyleSheet, View } from 'react-native';

/**
 * ANDROID'S TRANSPORT GLYPHS — hand-drawn from plain views.
 *
 * Compose `Icon`s here blink on navigation returns (the drag-dots lesson), and
 * the shapes are simple enough to draw exactly. That reason is ANDROID'S, which
 * is the whole point of this file existing separately: it used to be the
 * justification on both platforms, so iOS inherited a Compose workaround and
 * drew SF Symbols' job out of CSS triangles. See `TransportGlyphs.ios`.
 */

export type TransportGlyphProps = {
  color: string;
  /** iOS only — the SF Symbol's point size. Ignored here; these are drawn. */
  size?: number;
};

export const PlayGlyph = ({ color }: TransportGlyphProps) => (
  <View style={[styles.playTriangle, { borderLeftColor: color }]} />
);

export const PauseGlyph = ({ color }: TransportGlyphProps) => (
  <View style={styles.pauseRow}>
    <View style={[styles.pauseBar, { backgroundColor: color }]} />
    <View style={[styles.pauseBar, { backgroundColor: color }]} />
  </View>
);

export const NextGlyph = ({ color }: TransportGlyphProps) => (
  <View style={styles.nextRow}>
    <View style={[styles.nextTriangle, { borderLeftColor: color }]} />
    <View style={[styles.nextBar, { backgroundColor: color }]} />
  </View>
);

export const PreviousGlyph = ({ color }: TransportGlyphProps) => (
  <View style={styles.previousRow}>
    <View style={[styles.nextBar, { backgroundColor: color }]} />
    <View style={[styles.previousTriangle, { borderRightColor: color }]} />
  </View>
);

const styles = StyleSheet.create({
  playTriangle: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 9,
    borderLeftWidth: 14,
    borderTopColor: 'transparent',
    borderTopWidth: 9,
    marginLeft: 3,
  },
  pauseRow: { flexDirection: 'row', gap: 4 },
  pauseBar: { borderRadius: 1.5, height: 16, width: 4.5 },
  nextRow: { alignItems: 'center', flexDirection: 'row', gap: 1.5 },
  nextTriangle: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 7,
    borderLeftWidth: 11,
    borderTopColor: 'transparent',
    borderTopWidth: 7,
  },
  nextBar: { borderRadius: 1, height: 14, width: 2.5 },
  previousRow: { alignItems: 'center', flexDirection: 'row', gap: 1.5 },
  previousTriangle: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 7,
    borderRightWidth: 11,
    borderTopColor: 'transparent',
    borderTopWidth: 7,
  },
});
