import { type StyleProp, type ViewStyle, Platform } from 'react-native';

import { type IconName } from '@portfolio/mobile-ui';
import {
  type ComposedGesture,
  type GestureType,
} from 'react-native-gesture-handler';
import { type AnimatedStyle } from 'react-native-reanimated';

import { SCREEN_PADDING } from '@/styles/metrics';

/** A style produced by `useAnimatedStyle` and handed down to a twin. */
type AnimatedViewStyle = StyleProp<AnimatedStyle<ViewStyle>>;

/** Either half of a `Gesture.Race` — the sheet composes, the twin attaches. */
type AnyGesture = ComposedGesture | GestureType;

// Shared contracts for the player-console pieces that have platform twins
// (`PlayerScrubber`, `PlayerCards`, `PlayerMenuButton`, `ClipActionsRow`,
// `ClipHandles`).
//
// These live in their OWN module rather than in each component's base file on
// purpose: from inside `Foo.ios.tsx`, an import of `./Foo` resolves back to
// `Foo.ios.tsx` — Metro prefers the platform extension — so the file imports
// itself. Types survive that (they are erased), but any shared VALUE comes
// back `undefined`. A neutral module has no platform variant to collide with.

/**
 * Fixed height of the Shape/Clips card row. Android keeps the M3 two-line
 * card it shipped with; iOS runs shorter — the content is one title over one
 * caption, and an iOS list-style tile hugs that instead of padding it out.
 */
export const CARDS_HEIGHT = Platform.select({ ios: 76, default: 96 }) as number;

/** Fixed height of the clip-framing action row that replaces the cards. */
export const CLIP_ACTIONS_HEIGHT = 56;

/**
 * Extra room under the scrubber WHILE FRAMING A CLIP only. Framing adds a
 * third line (the range) under the elapsed/total pair, which without this
 * crowds straight into the play button. The default player keeps its original
 * tight column — there is no third line to make room for. iOS gets more: SF's
 * shorter labels leave less optical air of their own.
 */
export const CLIP_FRAMING_GAP = Platform.select({
  ios: 16,
  default: 8,
}) as number;

/**
 * Height of the band the trim brackets ride in, laid over the scrubber's top
 * edge. It must not reach the elapsed/total label row below — on iOS the
 * SwiftUI slider host is 32pt, so the band matches it exactly.
 */
export const HANDLES_REGION_HEIGHT = Platform.select({
  ios: 32,
  default: 44,
}) as number;

export type PlayerScrubberProps = {
  /** Displayed playhead — the drag-local value while the thumb is held. */
  position: number;
  /** Slider range max; always > 0 so the track is never degenerate. */
  duration: number;
  /** The real track length, for the right-hand label. */
  totalDuration: number;
  /** Centre label while framing a clip ("0:36 – 0:42"), else null. */
  clipLabel?: string | null;
  onDrag: (value: number) => void;
  onDragEnd: () => void;
};

export type PlayerCard = {
  icon: IconName;
  key: string;
  label: string;
  onPress: () => void;
  summary: string;
};

export type PlayerCardsProps = {
  cards: readonly PlayerCard[];
};

export type PlayerMenuButtonProps = {
  onInfo: () => void;
  onEdit: () => void;
};

export type ClipActionsRowProps = {
  onCancel: () => void;
  onPreview: () => void;
  onSave: () => void;
};

export type ClipHandlesProps = {
  durationS: number;
  startS: number;
  endS: number;
  onChange: (startS: number, endS: number) => void;
};

/**
 * THE EXPANDED CONSOLE'S CONTRACT — everything the console below the artwork
 * needs from `PlayerSheet`, and the reason this module exists at all.
 *
 * `PlayerSheet` owns the machinery both platforms genuinely share: one
 * `progress` shared value, the springs it rides, the drag/skip gesture graph,
 * the neighbour paging, and the ONE artwork element that travels between the
 * banner and the console. The CONSOLE is the only part where the two platforms
 * want different things — Android's is a Material column with a FAB and two
 * outlined cards, iOS's is not — so the console is the only part with a twin.
 *
 * A full `PlayerSheet.ios.tsx` was the obvious alternative and is the wrong
 * shape: only SEVEN of that file's 1751 lines are platform branches, so a twin
 * would copy ~700 lines of correct, frame-verified animation and gesture code
 * that has nothing to do with either platform's look. Android is frozen, so the
 * copy would rot silently and every fix would need landing twice — the
 * re-implementation trap AGENTS.md names.
 */
