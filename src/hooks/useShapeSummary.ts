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
 */
export function useShapeSummary(): string {
  const { t, locale } = useI18n();
  const activePreset = useShaperStore(s => s.activePreset);
  const rate = usePlayerStore(s => s.rate);
  const keepPitch = usePlayerStore(s => s.keepPitch);

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
    ]
      .filter(Boolean)
      .join(' · ') || t('player.shape.none')
  );
}
