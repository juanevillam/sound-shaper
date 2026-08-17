import { StyleSheet, View } from 'react-native';

import {
  Button,
  Form,
  Host,
  HStack,
  Image,
  ProgressView,
  RNHostView,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  headerProminence,
  redacted,
  scrollContentBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { FormDisclosureIndicatorIos } from '@portfolio/mobile-ui';

import { tierColor } from './tierColors';
import {
  type TrophiesScreenProps,
  type TrophiesScreenColors,
  type TrophiesScreenStrings,
} from './TrophiesScreen';
import { TrophyIcon } from './TrophyIcon';
import { type ResolvedTrophy } from './types';

/**
 * iOS counterpart of `TrophiesScreen` — same prop API. The trophy list is a
 * REAL SwiftUI inset-grouped `Form` (the exact chrome the shared Settings
 * screen uses: system cell background, separators, radius, press highlight).
 * The trophy glyph (react-native-svg) bridges into each row via RNHostView.
 *
 * THE PROGRESS SUMMARY IS THE SECTION'S OWN HEADER, and that is what makes this
 * screen one scroller instead of two stacked boxes. It was a plain RN block
 * ABOVE the Form, which cost the sheet its bar: pinned chrome over a scroller
 * slides under a transparent nav bar, so the route had to carry
 * `pinnedHeader` — an OPAQUE bar, no scroll-edge effect, and a title that could
 * not collapse, on the one sheet in the account family that behaved that way.
 * Inside the Form, UIKit tracks the scroll again and the bar is Liquid Glass
 * like every other sheet's.
 *
 * IT IS NOT THE CARD THAT WAS REJECTED. Boxing the summary as its own one-row
 * `Section` read as a stray pill that broke the page flow (user-flagged, and
 * still true). A grouped section HEADER is the other thing entirely: it sits ON
 * the grouped background, at the section inset, with no fill and no radius —
 * which is exactly where the RN block was drawing, minus the pinning.
 * `headerProminence('increased')` is what keeps it a real sentence: a standard
 * grouped header is uppercased caption, and "7 of 7 earned" is a status line,
 * not a category label.
 *
 * THE BAR IS APPLE'S. `ProgressView(value:)` replaced a hand-painted track View
 * with a fill View inside it — which was `UIProgressView` redrawn by hand, the
 * same mistake the edit sheets and the verified badge each paid for once. It
 * takes the Form's `tint`, the system's own height and radius, and Dynamic Type
 * with everything else.
 */
const ICON_SIZE = 26;
const ICON_SLOT = 34;

const TrophyRow = ({
  trophy,
  colors,
  strings,
  formatDate,
  loading,
  onPress,
}: {
  trophy: ResolvedTrophy;
  colors: TrophiesScreenColors;
  strings: TrophiesScreenStrings;
  formatDate: (achievedAt: number) => string;
  loading: boolean;
  onPress?: () => void;
}) => {
  const tierName = strings.tierNames[trophy.tier];

  const supporting = trophy.unlocked
    ? `${tierName} · ${strings.achievedLabel} ${formatDate(trophy.achievedAt ?? 0)}`
    : `${tierName} · ${trophy.description}`;

  const iconColor = trophy.unlocked
    ? tierColor(trophy.tier)
    : colors.onSurfaceMuted;

  return (
    <Button onPress={onPress}>
      <HStack spacing={12}>
        {/* A SwiftUI symbol WHILE LOADING, the RN glyph once the state is real.
            Redaction cannot reach inside an `RNHostView` — the trophy is a UIKit
            view by then — so the bridged icon kept its TIER COLOUR under the
            placeholder and went on saying which trophies were earned, which is
            the one thing the placeholder is there to not say. (And in the real
            pre-hydration case it says something worse: every trophy grey,
            because nothing has loaded yet.) A native `Image` redacts to a shape
            for free, at the same size in the same slot. */}
        {loading ? (
          <Image
            systemName="trophy.fill"
            size={ICON_SIZE}
            color={colors.onSurfaceMuted}
            // FRAMED TO THE SLOT, not left at the glyph's own 26pt: the RN
            // trophy is centred in a 34pt box, so an unframed symbol handed the
            // text column ~5pt back and every title moved sideways on hand-off.
            // Measured on iPhone 17 / iOS 26.5, first row's title ink:
            // 78.67pt loaded vs 74.67pt redacted.
            modifiers={[frame({ width: ICON_SLOT })]}
          />
        ) : (
          <RNHostView matchContents>
            <View style={styles.iconSlot}>
              <TrophyIcon
                color={iconColor}
                size={ICON_SIZE}
                locked={!trophy.unlocked}
              />
            </View>
          </RNHostView>
        )}
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              foregroundStyle(
                trophy.unlocked ? colors.onSurface : colors.onSurfaceMuted,
              ),
            ]}
          >
            {trophy.title}
          </Text>
          <Text
            modifiers={[
              font({ textStyle: 'footnote' }),
              foregroundStyle(colors.onSurfaceMuted),
            ]}
          >
            {supporting}
          </Text>
        </VStack>
        <Spacer />
        {/* The one chevron definition the portfolio has — the same glyph the
            account sheet's own rows draw, rather than a local size constant
            that can drift a point away from them. */}
        <FormDisclosureIndicatorIos color={colors.onSurfaceMuted} />
      </HStack>
    </Button>
  );
};

