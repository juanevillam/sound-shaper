import { Platform, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@portfolio/core';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The portfolio's app-root header: a big page heading that lives IN the
 * content, and an opaque bar above it whose small title fades in as the
 * heading scrolls beneath. One behaviour, two platform languages — this is the
 * same collapse both design systems specify, so nothing has to be invented for
 * either side:
 *
 * - **iOS** — the system large title. 34pt bold heading, a 54pt inline bar
 *   with a 17pt semibold CENTRED title, and the small settle-upward the
 *   system hand-off has. The bar is opaque `background` throughout.
 * - **Android** — Material 3's LARGE TOP APP BAR. 28sp headline, a 64dp small
 *   bar with a 22sp LEFT-ALIGNED title, and the on-scroll container colour:
 *   the bar is the plain background at rest and only takes the raised
 *   `surfaceContainer` tone once you have actually scrolled. At rest there is
 *   no band across the top at all.
 *
 * Why the bar sits in FLOW rather than over the list: it is opaque and
 * directly above the content, so "the heading slides under the bar" needs no
 * overlay, no clipping and no scroll insets — the heading simply leaves
 * through the list's top edge, which is the bar's bottom edge.
 *
 * Labels arrive already translated; the package has no app translator.
 */

/**
 * Bar geometry. Material's small top app bar is 64dp with its content centred.
 *
 * iOS is NOT the classic 44: iOS 26's navigation bar is 54pt, and the extra
 * 10 is padding BENEATH content that still occupies the top 44. Measured
 * against Topper's profile, whose header is a real `UINavigationBar` — bar
 * bottom 116.0, action 62.0→105.7, title centre 85.2. Sizing this bar at 44
 * put the action flush on its bottom edge, with no air under it.
 */
const BAR_HEIGHT = Platform.select({ ios: 54, default: 64 }) as number;

/** The part of the bar that carries nothing — iOS only (see above). */
const BAR_BOTTOM_PAD = Platform.select({ ios: 10, default: 0 }) as number;

// The bar title crosses over while the heading is sliding under it, so the
// hand-off reads sticky rather than as two separate events. A wide window
// plus a small rise beats a bare fade.
const FADE_START = 8;
const FADE_END = 56;
const TITLE_RISE = 10;

// Where the trailing action sits: on the grid margin either way, measured to
// the edge of its TOUCH TARGET. Material's icon is a 24dp glyph centred in a
// 48dp box, so 4 lands the box on the 16dp margin; iOS bar buttons are 44pt
// and sit at 16, which is where UIKit puts a real one — checked against Expo
// Starter's gear, whose header IS a navigation bar.
const ACTION_INSET = Platform.select({ ios: 16, default: 4 }) as number;

// Material aligns bar content to the grid margin; iOS centres its inline
// title, so the value is unused there.
const BAR_TITLE_INSET = 16;

const HEADING = Platform.select({
  // Apple's large-title metrics, exactly.
  ios: { fontSize: 34, fontWeight: '700' as const, lineHeight: 41 },
  // M3's large top app bar headline is headlineMedium at regular weight —
  // Material gets its emphasis from size, not from weight.
  default: { fontSize: 28, fontWeight: '400' as const, lineHeight: 36 },
});

const BAR_TITLE = Platform.select({
  ios: { fontSize: 17, fontWeight: '600' as const },
  default: { fontSize: 22, fontWeight: '400' as const },
});

/**
 * Air under the heading before the content starts. It belongs to the HEADING,
 * not to whatever happens to follow it — otherwise every screen re-invents it
 * and they drift. Material leaves more: its headline sits inside a tall
 * container, where Apple's large title is followed almost immediately.
 */
const HEADING_GAP = Platform.select({ ios: 16, default: 20 }) as number;

const IS_IOS = Platform.OS === 'ios';

/**
 * Drives the collapse. Hand `onScroll` to the screen's scrollable and
 * `scrollY` to `CollapsingHeaderBar` — the offset stays on the UI thread, so
 * neither the fade nor the colour costs a React render.
 */
export function useCollapsingHeader() {
  const scrollY = useSharedValue(0);

  return {
    scrollY,
    onScroll: (event: {
      nativeEvent: { contentOffset: { y: number } };
    }): void => {
      scrollY.value = event.nativeEvent.contentOffset.y;
    },
    /** FlashList/ScrollView stream scroll events; coarse is plenty here. */
    scrollEventThrottle: 16,
  };
}

type CollapsingHeaderBarProps = {
  /** Already-translated app/page title. Mirrors the heading below it. */
  title: string;
  scrollY: SharedValue<number>;
  /** Trailing action(s) — a settings gear, a create button. */
  right?: React.ReactNode;
};

/** The bar itself: status-bar inset, the fading title, the trailing slot. */
export function CollapsingHeaderBar({
  title,
  scrollY,
  right,
}: CollapsingHeaderBarProps) {
  const { colors } = useAppTheme();
  const { top: topInset } = useSafeAreaInsets();

  const surfaceStyle = useAnimatedStyle(() => ({
    // iOS bars are opaque from the start; Material's raises its container
    // only once content has gone under it.
    backgroundColor: IS_IOS
      ? colors.background
      : interpolateColor(
          scrollY.value,
          [FADE_START, FADE_END],
          [colors.background, colors.surfaceContainer],
        ),
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [FADE_START, FADE_END],
      [0, 1],
      'clamp',
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [FADE_START, FADE_END],
          [TITLE_RISE, 0],
          'clamp',
        ),
      },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          height: topInset + BAR_HEIGHT,
          paddingBottom: BAR_BOTTOM_PAD,
          paddingTop: topInset,
        },
        surfaceStyle,
      ]}
    >
      <Animated.Text
        numberOfLines={1}
        style={[
          styles.barTitle,
          BAR_TITLE,
          { color: colors.onSurface },
          titleStyle,
        ]}
      >
        {title}
      </Animated.Text>
      {right ? (
        // PINNED, and it never moves: the action sits where it will be once
        // the header has collapsed, and only the title animates under it —
        // WhatsApp's compose button, and every system bar. A bar button
        // belongs to the BAR, not to the heading, so travelling with the
        // scroll makes it read as content that happens to end up in a bar.
        //
        // Offset by the status-bar inset like the title is: without it the
        // action centres over the WHOLE bar including the inset, which lifts
        // it into the status bar and jams it against the corner.
        <View style={[styles.action, { top: topInset }]}>{right}</View>
      ) : null}
    </Animated.View>
  );
}

