import React from 'react';
import type { ElementTheme } from '../WfNewThemes';
import { SettingRow } from '@/shared/ui/SettingRow';
import { ChipSettingRow, StepperSettingRow, SwitchSettingRow } from '../components/settings/WfNewSettingRows';
import { WfNewReviewAlgorithmPicker } from '../components/settings/WfNewReviewAlgorithmPicker';
import { REVIEW_ORDERS, toChipOptions, type Translate } from '../components/settings/WfNewSettingChoices';

/**
 * WfNewReviewSettings — the Review Settings sub-page (opened from Learning Model).
 * Daily review limit, review ordering, spaced-repetition algorithm, and whether
 * newly-learned words mix into the review queue. Bound to WfNewSettingsStore.
 */
interface WfNewReviewSettingsProps {
  activeTheme: ElementTheme;
  trans: Translate;
}

const DAILY_LIMIT_RANGE = { min: 5, max: 500, step: 5 };

export const WfNewReviewSettings: React.FC<WfNewReviewSettingsProps> = ({ activeTheme, trans }) => (
  <div className="max-w-3xl mx-auto space-y-6">
    <div className={`p-6 rounded-3xl ${activeTheme.cardClass} border border-white/5 shadow-lg space-y-1 divide-y divide-white/5`}>
      <StepperSettingRow settingKey="reviewDailyLimit" label={trans('rev.dailyLimit')} {...DAILY_LIMIT_RANGE} />
      <ChipSettingRow settingKey="reviewOrder" label={trans('rev.order')} options={toChipOptions(REVIEW_ORDERS, trans)} />
      <SettingRow label={trans('rev.algorithm')} stacked>
        <WfNewReviewAlgorithmPicker trans={trans} />
      </SettingRow>
      <SwitchSettingRow settingKey="reviewIncludeNew" label={trans('rev.includeNew')} />
    </div>
  </div>
);
