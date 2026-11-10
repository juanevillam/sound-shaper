import { useEffect, useRef, useState } from 'react';

import { AUTO_DJ_MODES, isAutoDjMode } from '@app/lib/autoDj/plan';
import { rateLabel, RATE_MAX, RATE_MIN, RATE_STEP } from '@app/lib/player';
import {
  EFFECT_LEVELS,
  EQ_BANDS,
  EQ_MAX_DB,
  EQ_MIN_DB,
  EQ_PRESETS,
  type EffectLevel,
} from '@app/lib/shapeDsp';

import { byHand, setAutoDjMode, useAutoDj } from '../autoDj';
import { locale, t } from '../i18n';
import {
  presetOf,
  setBand as setBandRaw,
  setEcho as setEchoRaw,
  setKeepPitch as setKeepPitchRaw,
  setNextRoom as setNextRoomRaw,
  setPreset as setPresetRaw,
  setRate as setRateRaw,
  usePlayer,
} from '../player';

// Any control moved by hand takes the controls back from the DJ — the app's
// `byHand`: the DJ stops with the shape where it is, and the move stands.
const setBand = byHand(setBandRaw);
const setEcho = byHand(setEchoRaw);
const setKeepPitch = byHand(setKeepPitchRaw);
const setNextRoom = byHand(setNextRoomRaw);
const setPreset = byHand(setPresetRaw);
const setRate = byHand(setRateRaw);

/** The app's `SKELETON_DELAY_MS`: a wait shorter than this shows nothing. */
const PROGRESS_DELAY_MS = 400;

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
  const djOn = useAutoDj(s => s.on);
  const preset = presetOf(gains);

  // While the DJ mixes, every value below is its, not the person's.
  if (djOn) return t('player.autoDj');
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
  <div className="card">
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
  </div>
);

/**
 * The Shape sheet — the app's iOS Form, section for section: Presets,
 * Equalizer, Playback Speed, Preserve Pitch, Echo, Next Room. Every control
 * is heard as it moves. On a desk it is the column at the right; on a phone,
 * a sheet over the player.
 */
/**
 * DJ Juan — the sheet's last section, as in the app: a menu picker (Off,
 * This Sound, All Sounds), a footer, and while the library is being read in All
 * Sounds mode a "Reading Library · 3 of 12" row, shown only once the wait has
 * lasted long enough to be worth naming.
 */
function AutoDjSection() {
  const mode = useAutoDj(s => s.mode);
  const ready = useAutoDj(s => s.ready);
  const total = useAutoDj(s => s.total);
  const reading = mode === 'all' && total > 0 && ready < total;
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!reading) {
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), PROGRESS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [reading]);

  return (
    <section>
      <div className="card">
        <label className="cell picker">
          <span className="cell-name">{t('player.autoDj')}</span>
          <select
            value={mode}
            onChange={e => {
              const m = e.target.value;
              if (isAutoDjMode(m)) setAutoDjMode(m);
            }}
          >
            {AUTO_DJ_MODES.map(m => (
              <option key={m} value={m}>
                {t(`player.autoDjMode.${m}`)}
              </option>
            ))}
          </select>
        </label>
        {reading && shown && (
          <div className="cell">
            <span className="cell-name">{t('player.autoDjPreparing')}</span>
            <span className="cell-value">
              {t('player.autoDjProgress', {
                ready: String(ready),
                total: String(total),
              })}
            </span>
          </div>
        )}
      </div>
      <p className="section-foot">{t('player.autoDjDescription')}</p>
    </section>
  );
}

/** The Shape sheet's form — what `SidePanel` holds while Shape is open. */
export function ShapeForm() {
  const gains = usePlayer(s => s.gains);
  const rate = usePlayer(s => s.rate);
  const keepPitch = usePlayer(s => s.keepPitch);
  const echo = usePlayer(s => s.echo);
  const nextRoom = usePlayer(s => s.nextRoom);
  const djOn = useAutoDj(s => s.on);
  const djFocus = useAutoDj(s => s.focus);
  const preset = presetOf(gains);
  const presetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!djOn || !djFocus) return;
    const form = presetsRef.current?.closest<HTMLElement>('.form');
    if (!form) return;
    const maxScroll = Math.max(0, form.scrollHeight - form.clientHeight);
    if (maxScroll <= 0) return;

    let top = form.scrollTop;
    if (djFocus === 'presets' || djFocus === 'eq') {
      top = 0;
    } else {
      const target = form.querySelector<HTMLElement>(
        `[data-dj-section="${djFocus}"]`,
      );
      if (target) {
        const formRect = form.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offsetInForm = targetRect.top - formRect.top + form.scrollTop;
        top = Math.min(
          Math.max(0, offsetInForm - form.clientHeight * 0.4),
          maxScroll,
        );
      } else if (djFocus === 'echo' || djFocus === 'nextRoom') {
        top = maxScroll;
      }
    }
    if (Math.abs(form.scrollTop - top) > 2) {
      form.scrollTo({ top, behavior: 'smooth' });
    }
  }, [djOn, djFocus]);

  return (
    <>
      <div ref={presetsRef} className="card" data-dj-section="presets">
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

      <section data-dj-section="eq">
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

      <section data-dj-section="speed">
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

      <section data-dj-section="keepPitch">
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

      <section data-dj-section="echo">
        <LevelPicker label={t('player.echo')} value={echo} onChange={setEcho} />
        <p className="section-foot">{t('player.echoDescription')}</p>
      </section>

      <section data-dj-section="nextRoom">
        <LevelPicker
          label={t('player.nextRoom')}
          value={nextRoom}
          onChange={setNextRoom}
        />
        <p className="section-foot">{t('player.nextRoomDescription')}</p>
      </section>

      <AutoDjSection />
    </>
  );
}
