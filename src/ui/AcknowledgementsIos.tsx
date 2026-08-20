import React, { useMemo } from 'react';

import { ScrollView, StyleSheet, Text as RNText, View } from 'react-native';

import { Button, Host, List, Section } from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  listStyle,
  scrollContentBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { FormDisclosureRowIos } from './FormDisclosureRowIos';
import { SHEET_CONTENT_TOP } from './sheetMetrics';
import { spacing } from './tokens';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ACKNOWLEDGEMENTS — the open-source notices, Settings → Legal.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * "Acknowledgements" is Apple's word for this screen (it is what Xcode's own
 * generated settings bundle calls it), which is why it is not "Licenses" or
 * "Open Source" — see AGENTS.md → Voice.
 *
 * The data is `apps/<app>/src/generated/licenses.json`, produced by
 * `scripts/gen-licenses.mjs` from the packages Metro actually PUT IN THE
 * BUNDLE — not the dependency tree, which is six times larger and mostly build
 * tools the device never sees. That script's header explains the compliance
 * reasoning, why licences requiring nothing are left off, and why no version
 * numbers are carried; this file only has to render it.
 *
 * WHY THE TEXT PANE IS RN AND THE LIST IS NOT. The list is a real inset-grouped
 * SwiftUI `List` — the same container Settings, Explore's results and every
 * people sheet use — because a list of rows is exactly what the platform's own
 * control is for. The licence body is the opposite case: it is an unbounded
 * wall of pre-wrapped plain text, and a SwiftUI `Text` that long inside a
 * `Host` has to answer "how tall are you" on the layout path, which is the
 * `matchContents` trap this repo has now been bitten by three times. An RN
 * `ScrollView` measures text as a matter of course, so the body is plain RN and
 * the native kit keeps the part it is better at.
 */

export type LicensePackage = {
  /** Also the row's identity — the generator emits one entry per package, so a
   *  name is unique within a manifest. */
  name: string;
  /** SPDX id from the package's own manifest, e.g. `MIT`. */
  license: string;
  /** That package's own attribution lines, split out of its licence file. */
  copyright: string;
  homepage: string;
  /** Index into `LicenseManifest.bodies`, or -1 when it ships no licence file. */
  body: number;
};

export type LicenseManifest = {
  packages: LicensePackage[];
  bodies: string[];
};

export type AcknowledgementsColors = {
  onSurface: string;
  onSurfaceMuted: string;
  primary: string;
};

/**
 * A licence file is hard-wrapped to about 70 columns, and a phone column fits
 * roughly 45 — so every source line wraps a second time and the text arrives as
 * alternating long and stub lines, which is what it looked like on screen the
 * first time this shipped. This re-joins the lines of a paragraph so the column
 * does the wrapping once.
 *
 * IT CHANGES NO WORDS, and the guard is what keeps it that way. A paragraph is
 * only re-joined when it looks like hard-wrapped PROSE: two or more lines, none
 * of them indented, and every line but the last long enough to have been broken
 * by a wrap rather than by its author. That leaves alone the things whose line
 * breaks carry meaning — Apache-2.0's numbered clauses and indented appendix,
 * BSD's bulleted conditions, ASCII rules, a copyright block. Blank lines are
 * paragraph boundaries and always survive.
 *
 * The MANIFEST keeps the file verbatim either way; this is a display transform,
 * and the notice's words are what the licences ask to be reproduced.
 */
const WRAP_WIDTH = 45;

const unwrapParagraphs = (text: string): string =>
  text
    .split(/\n{2,}/)
    .map(paragraph => {
      const lines = paragraph.split('\n');
      const hardWrapped =
        lines.length > 1 &&
        lines.every(line => !/^[\s\t]/.test(line)) &&
        lines.slice(0, -1).every(line => line.trim().length >= WRAP_WIDTH);

      return hardWrapped ? lines.map(line => line.trim()).join(' ') : paragraph;
    })
    .join('\n\n');

/**
 * Re-join what the generator split apart: a package's own attribution lines,
 * then the terms it shares with every other package under the same licence.
 * The result is the licence file as it was published, which is what the
 * licences ask to be reproduced.
 */
export const licenseText = (
  manifest: LicenseManifest,
  entry: LicensePackage,
  /** Shown when a package ships no licence file at all — plenty publish only
   *  the SPDX id in their manifest. Already translated. */
  missingText: string,
): string => {
  const body = entry.body >= 0 ? manifest.bodies[entry.body] : '';
  const parts = [entry.copyright, body].filter(Boolean);

  return parts.length ? unwrapParagraphs(parts.join('\n\n')) : missingText;
};

