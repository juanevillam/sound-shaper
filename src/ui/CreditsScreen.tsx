import React, { useCallback, useEffect, useState, type ReactNode } from 'react';

import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AUTHOR_CREDIT } from './author';
import { BrandTile } from './BrandTile';
import { spacing } from './tokens';

/**
 * THE CREDIT ROLL — the receding-perspective crawl every one of these apps
 * ends on, unlocked by finishing the app (Topper's platinum, the starter's
 * last showcase).
 *
 * IT IS AN HOMAGE, NOT A REPLICA, and the difference is deliberate rather than
 * timid. What is borrowed is the GRAMMAR — an opening line on black, a mark
 * that recedes, then text laid on a plane tilting away to a vanishing point.
 * What is NOT borrowed is anything that identifies the film: no yellow, no
 * Franklin Gothic, no "episode" numbering, and the words "Star Wars" appear
 * nowhere in this app. The palette is the portfolio's own icon pair — `#F5F5F5`
 * ink on `#222222` ground, the same two greys the app icon, the splash and
 * `BrandTile` use — so the screen reads as this brand's ending rather than
 * someone else's opening. That is both the honest design answer and the one
 * that keeps an App Store review boring.
 *
 * IT IS AUTHORED RN, and the native primitive it rejects is the whole native
 * kit: there is no SwiftUI or Compose control for a perspective crawl, and the
 * surface is brand chrome rather than app content — the same carve-out
 * `BrandTile` and the welcome hero already take (see AGENTS.md → Brand). It
 * stays pure RN, with no platform variant, because both platforms draw the
 * identical thing: the mark, the greys and the roll are the brand's, not the
 * OS's. Its CHROME is a different matter — the close glyph is the route's
 * native bar item, not something drawn here.
 *
 * NO AUDIO. Two independent reasons, either one sufficient: a theme would be
 * someone else's copyright, and this app family already learned that playing
 * anything at all interrupts whatever the person is listening to (see the
 * audio-session note in `expo-audio` usage) — a 40-second cue that silences
 * their music to play ours is the worst version of that bug.
 */

/**
 * The brand ground and ink, fixed in both appearances exactly as the icon is.
 * Not themed: this is the app's edge, and the edge does not follow the OS.
 *
 * EXPORTED because the route's own chrome has to agree with them — the screen
 * behind a transparent nav bar is this ground in light mode too, so the bar's
 * glyph takes `CREDITS_INK` rather than the theme's `onSurface` (which is
 * near-black, on near-black). One pair, stated once.
 */
export const CREDITS_GROUND = '#222222';
export const CREDITS_INK = '#F5F5F5';
const GROUND = CREDITS_GROUND;
const INK = CREDITS_INK;
/** Role labels sit back from the names they introduce. */
const MUTED_OPACITY = 0.55;

/**
 * How fast the plane travels, in points of CONTENT height per second. The
 * crawl's duration is therefore set by how much there is to say rather than by
 * a fixed number — adding a role lengthens the roll instead of speeding it up.
 * 42 lands a typical roll at roughly 45 seconds, which is long enough to feel
 * ceremonial and short enough that the close glyph is not the only way out.
 */
const CRAWL_SPEED = 42;

/** The opening beat, in ms: fade the line up, hold it, take it away. */
const INTRO = { fadeIn: 900, hold: 1800, fadeOut: 700 };
/** The mark's recede, starting while the opening line is still leaving. */
const LOGO = { delay: 2600, fadeIn: 600, travel: 3800 };
/** The crawl starts before the mark has finished going, so nothing ever
 *  sits on an empty screen. */
const CRAWL_DELAY = 6200;
/** The closing card, after the last line has left the top of the plane. */
const OUTRO_FADE = 1200;

/** How far the mark starts from the viewer, and where it settles as it goes. */
const LOGO_SCALE = { from: 2.4, to: 0.34 };

