import { Alert } from 'react-native';

import { AUTHOR_FULL_NAME } from './author';
import { type CreditsRole } from './CreditsScreen';

type Translate = (key: string) => string;

/**
 * The AI that helped build these apps, credited by name and by name ONLY.
 * Deliberately no model: the work spans many of them over many months, so
 * naming one would be picking an arbitrary winner and would go stale by the
 * next release. "Claude" is the thing that is true across all of it.
 */
export const ASSISTANCE_CREDIT = 'Claude';

/**
 * The jobs, in the order a film would roll them: the making of the thing, then
 * the polish, then the help. Keys are a fixed convention
 * (`credits.roles.<key>`), the same way `buildGeneralSettingsSections` derives
 * its option labels — so an app supplies the translator and nothing else.
 */
const SOLO_ROLES = [
  'design',
  'development',
  'testing',
  'artDirection',
  'copy',
] as const;

/**
 * Every role in every portfolio app's credit roll.
 *
 * ONE PERSON HOLDS ALL OF THEM, which is the joke and also the fact — these are
 * one-man apps, and a roll that says so five times in a row is funnier and
 * truer than a roll that says it once. It lives here rather than in either app
 * so the two cannot drift into crediting different people for the same work.
 */
export const buildCreditsRoles = (t: Translate): CreditsRole[] => [
  ...SOLO_ROLES.map(key => ({
    role: t(`credits.roles.${key}`),
    names: [AUTHOR_FULL_NAME],
  })),
  { role: t('credits.roles.assistance'), names: [ASSISTANCE_CREDIT] },
];

/**
 * THE ONE-TIME OFFER — a native alert asking whether to watch the roll now,
 * fired the moment an app is finished (Topper's platinum, the starter's last
 * showcase).
 *
 * AN ALERT, not a snackbar and not an auto-play. Auto-playing a 45-second
 * cinematic over whatever the person was doing is the rude version of a reward;
 * a snackbar would put the offer somewhere it can time out and be missed. An
 * alert is what iOS uses to interrupt with a question, and this is a question.
 *
 * WATCH IS THE PREFERRED ACTION — the opposite of `confirmDestructiveIos`, and
 * for the same reason it bolds Cancel: Apple bolds the action the alert is FOR.
 * Nothing here is irreversible, so there is nothing to cool off from.
 */
export const offerCreditsIos = ({
  cancelLabel,
  confirmLabel,
  message,
  onConfirm,
  title,
}: {
  /** Already-translated (the package has no translator). */
  cancelLabel: string;
  confirmLabel: string;
  message: string;
  onConfirm: () => void;
  title: string;
}): void =>
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, isPreferred: true, onPress: onConfirm },
  ]);
