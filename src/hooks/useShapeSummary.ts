import { useI18n } from '@/i18n';
import { rateLabel } from '@/lib/player';
import { usePlayerStore } from '@/store/player';
import { useShaperStore } from '@/store/shaper';

/**
 * THE SHAPE CARD'S SUMMARY — one hook, two surfaces (the console's glass bar
 * and the clip editor's Shape card), because a summary re-derived per surface
 * is how "Flat · 1×" comes back on one of them.
 *
 * IT STATES WHAT IS NOT DEFAULT, AND NOTHING ELSE — Apple writes the
 * exception and leaves the default silent (Settings: "Ringtone: None"). The
 * preset is dropped when Flat, the rate when 1×, the pitch note when pitch is
 * preserved, and it is silent at 1× at either setting (the engine passes
 * audio through untouched there). All defaults → "None", the Clips card's own
 * word for the same idea. The full history lives where it was written,
 * against the console's bar in `PlayerSheet`'s git log.
 *
 * THE TERMS RUN IN THE SHAPE SHEET'S OWN ORDER — preset, speed, pitch, echo,
 * room — so the summary reads as a walk down the controls that produced it, and
 * adding one never re-orders the terms already there. That is also why Next
 * Room is last despite being the most audible of them: the alternative is a
 * summary whose word order depends on which options are active.
 *
 * IT IS A LIST OF NAMES, SO IT IS TITLE CASE — the preset terms beside these
 * always were ("Bright", "Flat"), and for a while the rest were not, so the bar
 * read "Bright · 1.25× · pitch off · echo · next room" (Juan caught it,
 * 2026-09-17). `pitchOff` was the original lowercase one and the two added on
 * 2026-09-16 copied it; all three are title case now. Spanish takes a capital
 * on the FIRST WORD ONLY, per the voice rule — it never title-cases.
 *
 * ECHO AND NEXT ROOM READ THEIR OWN CONTROL LABELS rather than carrying a
 * second copy of the same word. `shape.echo` and `shape.nextRoom` were exactly
 * `player.echo` and `player.nextRoom` in all three languages, which is a term
 * with two homes and two chances to drift. `pitchOff` keeps its own key because
 * it has no label twin: the control is "Preserve Pitch" and the summary states
 * the OPPOSITE state.
 */
export function useShapeSummary(): string {
  const { t, locale } = useI18n();
  const activePreset = useShaperStore(s => s.activePreset);
  const rate = usePlayerStore(s => s.rate);
  const keepPitch = usePlayerStore(s => s.keepPitch);
  const nextRoom = useShaperStore(s => s.nextRoom);
  const echo = useShaperStore(s => s.echo);

  const presetSummary = (() => {
    switch (activePreset) {
      case 'flat':
        return t('player.eq.presets.flat');
      case 'bass':
        return t('player.eq.presets.bass');
      case 'vocal':
        return t('player.eq.presets.vocal');
      case 'treble':
        return t('player.eq.presets.treble');
      case 'warm':
        return t('player.eq.presets.warm');
      case 'bright':
        return t('player.eq.presets.bright');
      default:
        return t('player.shape.custom');
    }
  })();

  return (
    [
      activePreset === 'flat' ? null : presetSummary,
      rate === 1 ? null : rateLabel(rate, locale),
      rate === 1 || keepPitch ? null : t('player.shape.pitchOff'),
      echo ? t('player.echo') : null,
      nextRoom ? t('player.nextRoom') : null,
    ]
      .filter(Boolean)
      .join(' · ') || t('player.shape.none')
  );
}