/**
 * The plane's tilt, and the eye's distance from it.
 *
 * ROTATED ABOUT ITS OWN CENTRE, which is not a detail — it is the difference
 * between a crawl and a smear. The first version pinned `transformOrigin` to
 * the bottom edge so the plane would "hinge" there; RN moves the ROTATION
 * origin with that property but leaves the PERSPECTIVE vanishing point at the
 * view's centre, so the projection went off-axis and every line came out
 * sheared to the right, reading as a bad italic. Left at the centre, the two
 * agree: content above the middle recedes and converges, content below it comes
 * toward the viewer, and both halves stay symmetrical about the vertical axis.
 *
 * 34° at a perspective of 640 is the pair that keeps a line legible for about
 * the top two thirds of its travel at phone sizes. Steeper (the 58° this
 * started at) squeezes the whole roll into a band a few lines tall and it is
 * unreadable before it is read; shallower and the type barely tilts at all.
 */
const PLANE = { perspective: 640, rotateX: '34deg' };

/** The fraction of the screen the horizon fade covers, top-down. */
const HORIZON = 0.42;
/**
 * How much further the plane travels after its last line has passed the top of
 * the screen, as a fraction of a screen. In perspective the far end of the
 * plane is compressed, so a line is still visible (small, faded) long after its
 * untransformed position would have left — this is what carries it the rest of
 * the way to the vanishing point before the closing card arrives.
 */
const HORIZON_CLEARANCE = 0.5;

/**
 * UIKit's compact navigation-bar height. The route presents this screen under a
 * TRANSPARENT bar carrying the close glyph, so the animated crawl (which centres
 * everything) never notices — but the reduce-motion list starts at the top of
 * the screen and would put the app's icon behind the notch and the glyph.
 *
 * Apple's number, not a guess: 44 is the standard bar height, and the glass
 * capsule around a lone bar glyph measures 43–44 with it (see
 * `HeaderGlyphButtonIos`). Added to the device's own top inset.
 */
const NAV_BAR_HEIGHT = 44;

export type CreditsRole = {
  /** The job, in title case — it is a label. */
  role: string;
  /** Who did it. One line each; the roll is built for one or two. */
  names: string[];
};

export type CreditsScreenProps = {
  /** The app's own name, on the opening card under the mark. */
  appName: string;
  /** The app's brand glyph, same contract as `WelcomeScreen`'s `logo`. */
  logo: (options: { size: number; color: string }) => ReactNode;
  /** The single sentence that opens the roll, already translated. */
  intro: string;
  /** The roll itself, in order. */
  roles: CreditsRole[];
  /** Heading over the technology list. */
  builtWithTitle: string;
  builtWith: string[];
  /** The last line before the byline — a thank-you, already translated. */
  outro: string;
};

const TILE_SIZE = 132;
const TILE_GLYPH = 78;

/**
 * The opening card: the app's icon as iOS itself would draw it, receding.
 * `BrandTile` is the real tile — the same superellipse, shine and shadow the
 * welcome hero uses — rather than a flat square drawn for this screen, so the
 * thing that flies away is genuinely the app's icon.
 */
const OpeningMark = ({
  appName,
  logo,
}: Pick<CreditsScreenProps, 'appName' | 'logo'>) => (
  <View style={styles.markCard}>
    {/* Always the DARK tile: the ground under it is fixed dark, so the light
        tile would be a white slab on black rather than this app's icon. */}
    <BrandTile
      size={TILE_SIZE}
      glyphSize={TILE_GLYPH}
      scheme="dark"
      logo={logo}
    />
    <Text style={styles.markName}>{appName}</Text>
  </View>
);

/** The roll's body — shared by the crawling plane and the reduce-motion list,
 *  so the two can never say different things. */
const RollBody = ({
  roles,
  builtWithTitle,
  builtWith,
}: Pick<CreditsScreenProps, 'roles' | 'builtWithTitle' | 'builtWith'>) => (
  <>
    {roles.map(({ role, names }) => (
      <View key={role} style={styles.block}>
        <Text style={styles.role}>{role}</Text>
        {names.map(name => (
          <Text key={name} style={styles.name}>
            {name}
          </Text>
        ))}
      </View>
    ))}
    <View style={styles.block}>
      <Text style={styles.role}>{builtWithTitle}</Text>
      {builtWith.map(tool => (
        <Text key={tool} style={styles.name}>
          {tool}
        </Text>
      ))}
    </View>
  </>
);

