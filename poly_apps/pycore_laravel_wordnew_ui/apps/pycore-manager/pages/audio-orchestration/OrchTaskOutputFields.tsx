/**
 * Output-mode fields shared by the task editor and the task detail: the
 * Audio / Video segmented control and, for video, the per-task video style
 * ('' follows the active style).
 */
import React from 'react';
import type { OrchOutputMode, OrchVideoPreset } from '@/apps/pycore-manager/api';
import OrchOutputModeControl from './OrchOutputModeControl';
import { ORCH_L } from './orchShared';
import { ORCH_INPUT_CLASS } from './orchStyles';

export interface OrchTaskOutputValue {
  outputMode: OrchOutputMode;
  videoPreset: string;
}

const OrchTaskOutputFields: React.FC<{
  value: OrchTaskOutputValue;
  presets: OrchVideoPreset[];
  activePresetId: string;
  onChange: (value: OrchTaskOutputValue) => void;
  disabled?: boolean;
}> = ({ value, presets, activePresetId, onChange, disabled = false }) => {
  const activeName = presets.find((preset) => preset.id === activePresetId)?.name || '';
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="text-xs text-slate-400 space-y-1">
        <p>{ORCH_L.outputMode}</p>
        <OrchOutputModeControl
          value={value.outputMode}
          disabled={disabled}
          onChange={(outputMode) => onChange({ ...value, outputMode })}
        />
      </div>
      {value.outputMode === 'video' && (
        <label className="text-xs text-slate-400 min-w-[12rem]">
          {ORCH_L.videoPresetSelect}
          <select
            value={presets.some((preset) => preset.id === value.videoPreset) ? value.videoPreset : ''}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, videoPreset: event.target.value })}
            className={`mt-1 ${ORCH_INPUT_CLASS}`}
          >
            <option value="">{ORCH_L.videoPresetFollowActive}{activeName ? ` (${activeName})` : ''}</option>
            {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
        </label>
      )}
    </div>
  );
};

export default OrchTaskOutputFields;