export type PlayerConsoleProps = {
  /** The console's top edge, in container space — below the artwork. */
  contentTop: number;
  /** Opacity/arrival of the whole console, driven by `progress`. */
  consoleStyle: AnimatedViewStyle;
  /** True once the sheet is open — gates the neighbours and the gestures. */
  expanded: boolean;

  /* The sound. */
  songId: string;
  title: string;
  /** Artist, or a single space so the line never collapses. */
  subtitle: string;
  /** Parked neighbours, for the swipe-to-skip pager. */
  neighbours: {
    previous: { artist: string; id: string; name: string } | null;
    next: { artist: string; id: string; name: string } | null;
  };
  /** Rides the neighbours' copy in step with their artwork. */
  pagerStyle: AnimatedViewStyle;
  /** Screen width — how far out the neighbours park. */
  winW: number;

  /* Transport. */
  playing: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;

  /* Scrubber. */
  position: number;
  duration: number;
  totalDuration: number;
  onScrub: (value: number) => void;
  onScrubEnd: () => void;

  /* Clip framing — the brackets and the action row that replaces the footer. */
  clipMode: boolean;
  clipRange: { startS: number; endS: number };
  trimmerDuration: number;
  onClipRangeChange: (startS: number, endS: number) => void;
  onClipCancel: () => void;
  onClipPreview: () => void;
  onClipSave: () => void;

  /* The two studios, and the overflow behind the title. */
  cards: readonly PlayerCard[];
  onCollapse: () => void;
  onInfo: () => void;
  onEdit: () => void;

  /* Gestures owned by the sheet — the console only attaches them. */
  topGesture: AnyGesture;
  titleGesture: AnyGesture;
};

// ---------------------------------------------------------------------------
// THE CONSOLE'S GEOMETRY — shared by `PlayerSheet` and both twins.
//
// It lives here because the sheet and the console each own half of it: the
// SHEET positions the artwork (it is the one element that travels between the
// banner and the console, so only the sheet can place it), and the CONSOLE
// lays out everything below. Two files deriving the same square independently
// is the skeleton bug one level up — so they import the same functions.
// ---------------------------------------------------------------------------

/**
 * iOS: ONE CONTENT BOX, and the artwork is simply as wide as it.
 *
 * The console's title, scrubber, transport and footer all run to the same two
 * edges, and the artwork lines up with them rather than being a separately
 * chosen fraction. That is a rule instead of a number, which is the whole
 * point — the previous 0.58-of-width was a fraction with nothing under it, and
 * it left 164pt of dead screen below the console (band-scanned: content ended
 * at 676 on an 874pt screen).
 *
 * ANDROID KEEPS ITS OWN, unchanged and frozen: a moderate square with the
 * Material console stacked under it.
 */
export const PLAYER_SIDE_PADDING = Platform.select({
  // The app's own screen gutter — also the collapsed banner's side inset, so
  // the surface's edges never move as it expands into a screen.
  ios: SCREEN_PADDING,
  default: 24,
}) as number;

export const playerArtSize = (winW: number): number =>
  Platform.OS === 'ios'
    ? winW - PLAYER_SIDE_PADDING * 2
    : Math.min(Math.round(winW * 0.58), 260);

/**
 * Where the artwork's top edge sits, below the screen's top inset.
 *
 * iOS clears the GRABBER rather than a header row: the console has no top bar
 * — the overflow moved to the title, where the thing it acts on is — so the
 * only chrome above the artwork is the sheet grabber, and this is the gap
 * under it.
 */
export const PLAYER_GRABBER_HEIGHT = 5;
const IOS_GRABBER_TOP = 8;
const IOS_ART_TOP_GAP = 20;

export const playerArtTop = (topInset: number): number =>
  Platform.OS === 'ios'
    ? topInset + IOS_GRABBER_TOP + PLAYER_GRABBER_HEIGHT + IOS_ART_TOP_GAP
    : topInset + 60;

/** The gap between the artwork's bottom edge and the console's first line. */
const ART_TO_CONSOLE = Platform.select({ ios: 28, default: 36 }) as number;

export const playerConsoleTop = (artTop: number, artSize: number): number =>
  artTop + artSize + ART_TO_CONSOLE;
