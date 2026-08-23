import { useState } from 'react';

import { type StyleProp, type TextStyle } from 'react-native';

import {
  runOnJS,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { formatTime } from '@/lib/player';

// THE RANGE READOUT, LIVE — the one number that has to move WHILE the finger
// is down.
//
// It used to be rendered from `clipRange` React state, which only lands when
// a drag COMMITS, so the range read "1:24 – 1:39" for the entire drag and
// jumped to its new value on release. That makes the trimmer guesswork: you
// cannot land a clip on 1:40 – 2:00 if the only feedback arrives after you
// let go (Juan, 2026-08-23).
//
// IT IS ITS OWN LEAF FOR THE REASON `PlayerScrubberLive` IS — the console's
// standing rule (see `chrome.ts`) is that a value which changes many times a
// second is read at the leaf that DRAWS it, never passed down through the
// console, or every tick re-renders the whole tree. A trim drag is exactly
// that case, at gesture rate rather than the transport's 10Hz. The frame
// writes its edges to shared values on the UI thread; this leaf reacts to
// them and re-renders ONE `Text`.
//
// IT REACTS ON WHOLE SECONDS, which is not a throttle — it is what the label
// SAYS. The drag is continuous but the readout is `m:ss` and the commit
// rounds to whole seconds, so reacting to the rounded value both cuts the
// re-renders to the frames where the string actually changes AND guarantees
// the number you watch land is the number that gets saved.
//
// IT TAKES THE ELAPSED/TOTAL LABELS' OWN STYLE OBJECT, for the TABULAR
// FIGURES. SF's proportional digits are not the same width — a `1` is
// narrower than a `2` — so a CENTRED readout re-centres itself every time a
// digit changes, and this one changes several times a second under a drag.
// It shipped without them (Juan, 2026-08-23: "2:33 is bigger in width than
// 1:11... a CLEAR CLS"), which is the same defect the elapsed label was
// fixed for and the same trap AGENTS.md names: a term added after a surface
// exists never retrofits itself. Passing the STYLE rather than re-declaring
// `fontVariant` is deliberate — one object, so the two can never drift.

type ClipRangeLabelIosProps = {
  startSv: SharedValue<number>;
  endSv: SharedValue<number>;
  /**
   * The elapsed/total labels' OWN style object, handed down rather than
   * re-declared — this readout needs their tabular figures for the same
   * reason they do, and harder. See the note above.
   */
  style?: StyleProp<TextStyle>;
};

export function ClipRangeLabelIos({
  startSv,
  endSv,
  style,
}: ClipRangeLabelIosProps) {
  // Seeded FROM the shared values, not from a committed prop: the console
  // syncs them to the committed range, so they are already correct on the
  // first frame and there is no second source of the same number.
  const [range, setRange] = useState(() => ({
    endS: Math.round(endSv.value),
    startS: Math.round(startSv.value),
  }));

  useAnimatedReaction(
    () => ({
      endS: Math.round(endSv.value),
      startS: Math.round(startSv.value),
    }),
    (current, previous) => {
      if (
        previous &&
        current.startS === previous.startS &&
        current.endS === previous.endS
      ) {
        return;
      }
      runOnJS(setRange)(current);
    },
  );

  return (
    <Text
      doNotTranslate
      style={style}
      text={`${formatTime(range.startS)} – ${formatTime(range.endS)}`}
      variant="labelMedium"
    />
  );
}