export type AcknowledgementsListIosProps = {
  manifest: LicenseManifest;
  /** Section header over the whole list, already translated — it doubles as
   *  the sentence explaining what the list IS. */
  caption: string;
  onSelect: (entry: LicensePackage) => void;
  colors: AcknowledgementsColors;
};

export const AcknowledgementsListIos = ({
  manifest,
  caption,
  onSelect,
  colors,
}: AcknowledgementsListIosProps) => (
  <Host style={styles.host}>
    <List
      modifiers={[
        tint(colors.primary),
        // `insetGrouped` — the same container as Settings' own sections, which
        // is the screen this one is reached from.
        listStyle('insetGrouped'),
        // The sheet's colour is what surrounds the cards, exactly as it is for
        // every other list in this family.
        scrollContentBackground('hidden'),
      ]}
    >
      {/* One `Section`, and it carries the caption — unlike the people sheets,
          which take no header because the sheet's bar already names them. Here
          the bar says "Acknowledgements" and the header says what the list is
          FOR, which is a different sentence rather than the same one twice. */}
      <Section title={caption}>
        {manifest.packages.map(entry => (
          <Button
            key={entry.name}
            onPress={() => onSelect(entry)}
            // Without this the row's label inherits the control tint and reads
            // blue; navigation is neutral plus a chevron. See
            // `FormDisclosureRowIos`.
            modifiers={[foregroundStyle(colors.onSurface)]}
          >
            <FormDisclosureRowIos
              label={entry.name}
              value={entry.license}
              colors={colors}
            />
          </Button>
        ))}
      </Section>
    </List>
  </Host>
);

export type LicenseDetailIosProps = {
  entry: LicensePackage;
  manifest: LicenseManifest;
  /** Copy for a package that ships no licence file, already translated. */
  missingText: string;
  colors: AcknowledgementsColors;
};

/**
 * THE LEADING ABOVE A 13pt LINE'S CAP — the residual that stands the licence's
 * first line where every neighbouring sheet's first line stands.
 *
 * `SHEET_CONTENT_TOP` places a content BOX; the family's 84 was band-scanned off
 * the INK of Settings' section label. A text line's box begins above its cap by
 * its leading, so padding the box to 84 lands the ink at 87.33 — measured on
 * iPhone 17 / iOS 26.5, against a caption reading 84.33 on the Acknowledgements
 * sheet one level up. Solving backwards puts the box at 81.
 *
 * Re-measure if this line's size changes; it is the size that sets the leading.
 */
const INK_LEADING = 3;

export const LicenseDetailIos = ({
  entry,
  manifest,
  missingText,
  colors,
}: LicenseDetailIosProps) => {
  const text = useMemo(
    () => licenseText(manifest, entry, missingText),
    [entry, manifest, missingText],
  );

  return (
    <ScrollView
      contentContainerStyle={styles.detail}
      /**
       * `never`, so the caller's own top padding is the WHOLE answer for where
       * this text starts. `automatic` would ask UIKit for the bar's inset and
       * add it on top — an async answer on the layout path, which is the family
       * of bug this repo has been bitten by three times, and here it also
       * double-counts a clearance the sheet's `SHEET_CONTENT_TOP` already
       * states.
       */
      contentInsetAdjustmentBehavior="never"
      // Never hidden on iOS — a long legal text is precisely where a person
      // needs to see how much of it there is (accessibility).
      showsVerticalScrollIndicator
    >
      <View style={styles.detailHeader}>
        {/* The SPDX id alone. NO VERSION — a licence does not ask for one, and
            a published `name@version` table is what turns a package list into a
            ready-made CVE lookup. See the generator's header. */}
        <RNText style={[styles.license, { color: colors.onSurfaceMuted }]}>
          {entry.license}
        </RNText>
      </View>
      {/* The licence file, verbatim and pre-wrapped as its authors wrote it.
          Left-aligned and never justified: these texts carry their own hard
          line breaks, and re-flowing them is the one thing "reproduce the
          notice" does not allow. */}
      <RNText style={[styles.body, { color: colors.onSurface }]}>{text}</RNText>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  host: { flex: 1 },

  detail: {
    // The whole top clearance lives here, not at the call site: both apps
    // present this in the same sheet chrome, so there is one right answer and
    // no reason for either of them to be able to state a different one.
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    paddingTop: SHEET_CONTENT_TOP - INK_LEADING,
  },
  detailHeader: { marginBottom: spacing.lg },
  license: { fontSize: 13, fontWeight: '500' },
  // Footnote metrics: a licence is reference text, not reading copy, and this
  // is the size Apple's own Legal Notices sets it at.
  body: { fontSize: 13, lineHeight: 19 },
});
