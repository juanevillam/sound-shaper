import { useSyncExternalStore } from 'react';

import { type StyleProp, type ViewStyle } from 'react-native';

import { artworkRadius, type IconName } from '@portfolio/mobile-ui';
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
// (`PlayerScrubber`, and the two consoles).
//
// These live in their OWN module rather than in each component's base file on
// purpose: from inside `Foo.ios.tsx`, an import of `./Foo` resolves back to
// `Foo.ios.tsx` — Metro prefers the platform extension — so the file imports
// itself. Types survive that (they are erased), but any shared VALUE comes
// back `undefined`. A neutral module has no platform variant to collide with.

/**
 * The scrubber's box. It was 32 while this was a SwiftUI `Slider`, because a
 * thumb slider needs room for its 36.67pt knob — and that knob was also what
 * filled the space between the track and the time labels. Apple's media
 * scrubber has no knob, so the same 32 left the labels stranded ~28pt below an
 * 8pt bar (Juan, 2026-08-25). The box is now the bar plus a little air; the
 * TOUCH target is restored by hit slop on the gesture rather than by padding
 * the layout, so the bar can sit close to its labels without becoming hard to
 * catch.
 * It lives HERE rather than in
 * `PlayerScrubber.ios.tsx` because the console centres the trim frame on it,
 * and a VALUE imported from a platform-suffixed file resolves back to that
 * same file from inside it — the self-import trap this module exists to
 * avoid. The full story of why the host both states this box AND ignores the
 * safe area is at the top of `PlayerScrubber.ios.tsx`.
 */
export const IOS_SLIDER_HOST_HEIGHT = 18;

/**
 * WHERE THE TRACK'S INK ACTUALLY IS, measured — the media scrubber does not
 * centre its bar in the host. Band-scanned in framing mode (iPhone 17 /
 * iOS 26.5): the track spans host 0.2 → 7.9, centre 4.0, against the 18pt
 * box's geometric centre of 9. A trim frame centred on the HOST therefore
 * sat 5pt low against the track it brackets, which Juan read on sight
 * (2026-08-25). Anything that must align with the BAR — the trim frame is
 * today's one caller — centres on this, not on the host's half-height.
 */
export const IOS_SLIDER_TRACK_CENTER = 4;

/**
 * THE iOS TRANSPORT'S GEOMETRY — one term, TWO surfaces since the clip
 * editor gained its own transport row (2026-08-26): the expanded console and
 * the editor must feel like one app's controls, not two apps'. Play carries
 * hierarchy with SIZE, not a fill; the sizes are SF point sizes and the full
 * reasoning (including the 2026-08-25 growth from 30/44) lives where it was
 * measured, in `PlayerConsole.ios.tsx`'s history. GEOMETRY, so it scales
 * with its box rather than stepping a type ladder — a symbol has no Dynamic
 * Type ramp to break.
 */
export const TRANSPORT_SKIP_SIZE = 34;
export const TRANSPORT_PLAY_SIZE = 52;
/** Between the boxes, so the three read as one group rather than a spread row. */
export const TRANSPORT_GAP = 34;

/**
 * The box a transport glyph's Host reserves, as a multiple of its POINT SIZE —
 * `TransportGlyphs.ios`'s ratio, moved here the day the row's HEIGHT became a
 * shared term too (see `TRANSPORT_ROW_HEIGHT`). The full reasoning — why a
 * ratio, why 1.45 — stays with the glyphs.
 */
export const TRANSPORT_GLYPH_BOX_RATIO = 1.45;

/**
 * A transport ROW's height — its tallest child, the play glyph's box. The clip
 * editor needs it on the LAYOUT PATH (below), so it cannot be an onLayout
 * answer: a row that reports its height a frame late moves the very control
 * this anchoring exists to hold still.
 */
export const TRANSPORT_ROW_HEIGHT = Math.round(
  TRANSPORT_PLAY_SIZE * TRANSPORT_GLYPH_BOX_RATIO,
);

/* -------------------------------------------------------------------------- */
/*  THE TRANSPORT ANCHOR — one play button, two surfaces, ZERO shift          */
/* -------------------------------------------------------------------------- */
/**
 * The clip editor's play/pause must stand in EXACTLY the spot the expanded
 * player's does — same screen point, no CLS between the two surfaces (Juan,
 * 2026-08-26). The console's transport Y cannot be stated statically: it sits
 * between two flexible spacers, below a title block whose height is font
 * metrics. So the console MEASURES it — `measureInWindow` on its transport
 * row, fired by the sheet when the expand spring settles (a mid-flight
 * measurement would bake the transform into the anchor) — and the editor
 * reads the anchor to pin its own row from the SCREEN BOTTOM, the one edge
 * both surfaces share whatever the sheet's top offset is.
 *
 * A module-level store, not context: the console and the editor live in
 * different navigation trees (the editor is its own sheet route), and the
 * value is one number with one writer. The editor is only reachable THROUGH
 * the expanded player, so the anchor is always set before it is read; the
 * `null` fallback keeps the editor standing if that invariant ever breaks.
 */
let transportAnchorY: number | null = null;
let transportMeasurer: (() => void) | null = null;
const transportAnchorListeners = new Set<() => void>();

export function registerPlayerTransportMeasurer(fn: (() => void) | null) {
  transportMeasurer = fn;
}