export const CreditsScreen = ({
  appName,
  logo,
  intro,
  roles,
  builtWithTitle,
  builtWith,
  outro,
}: CreditsScreenProps) => {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const introOpacity = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(LOGO_SCALE.from);
  const crawlY = useSharedValue(screenHeight);
  const outroOpacity = useSharedValue(0);

  /** Measured on the plane's content, which is what sets the roll's length. */
  const [rollHeight, setRollHeight] = useState(0);

  const measureRoll = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      const { height } = event.nativeEvent.layout;
      setRollHeight(current => (current === height ? current : height));
    },
    [],
  );

  useEffect(() => {
    if (reduceMotion) return;

    introOpacity.value = withSequence(
      withTiming(1, { duration: INTRO.fadeIn }),
      withDelay(INTRO.hold, withTiming(0, { duration: INTRO.fadeOut })),
    );

    logoOpacity.value = withDelay(
      LOGO.delay,
      withSequence(
        withTiming(1, { duration: LOGO.fadeIn }),
        withTiming(0, { duration: LOGO.travel - LOGO.fadeIn }),
      ),
    );
    // LINEAR, and it matters: the mark is meant to be receding at a constant
    // rate, and any ease reads as it slowing down in mid-air.
    logoScale.value = withDelay(
      LOGO.delay,
      withTiming(LOGO_SCALE.to, {
        duration: LOGO.travel,
        easing: Easing.linear,
      }),
    );
  }, [introOpacity, logoOpacity, logoScale, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || rollHeight <= 0) return;

    // The plane travels its own height, PLUS a screen to bring the first line
    // up from the bottom edge, PLUS the clearance below — without which the
    // roll stops with its last lines still hanging near the horizon, and the
    // closing card fades up underneath them.
    const distance = rollHeight + screenHeight * (1 + HORIZON_CLEARANCE);
    const duration = (distance / CRAWL_SPEED) * 1000;

    // BOTH RESET FIRST. This effect re-runs whenever the roll is re-measured —
    // a rotation, a Dynamic Type change — and without the reset the end card
    // stays at whatever opacity the previous run left it, which is 1 if that
    // run had finished. `withDelay` holds the CURRENT value through its delay,
    // so a stale 1 means the closing card sits on top of a restarting crawl.
    outroOpacity.value = 0;
    crawlY.value = screenHeight;
    crawlY.value = withDelay(
      CRAWL_DELAY,
      withTiming(-rollHeight - screenHeight * HORIZON_CLEARANCE, {
        duration,
        easing: Easing.linear,
      }),
    );

    outroOpacity.value = withDelay(
      CRAWL_DELAY + duration,
      withTiming(1, { duration: OUTRO_FADE }),
    );
  }, [crawlY, outroOpacity, reduceMotion, rollHeight, screenHeight]);

  const introStyle = useAnimatedStyle(() => ({ opacity: introOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const crawlStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: crawlY.value }],
  }));
  const outroStyle = useAnimatedStyle(() => ({ opacity: outroOpacity.value }));

  /**
   * REDUCE MOTION LANDS ON THE SAME PLACE THE SKELETONS DO — the effect goes,
   * the content stays, and nothing is left to a timer the person cannot
   * control. A crawl is the one animation here that is not decoration but the
   * delivery mechanism, so switching it off has to hand the roll over in a
   * form that can simply be read: flat type, no tilt, scrolled by hand.
   */
  if (reduceMotion) {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[
            styles.staticContent,
            {
              paddingTop: insets.top + NAV_BAR_HEIGHT + spacing.xl,
              paddingBottom: insets.bottom + spacing.xxxl,
            },
          ]}
          // Never hidden: the indicator is how a person knows how much roll is
          // left, and this family does not hide them (accessibility).
          showsVerticalScrollIndicator
        >
          <OpeningMark appName={appName} logo={logo} />
          <Text style={styles.intro}>{intro}</Text>
          <RollBody
            roles={roles}
            builtWithTitle={builtWithTitle}
            builtWith={builtWith}
          />
          <Text style={styles.outro}>{outro}</Text>
          <Text style={styles.byline}>{AUTHOR_CREDIT}</Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* THE PLANE — see `PLANE` for why it rotates about its own centre. */}
      <View style={styles.plane}>
        <Animated.View style={[styles.crawl, crawlStyle]}>
          <View onLayout={measureRoll}>
            {/* No outro here: it is the END CARD's line, and putting it on the
                plane as well made the roll say its last words twice, three
                seconds apart. */}
            <RollBody
              roles={roles}
              builtWithTitle={builtWithTitle}
              builtWith={builtWith}
            />
          </View>
        </Animated.View>
      </View>

      {/* THE HORIZON. The plane's own far edge is a hard line of type that
          simply stops; this dissolves it into the ground so the text reads as
          receding into distance. Drawn in SVG because a gradient is not
          something RN styles can express, and this package already depends on
          react-native-svg for the brand tile. */}
      <View
        style={[styles.horizon, { height: screenHeight * HORIZON }]}
        pointerEvents="none"
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="horizon" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={GROUND} stopOpacity="1" />
              <Stop offset="0.55" stopColor={GROUND} stopOpacity="0.85" />
              <Stop offset="1" stopColor={GROUND} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#horizon)" />
        </Svg>
      </View>

      {/* The two opening beats and the closing card all sit in the same centred
          box, layered over the plane — they are what the screen shows before
          and after the roll, never beside it. */}
      <View style={styles.stage} pointerEvents="none">
        <Animated.Text style={[styles.intro, introStyle]}>
          {intro}
        </Animated.Text>
        <Animated.View style={[styles.logoStage, logoStyle]}>
          <OpeningMark appName={appName} logo={logo} />
        </Animated.View>
        <Animated.View style={[styles.outroStage, outroStyle]}>
          <Text style={styles.outro}>{outro}</Text>
          <Text style={styles.byline}>{AUTHOR_CREDIT}</Text>
        </Animated.View>
      </View>
    </View>
  );
};

