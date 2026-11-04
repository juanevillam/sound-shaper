import { rateLabel, RATE_MAX, RATE_MIN, RATE_STEP } from '@app/lib/player';
import {
  EFFECT_LEVELS,
  EQ_BANDS,
  EQ_MAX_DB,
  EQ_MIN_DB,
  EQ_PRESETS,
  type EffectLevel,
} from '@app/lib/shapeDsp';

import { locale, t } from '../i18n';
import {
  presetOf,
  setBand,
  setEcho,
  setKeepPitch,
  setNextRoom,
  setPreset,
  setRate,
  usePlayer,
} from '../player';

/**
 * The Shape card's summary — the app's `useShapeSummary`: it states what is
 * not default and nothing else, in the sheet's own order, or "None".
 */
export function useShapeSummary(): string {
  const gains = usePlayer(s => s.gains);
  const rate = usePlayer(s => s.rate);
  const keepPitch = usePlayer(s => s.keepPitch);
  const echo = usePlayer(s => s.echo);
  const nextRoom = usePlayer(s => s.nextRoom);
  const preset = presetOf(gains);

  return (
    [
      preset === 'flat'
        ? null
        : preset === 'custom'
          ? t('player.shape.custom')
          : t(`player.eq.presets.${preset}`),
      rate === 1 ? null : rateLabel(rate, locale),
      rate === 1 || keepPitch ? null : t('player.shape.pitchOff'),
      echo === 'off' ? null : t('player.echo'),
      nextRoom === 'off' ? null : t('player.nextRoom'),
    ]
      .filter(Boolean)
      .join(' · ') || t('player.shape.none')
  );
}

const LevelPicker = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: EffectLevel;
  onChange: (level: EffectLevel) => void;
}) => (
  <label className="cell picker">
    <span className="cell-name">{label}</span>
    <select
      value={value}
      onChange={e => onChange(e.target.value as EffectLevel)}
    >
      {EFFECT_LEVELS.map(level => (
        <option key={level} value={level}>
          {t(`player.shape.levels.${level}`)}
        </option>
      ))}
    </select>
  </label>
);

/**
 * The Shape sheet — the app's iOS Form, section for section: Presets,
 * Equalizer, Playback Speed, Preserve Pitch, Echo, Next Room. Every control
 * is heard as it moves. On a desk it is the column at the right; on a phone,
 * a sheet over the player.
 */
/** The Shape sheet's form — what `SidePanel` holds while Shape is open. */
export function ShapeForm() {
  const gains = usePlayer(s => s.gains);
  const rate = usePlayer(s => s.rate);
  const keepPitch = usePlayer(s => s.keepPitch);
  const echo = usePlayer(s => s.echo);
  const nextRoom = usePlayer(s => s.nextRoom);
  const preset = presetOf(gains);

  return (
    <>
      <div className="card">
        <label className="cell picker">
          <span className="cell-name">{t('player.shape.presets')}</span>
          <select value={preset} onChange={e => setPreset(e.target.value)}>
            {EQ_PRESETS.map(p => (
              <option key={p.i18nKey} value={p.i18nKey}>
                {t(`player.eq.presets.${p.i18nKey}`)}
              </option>
            ))}
            <option value="custom" hidden disabled>
              {t('player.shape.custom')}
            </option>
          </select>
        </label>
      </div>

      <section>
        <h3 className="section-head">{t('player.eq.title')}</h3>
        <div className="card">
          {EQ_BANDS.map((band, i) => (
            <label key={band.hz} className="cell band">
              <span className="band-hz">{band.label}</span>
              <input
                type="range"
                className="slider"
                min={EQ_MIN_DB}
                max={EQ_MAX_DB}
                step={1}
                value={gains[i]}
                aria-label={`${band.hz} Hz`}
                aria-valuetext={`${gains[i]} dB`}
                style={
                  {
                    '--fill': (gains[i] - EQ_MIN_DB) / (EQ_MAX_DB - EQ_MIN_DB),
                  } as React.CSSProperties
                }
                onChange={e => setBand(i, Number(e.target.value))}
              />
              <span className="band-db">
                {gains[i] > 0 ? `+${gains[i]}` : gains[i]}
              </span>
            </label>
          ))}
        </div>
        <p className="section-foot">{t('player.eq.hint')}</p>
      </section>

      <section>
        <h3 className="section-head split">
          <span>{t('player.speed')}</span>
          <span className="head-value">{rateLabel(rate, locale)}</span>
        </h3>
        <div className="card">
          <div className="cell">
            <input
              type="range"
              className="slider"
              min={RATE_MIN}
              max={RATE_MAX}
              step={RATE_STEP}
              value={rate}
              aria-label={t('player.speed')}
              aria-valuetext={rateLabel(rate, locale)}
              style={
                {
                  '--fill': (rate - RATE_MIN) / (RATE_MAX - RATE_MIN),
                } as React.CSSProperties
              }
              onChange={e => setRate(Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="card">
          <label className="cell">
            <span className="cell-name">{t('player.keepPitch')}</span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={keepPitch}
              onChange={e => setKeepPitch(e.target.checked)}
            />
          </label>
        </div>
        <p className="section-foot">{t('player.keepPitchDescription')}</p>
      </section>

      <section>
        <div className="card">
          <LevelPicker
            label={t('player.echo')}
            value={echo}
            onChange={setEcho}
          />
        </div>
        <p className="section-foot">{t('player.echoDescription')}</p>
      </section>

      <section>
        <div className="card">
          <LevelPicker
            label={t('player.nextRoom')}
            value={nextRoom}
            onChange={setNextRoom}
          />
        </div>
        <p className="section-foot">{t('player.nextRoomDescription')}</p>
      </section>
    </>
  );
}
