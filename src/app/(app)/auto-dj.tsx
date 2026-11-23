import {
  Button,
  Picker,
  Section,
  Text as SwiftUIText,
} from '@expo/ui/swift-ui';
import { foregroundStyle, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { SheetScreen } from '@/components/ui/SheetScreenIos';
import { useAppTheme } from '@/core';
import { useI18n } from '@/i18n';
import {
  AUTO_DJ_PACES,
  AUTO_DJ_PITCH_PREFS,
  AUTO_DJ_VIBES,
  type AutoDjPace,
  type AutoDjPitchPref,
  type AutoDjVibe,
} from '@/lib/autoDj/plan';
import { haptics } from '@/lib/haptics';
import { EFFECT_LEVELS, type EffectLevel } from '@/lib/shapeDsp';
import { useAutoDjStore } from '@/store/autoDj';
import { levelLabel as shaperLevelLabel } from '@/store/shaper';
import { SheetFormBodyIos } from '@/ui';

function MenuPickerRow<T extends string>({
  label,
  value,
  options,
  labelFor,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labelFor: (opt: T) => string;
  onChange: (next: T) => void;
}) {
  return (
    <Picker
      label={label}
      selection={value}
      onSelectionChange={selection => {
        if (
          typeof selection === 'string' &&
          (options as readonly string[]).includes(selection)
        ) {
          haptics.selection();
          onChange(selection as T);
        }
      }}
      modifiers={[pickerStyle('menu')]}
    >
      {options.map(opt => (
        <SwiftUIText key={opt} modifiers={[tag(opt)]}>
          {labelFor(opt)}
        </SwiftUIText>
      ))}
    </Picker>
  );
}

/**
 * Account → DJ Juan native SwiftUI sheet. Classic by default; touching any
 * control (or tapping Randomize) switches to Custom and syncs to
 * `users/{uid}.autoDjProfile`. Reset returns straight to Classic.
 */
export default function AutoDjSettingsScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { preset, custom } = useAutoDjStore(s => s.profile);
  const patchCustom = useAutoDjStore(s => s.patchCustom);
  const randomizeProfile = useAutoDjStore(s => s.randomizeProfile);
  const resetProfile = useAutoDjStore(s => s.resetProfile);

  const effectLabel = (level: EffectLevel) => shaperLevelLabel(t, level);

  return (
    <SheetScreen>
      <SheetFormBodyIos fullHeight>
        <Section title={t('settings.autoDj.flowTitle')}>
          <MenuPickerRow<AutoDjPace>
            label={t('settings.autoDj.pace.label')}
            value={custom.pace}
            options={AUTO_DJ_PACES}
            labelFor={opt => t(`settings.autoDj.pace.${opt}`)}
            onChange={pace => patchCustom({ pace })}
          />
          <MenuPickerRow<AutoDjVibe>
            label={t('settings.autoDj.vibe.label')}
            value={custom.vibe}
            options={AUTO_DJ_VIBES}
            labelFor={opt => t(`settings.autoDj.vibe.${opt}`)}
            onChange={vibe => patchCustom({ vibe })}
          />
        </Section>

        <Section
          title={t('settings.autoDj.controlsTitle')}
          footer={
            <SwiftUIText>{t('settings.autoDj.controlsHint')}</SwiftUIText>
          }
        >
          <MenuPickerRow<EffectLevel>
            label={t('player.eq.title')}
            value={custom.eq}
            options={EFFECT_LEVELS}
            labelFor={effectLabel}
            onChange={eq => patchCustom({ eq })}
          />
          <MenuPickerRow<EffectLevel>
            label={t('player.speed')}
            value={custom.speed}
            options={EFFECT_LEVELS}
            labelFor={effectLabel}
            onChange={speed => patchCustom({ speed })}
          />
          <MenuPickerRow<AutoDjPitchPref>
            label={t('player.keepPitch')}
            value={custom.keepPitch}
            options={AUTO_DJ_PITCH_PREFS}
            labelFor={opt => t(`settings.autoDj.keepPitch.${opt}`)}
            onChange={keepPitch => patchCustom({ keepPitch })}
          />
          <MenuPickerRow<EffectLevel>
            label={t('player.nextRoom')}
            value={custom.nextRoom}
            options={EFFECT_LEVELS}
            labelFor={effectLabel}
            onChange={nextRoom => patchCustom({ nextRoom })}
          />
          <MenuPickerRow<EffectLevel>
            label={t('player.echo')}
            value={custom.echo}
            options={EFFECT_LEVELS}
            labelFor={effectLabel}
            onChange={echo => patchCustom({ echo })}
          />
          <MenuPickerRow<EffectLevel>
            label={t('settings.autoDj.skips.label')}
            value={custom.skips}
            options={EFFECT_LEVELS}
            labelFor={effectLabel}
            onChange={skips => patchCustom({ skips })}
          />
        </Section>

        <Section>
          <Button
            onPress={() => {
              haptics.selection();
              randomizeProfile();
            }}
          >
            <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>
              {t('settings.autoDj.randomize')}
            </SwiftUIText>
          </Button>
          {preset === 'custom' ? (
            <Button
              role="destructive"
              onPress={() => {
                haptics.medium();
                resetProfile();
              }}
            >
              <SwiftUIText modifiers={[foregroundStyle(colors.danger)]}>
                {t('settings.autoDj.reset')}
              </SwiftUIText>
            </Button>
          ) : null}
        </Section>
      </SheetFormBodyIos>
    </SheetScreen>
  );
}
