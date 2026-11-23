import {
  AUTO_DJ_PACES,
  AUTO_DJ_PITCH_PREFS,
  AUTO_DJ_VIBES,
  type AutoDjPace,
  type AutoDjPitchPref,
  type AutoDjVibe,
} from '@app/lib/autoDj/plan';
import { EFFECT_LEVELS, type EffectLevel } from '@app/lib/shapeDsp';

import {
  patchAutoDjCustom,
  randomizeAutoDjProfile,
  resetAutoDjProfile,
  useAutoDj,
} from '../autoDj';
import { t } from '../i18n';

function OptionPicker<T extends string>({
  label,
  value,
  options,
  labelFor,
  active,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labelFor: (opt: T) => string;
  active?: boolean;
  onChange: (next: T) => void;
}) {
  return (
    <label className={active ? 'cell picker is-active' : 'cell picker'}>
      <span className="cell-name">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value as T)}>
        {options.map(opt => (
          <option key={opt} value={opt}>
            {labelFor(opt)}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Account → DJ Juan subsheet: Classic by default; touching any control (or
 * tapping Randomize) switches to Custom and syncs to `users/{uid}.autoDjProfile`.
 * Reset returns straight to Classic.
 */
export function AutoDjSettingsForm() {
  const { preset, custom } = useAutoDj(s => s.profile);

  return (
    <>
      <section>
        <h3 className="section-head">{t('settings.autoDj.flowTitle')}</h3>
        <div className="card">
          <OptionPicker<AutoDjPace>
            label={t('settings.autoDj.pace.label')}
            value={custom.pace}
            options={AUTO_DJ_PACES}
            labelFor={opt => t(`settings.autoDj.pace.${opt}`)}
            onChange={pace => patchAutoDjCustom({ pace })}
          />
          <OptionPicker<AutoDjVibe>
            label={t('settings.autoDj.vibe.label')}
            value={custom.vibe}
            options={AUTO_DJ_VIBES}
            labelFor={opt => t(`settings.autoDj.vibe.${opt}`)}
            active={custom.vibe !== 'auto'}
            onChange={vibe => patchAutoDjCustom({ vibe })}
          />
        </div>
      </section>

      <section>
        <h3 className="section-head">{t('settings.autoDj.controlsTitle')}</h3>
        <div className="card">
          <OptionPicker<EffectLevel>
            label={t('player.eq.title')}
            value={custom.eq}
            options={EFFECT_LEVELS}
            labelFor={opt => t(`player.shape.levels.${opt}`)}
            active={custom.eq !== 'off'}
            onChange={eq => patchAutoDjCustom({ eq })}
          />
          <OptionPicker<EffectLevel>
            label={t('player.speed')}
            value={custom.speed}
            options={EFFECT_LEVELS}
            labelFor={opt => t(`player.shape.levels.${opt}`)}
            active={custom.speed !== 'off'}
            onChange={speed => patchAutoDjCustom({ speed })}
          />
          <OptionPicker<AutoDjPitchPref>
            label={t('player.keepPitch')}
            value={custom.keepPitch}
            options={AUTO_DJ_PITCH_PREFS}
            labelFor={opt => t(`settings.autoDj.keepPitch.${opt}`)}
            active={custom.keepPitch !== 'auto'}
            onChange={keepPitch => patchAutoDjCustom({ keepPitch })}
          />
          <OptionPicker<EffectLevel>
            label={t('player.nextRoom')}
            value={custom.nextRoom}
            options={EFFECT_LEVELS}
            labelFor={opt => t(`player.shape.levels.${opt}`)}
            active={custom.nextRoom !== 'off'}
            onChange={nextRoom => patchAutoDjCustom({ nextRoom })}
          />
          <OptionPicker<EffectLevel>
            label={t('player.echo')}
            value={custom.echo}
            options={EFFECT_LEVELS}
            labelFor={opt => t(`player.shape.levels.${opt}`)}
            active={custom.echo !== 'off'}
            onChange={echo => patchAutoDjCustom({ echo })}
          />
          <OptionPicker<EffectLevel>
            label={t('settings.autoDj.skips.label')}
            value={custom.skips}
            options={EFFECT_LEVELS}
            labelFor={opt => t(`player.shape.levels.${opt}`)}
            active={custom.skips !== 'off'}
            onChange={skips => patchAutoDjCustom({ skips })}
          />
        </div>
        <p className="section-foot">{t('settings.autoDj.controlsHint')}</p>
      </section>

      <div className="card">
        <button
          type="button"
          className="cell action-row"
          onClick={randomizeAutoDjProfile}
        >
          {t('settings.autoDj.randomize')}
        </button>
        {preset === 'custom' && (
          <button
            type="button"
            className="cell destructive-row"
            onClick={resetAutoDjProfile}
          >
            {t('settings.autoDj.reset')}
          </button>
        )}
      </div>
    </>
  );
}
