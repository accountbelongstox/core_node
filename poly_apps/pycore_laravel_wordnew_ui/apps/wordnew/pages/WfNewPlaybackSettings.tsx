import React from 'react';
import type { ElementTheme } from '../WfNewThemes';
import { ChipSettingRow, SelectSettingRow, StepperSettingRow, SwitchSettingRow } from '../components/settings/WfNewSettingRows';
import { SUBTITLE_SPEEDS, WORD_LIST_LANGUAGES, toSelectOptions, type Translate } from '../components/settings/WfNewSettingChoices';

/**
 * WfNewPlaybackSettings — the subtitle Playback Settings sub-page (opened from
 * the main Settings page). Edits the six subtitle-player preferences, all bound
 * to WfNewSettingsStore.
 */
interface WfNewPlaybackSettingsProps {
  activeTheme: ElementTheme;
  trans: Translate;
}

const SPEED_OPTIONS = SUBTITLE_SPEEDS.map((speed) => ({ value: speed as number, label: `${speed}x` }));
const PAGE_SIZE_RANGE = { min: 10, max: 100, step: 10 };

export const WfNewPlaybackSettings: React.FC<WfNewPlaybackSettingsProps> = ({ activeTheme, trans }) => (
  <div className="max-w-3xl mx-auto space-y-6">
    <div className={`p-6 rounded-3xl ${activeTheme.cardClass} border border-white/5 shadow-lg space-y-1 divide-y divide-white/5`}>
      <ChipSettingRow settingKey="subtitlePlaybackSpeed" label={trans('playset.speed')} options={SPEED_OPTIONS} />
      <SwitchSettingRow settingKey="subtitleLoopLine" label={trans('playset.loopLine')} hint={trans('playset.loopLineDesc')} />
      <SwitchSettingRow settingKey="subtitleShowTranslation" label={trans('playset.showTranslation')} hint={trans('playset.showTranslationDesc')} tone="fuchsia" />
      <SwitchSettingRow settingKey="subtitleAutoNext" label={trans('playset.autoNext')} hint={trans('playset.autoNextDesc')} />
      <StepperSettingRow settingKey="wordListPageSize" label={trans('playset.pageSize')} {...PAGE_SIZE_RANGE} />
      <div className="py-3">
        <SelectSettingRow
          settingKey="wordListLanguage"
          label={trans('playset.wordLanguage')}
          options={toSelectOptions(WORD_LIST_LANGUAGES, trans)}
          inputClassName={activeTheme.inputClass}
        />
      </div>
    </div>
  </div>
);