/** The roll's column, as a fraction of the screen's width. Narrow on purpose:
 *  the plane widens everything toward the viewer, so a full-width column
 *  overshoots the screen by the time it reaches the bottom. */
const COLUMN = '72%' as const;

/** `StyleSheet.absoluteFill` is a registered style ID, not an object, so it
 *  cannot be spread alongside other rules — this is the spreadable form. */
const ABSOLUTE_FILL = {
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
} as const;

const styles = StyleSheet.create({
  root: { backgroundColor: GROUND, flex: 1, overflow: 'hidden' },

  plane: {
    ...ABSOLUTE_FILL,
    alignItems: 'center',
    justifyContent: 'flex-end',
    transform: [{ perspective: PLANE.perspective }, { rotateX: PLANE.rotateX }],
  },
  crawl: { alignItems: 'center', width: COLUMN },

  horizon: { left: 0, position: 'absolute', right: 0, top: 0 },

  stage: {
    ...ABSOLUTE_FILL,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoStage: {
    ...ABSOLUTE_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outroStage: {
    ...ABSOLUTE_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  markCard: { alignItems: 'center', gap: spacing.lg },
  markName: {
    color: INK,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  intro: {
    color: INK,
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 30,
    opacity: 0.9,
    textAlign: 'center',
  },

  block: { alignItems: 'center', marginBottom: spacing.xxxl },
  role: {
    color: INK,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    opacity: MUTED_OPACITY,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  name: {
    color: INK,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 42,
    textAlign: 'center',
  },

  outro: {
    color: INK,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 34,
    textAlign: 'center',
  },
  byline: {
    color: INK,
    fontSize: 15,
    fontWeight: '500',
    marginTop: spacing.lg,
    opacity: MUTED_OPACITY,
  },

  // Vertical padding is applied at the call site — it depends on the device's
  // own insets and on the transparent bar above (see `NAV_BAR_HEIGHT`).
  staticContent: {
    alignItems: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
});