type CollapsingHeaderTitleProps = {
  /** Already-translated — the same string the bar carries. */
  text: string;
};

/**
 * The big heading. It belongs to the CONTENT, not the chrome: put it in the
 * scrollable's header slot so it scrolls away like any other row. Horizontal
 * padding comes from the list's own content inset, so the heading lines up
 * with the rest of the screen by construction.
 */
export function CollapsingHeaderTitle({ text }: CollapsingHeaderTitleProps) {
  const { colors } = useAppTheme();

  return (
    <Text style={[styles.heading, HEADING, { color: colors.onSurface }]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  bar: {
    // Cross axis is vertical here — the title centres in the space BELOW the
    // status-bar inset either way. Only the horizontal placement differs.
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: IS_IOS ? 'center' : 'flex-start',
    paddingHorizontal: IS_IOS ? 0 : BAR_TITLE_INSET,
    // The action hangs BELOW the bar while the header is open, and the list is
    // a later sibling — without this it would paint over the action.
    zIndex: 1,
  },
  barTitle: { flexShrink: 1 },
  // Absolute, so a centred iOS title stays centred on the SCREEN rather than
  // in the space left over beside the action.
  action: {
    alignItems: 'flex-end',
    // Stops at the bar's content box, not its bottom edge — the action lives
    // in the top 44pt, exactly as a real bar button item does.
    bottom: BAR_BOTTOM_PAD,
    justifyContent: 'center',
    paddingRight: ACTION_INSET,
    position: 'absolute',
    right: 0,
  },
  heading: { paddingBottom: HEADING_GAP },
});
