import React from 'react';
import { ChipGroup, type ChipOption } from '@/shared/ui/ChipGroup';
import { SelectField, type SelectOption } from '@/shared/ui/SelectField';
import { SettingRow } from '@/shared/ui/SettingRow';
import { Stepper } from '@/shared/ui/Stepper';
import { Switch, type SwitchTone } from '@/shared/ui/Switch';
import { useWfNewSetting } from '../../useWfNewSettings';
import type { WfNewSettingKeyOf, WfNewSettings } from '../../WfNewSettingsStore';

export type BooleanSettingKey = WfNewSettingKeyOf<boolean>;
export type NumberSettingKey = WfNewSettingKeyOf<number>;
export type ChoiceSettingKey =
  | 'subtitlePlaybackSpeed' | 'voiceAccent' | 'bilingualRatio' | 'recitalOrder' | 'reviewOrder' | 'reviewAlgorithm' | 'wordListLanguage';

interface RowBase {
  label: string;
  hint?: string;
  boxed?: boolean;
}

interface SwitchSettingRowProps extends RowBase {
  settingKey: BooleanSettingKey;
  tone?: SwitchTone;
}

/** Switch row bound to one boolean store setting. */
export const SwitchSettingRow: React.FC<SwitchSettingRowProps> = ({ settingKey, label, hint, tone, boxed }) => {
  const [on, setOn] = useWfNewSetting(settingKey);
  return (
    <SettingRow label={label} hint={hint} boxed={boxed}>
      <Switch on={on} onChange={setOn} tone={tone} label={label} />
    </SettingRow>
  );
};

interface StepperSettingRowProps extends RowBase {
  settingKey: NumberSettingKey;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  /** Replaces the plain store write (e.g. the daily goal also roams to the backend). */
  onCommit?: (value: number) => void;
}

/** Stepper row bound to one numeric store setting. */
export const StepperSettingRow: React.FC<StepperSettingRowProps> = ({ settingKey, label, hint, boxed, min, max, step, suffix, onCommit }) => {
  const [value, setValue] = useWfNewSetting(settingKey);
  return (
    <SettingRow label={label} hint={hint} boxed={boxed}>
      <Stepper value={value} min={min} max={max} step={step} suffix={suffix} onChange={onCommit ?? setValue} />
    </SettingRow>
  );
};

interface ChoiceSettingRowProps<K extends ChoiceSettingKey> extends RowBase {
  settingKey: K;
  options: readonly ChipOption<WfNewSettings[K] & (string | number)>[];
}

/** Single-choice chip row bound to one store setting. */
export function ChipSettingRow<K extends ChoiceSettingKey>({ settingKey, label, hint, boxed, options }: ChoiceSettingRowProps<K>): React.ReactElement {
  const [value, setValue] = useWfNewSetting(settingKey);
  return (
    <SettingRow label={label} hint={hint} boxed={boxed} stacked>
      <ChipGroup value={value as WfNewSettings[K] & (string | number)} options={options} onChange={setValue} />
    </SettingRow>
  );
}

interface SelectSettingRowProps<K extends ChoiceSettingKey> {
  settingKey: K;
  label: string;
  hint?: string;
  options: readonly SelectOption<WfNewSettings[K] & (string | number)>[];
  inputClassName?: string;
}

/** Select field bound to one store setting. */
export function SelectSettingRow<K extends ChoiceSettingKey>({ settingKey, label, hint, options, inputClassName }: SelectSettingRowProps<K>): React.ReactElement {
  const [value, setValue] = useWfNewSetting(settingKey);
  return (
    <SelectField
      label={label}
      hint={hint}
      value={value as WfNewSettings[K] & (string | number)}
      options={options}
      onChange={setValue}
      inputClassName={inputClassName}
    />
  );
}
