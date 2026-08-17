import { StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  Button,
  Form,
  Host,
  HStack,
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
  headerProminence,
  scrollContentBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { FormDisclosureIndicatorIos, SkeletonBone } from '@portfolio/mobile-ui';

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

/**
 * THE PROGRESS HEADER'S OWN GEOMETRY, for the ONE bridged host that stands it
 * while the award cache loads.
 *
 * The header is native `Text` + `ProgressView` once the counts are real — the
 * platform primitives, which is the whole reason the summary moved into the
 * `Section` in the first place. It cannot ALSO bone its two figures in place:
 * a bridged host per figure is a second and third `RNHostView` in one row, and
 * that blew the layout apart (titles clipped off the leading edge, the icon
 * slot gone, the header collapsed to a stub). One host per row is the ceiling.
 *
 * So the loading header is a SINGLE host holding the whole summary in RN — two
 * bones and a track — and every number here exists to land it exactly where the
 * native one sits. MEASURED off the live header (iPhone 17 / iOS 26.5, light):
 *
 *   header content box   x 32.0 → 370.0     (338 wide; the grouped header's
 *                                            inset is 32, not the card's 18)
 *   progress bar         y 180.33 → 184.33  (4pt tall)
 *   card top             y 194.33           (10 below the bar)
 *
 * Re-measure those three if the header's type or `headerProminence` changes.
 */
const HEADER_INSET = 32;
/**
 * The headline's line box — what the two figures sit in. SOLVED, not guessed:
 * at 22 the bar landed 182.0 against the native header's 180.33 and the card
 * followed it down by the same 1.67, so the box is that much smaller.
 */
const HEADER_LINE_BOX = 20.33;
/** The `VStack`'s own spacing between the figures and the bar. */
const HEADER_GAP = 8;
/** `ProgressView`'s linear track, measured at 180.33 → 184.33. */
const HEADER_BAR_HEIGHT = 4;

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
        {/* THE ICON IS THE ROW'S CLAIM, so while the award cache is loading it
            is a bone rather than a glyph: the tier COLOUR is what says a trophy
            is earned, and pre-hydration every one of them resolves locked — a
            column of grey trophies is a wrong answer, not a pending one. The
            bone rides in the same 34pt slot the real glyph is centred in, so
            the text column does not move on hand-off. */}
        <RNHostView matchContents>
          <View style={styles.iconSlot}>
            {loading ? (
              <SkeletonBone
                width={ICON_SIZE}
                height={ICON_SIZE}
                radius={ICON_SIZE / 2}
              />
            ) : (
              <TrophyIcon
                color={iconColor}
                size={ICON_SIZE}
                locked={!trophy.unlocked}
              />
            )}
          </View>
        </RNHostView>
        <VStack alignment="leading" spacing={2}>
          {/* THE TITLE IS REAL EVEN WHILE LOADING — it comes from the app's
              config and its own copy, not from the network, so there is nothing
              to wait for and boning it would only cost the row its true height.
              Its COLOUR does wait (an earned trophy's title is full-strength),
              so it holds at `onSurfaceMuted` until the state is known: the
              muted step is the one that claims nothing. */}
          <Text
            modifiers={[
              foregroundStyle(
                !loading && trophy.unlocked
                  ? colors.onSurface
                  : colors.onSurfaceMuted,
              ),
            ]}
          >
            {trophy.title}
          </Text>
          {/* THE SUPPORTING LINE STAYS REAL TEXT, and that is a limit rather
              than a preference: a SECOND `RNHostView` in this row blew the
              native layout apart — titles clipped off the leading edge, the
              icon slot gone, the card displaced (iPhone 17 / iOS 26.5). One
              bridged host per row is what this List sustains, and the icon has
              it. So the line shows the locked sentence while loading, which is
              also what it will say for most rows; the icon beside it is the
              bone that says the state is still coming. */}
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
  const { width: screenWidth } = useWindowDimensions();
  const headerWidth = screenWidth - HEADER_INSET * 2;

  return (
    <Host style={styles.host}>
      <Form
        modifiers={[scrollContentBackground('hidden'), tint(colors.primary)]}
      >
        <Section
          modifiers={[headerProminence('increased')]}
          header={
            loading ? (
              /**
               * ONE HOST for the whole summary — see the constants above for
               * why it is not two bones dropped into the native header, and
               * for the anchors this has to land on.
               */
              <RNHostView matchContents>
                <View style={[styles.headerBone, { width: headerWidth }]}>
                  <View style={styles.headerFigures}>
                    <SkeletonBone width={140} height={15} />
                    <SkeletonBone width={42} height={13} />
                  </View>
                  {/* The track, at the bar's own height — an empty
                      `ProgressView` and a bone of the same size read alike, and
                      this one sweeps with everything else on screen. */}
                  <SkeletonBone
                    width="100%"
                    height={HEADER_BAR_HEIGHT}
                    radius={HEADER_BAR_HEIGHT / 2}
                  />
                </View>
              </RNHostView>
            ) : (
              <VStack alignment="leading" spacing={HEADER_GAP}>
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
                <ProgressView value={fraction} />
              </VStack>
            )
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
  headerBone: { gap: HEADER_GAP },
  headerFigures: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    height: HEADER_LINE_BOX,
    justifyContent: 'space-between',
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: ICON_SLOT,
  },
});