/** Called by the sheet when the expand settles; no-op until a console registers. */
export function measurePlayerTransport() {
  transportMeasurer?.();
}

export function setPlayerTransportAnchor(y: number) {
  if (y === transportAnchorY) return;
  transportAnchorY = y;
  transportAnchorListeners.forEach(l => l());
}

const subscribeTransportAnchor = (l: () => void) => {
  transportAnchorListeners.add(l);
  return () => transportAnchorListeners.delete(l);
};
const readTransportAnchor = () => transportAnchorY;

export function usePlayerTransportAnchor(): number | null {
  return useSyncExternalStore(subscribeTransportAnchor, readTransportAnchor);
}

export type PlayerScrubberProps = {
  /** Optical nudge for the elapsed/total TEXT; the track keeps the real edge. */
  copyInset?: number;
  /** Displayed playhead — the drag-local value while the thumb is held. */
  position: number;
  /** Slider range max; always > 0 so the track is never degenerate. */
  duration: number;
  /** The real track length, for the right-hand label. */
  totalDuration: number;
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
 * that has nothing to do with either platform's look. The copy would rot and
 * every fix would need landing twice — the re-implementation trap AGENTS.md
 * names.
 */
export type PlayerConsoleProps = {
  /** The console's top edge, in container space — below the artwork. */
  contentTop: number;
  /** Opacity/arrival of the whole console, driven by `progress`. */
  consoleStyle: AnimatedViewStyle;
  /** True once the sheet is open — gates the neighbours and the gestures. */
  expanded: boolean;

  /* The sound. */
  soundId: string;
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

  /* Scrubber.
   *
   * NO PLAYHEAD CROSSES THIS BOUNDARY. The transport ticks position ten times
   * a second, and passing it through the console meant that tick re-rendered
   * the sheet, the console and every one of their children to move a thumb.
   * `PlayerScrubberLive` reads it from the store at the leaf that draws it and
   * owns the drag-local value with it, so all the console owes is somewhere to
   * commit a finished scrub. */
  onSeek: (seconds: number) => void;

  /* The two studios, and the bar's third compartment. */
  cards: readonly PlayerCard[];
  onCollapse: () => void;
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
 * ONE CONTENT BOX, and the artwork is simply as wide as it — BOTH PLATFORMS
 * since 2026-09-08 (Juan: bring Android's console to the iOS result).
 *
 * The console's title, scrubber, transport and footer all run to the same two
 * edges, and the artwork lines up with them rather than being a separately
 * chosen fraction. That is a rule instead of a number, which is the whole
 * point — the previous 0.58-of-width was a fraction with nothing under it, and
 * it left 164pt of dead screen below the console (band-scanned: content ended
 * at 676 on an 874pt screen). Android carried that same fraction (a moderate
 * square capped at 260dp) for as long as its console was the old Material
 * screen; the fraction went with the screen.
 *
 * The inset is the app's own screen gutter — also the collapsed banner's, so
 * the surface's edges never move as it expands.
 */
export const PLAYER_SIDE_PADDING = SCREEN_PADDING;

export const playerArtSize = (winW: number): number =>
  winW - PLAYER_SIDE_PADDING * 2;

/**
 * Where the artwork's top edge sits, below the screen's top inset.
 *
 * iOS CLEARS NOTHING. It used to clear a 43pt BAR ROW — `chevron.down` leading,
 * an overflow `Menu` trailing — and that row is gone (Juan, 2026-08-21): a
 * personal player has no bar's worth of work to put in one, the drag already
 * puts the player away, and the two glyphs floating over the wash were the
 * busiest thing on an otherwise calm screen. Deleting it hands 43pt back to the
 * column, which is where the transport and the footer wanted it.
 *
 * The gap that remains is the cover's own breathing room under the notch. It
 * was 24 — sized as if it were still standing in for the removed bar row —
 * and Juan asked for the sound to sit closer to the Dynamic Island
 * (2026-08-25), which it can: nothing shares that band, so the only job left
 * is to keep the cover off the island's own shadow.
 *
 * A grabber was tried in this slot before the bar row and rejected on sight:
 * this surface has a bottom sheet's dismiss GESTURE but is not a sheet, and a
 * grabber is UIKit's promise that it is one.
 *
 * `PLAYER_BAR_TARGET` (43, the portfolio's bar-glyph target) used to be
 * exported from here for that row. Nothing states it any more — the row is
 * gone and the console's only glyph-only control is a compartment of the glass
 * bar, which takes the bar's geometry rather than a bar item's.
 */
const ART_TOP_GAP = 12;

export const playerArtTop = (topInset: number): number =>
  topInset + ART_TOP_GAP;

/** The gap between the artwork's bottom edge and the console's first line. */
const ART_TO_CONSOLE = 28;

export const playerConsoleTop = (artTop: number, artSize: number): number =>
  artTop + artSize + ART_TO_CONSOLE;

/**
 * The cover's corner — a RATIO of the cover, never a container constant. The
 * sheet places the artwork and the console captions it, so both need this and
 * neither may derive it: `PlayerSheet` interpolates it as the shared element
 * travels, and `PlayerConsole.ios` feeds it to `opticalTextInset`.
 */
export const playerArtRadius = (winW: number, androidStep: number): number =>
  artworkRadius(playerArtSize(winW), androidStep);