export const TrophiesScreen = ({
  trophies,
  earned,
  total,
  colors,
  strings,
  formatDate,
  loading = false,
  onTrophyPress,
}: TrophiesScreenProps) => {
  const fraction = total > 0 ? earned / total : 0;

  return (
    <Host style={styles.host}>
      <Form
        modifiers={[
          scrollContentBackground('hidden'),
          tint(colors.primary),
          // One redaction for the WHOLE screen, header included: the summary is
          // derived from the same un-hydrated cache the rows are, so redacting
          // the list while the count above it reads "0 of 7" would just move
          // the wrong answer up a line.
          ...(loading ? [redacted('placeholder')] : []),
        ]}
      >
        <Section
          modifiers={[headerProminence('increased')]}
          header={
            <VStack alignment="leading" spacing={8}>
              {/* `lastTextBaseline`, so the tinted percent sits on the same
                  line as the progress sentence rather than centring against
                  it — the two are set at different sizes. */}
              <HStack alignment="lastTextBaseline">
                <Text
                  modifiers={[
                    font({ textStyle: 'headline' }),
                    foregroundStyle(colors.onSurface),
                  ]}
                >
                  {strings.progress}
                </Text>
                <Spacer />
                <Text
                  modifiers={[
                    font({ textStyle: 'subheadline', weight: 'semibold' }),
                    foregroundStyle(colors.primary),
                  ]}
                >
                  {strings.percent}
                </Text>
              </HStack>
              {/* EMPTY TRACK WHILE LOADING. `redacted` does not touch a
                  `ProgressView` — verified on iPhone 17 / iOS 26.5, where the
                  bar stayed full and blue under a header whose own label was
                  already a placeholder bar, i.e. the screen claimed 100%
                  beside text that admitted it knew nothing. An empty track
                  next to a redacted percent reads as "not known yet" rather
                  than "zero", and it stays STATIC, which is the placeholder
                  language the rest of the card is in (an indeterminate
                  `value={null}` bar would animate alone on a still screen). */}
              <ProgressView value={loading ? 0 : fraction} />
            </VStack>
          }
        >
          {trophies.map(trophy => (
            <TrophyRow
              key={trophy.id}
              trophy={trophy}
              colors={colors}
              strings={strings}
              formatDate={formatDate}
              loading={loading}
              onPress={
                onTrophyPress ? () => onTrophyPress(trophy.id) : undefined
              }
            />
          ))}
        </Section>
      </Form>
    </Host>
  );
};

const styles = StyleSheet.create({
  host: { flex: 1 },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: ICON_SLOT,
  },
});
