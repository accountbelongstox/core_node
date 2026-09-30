/** Audio / Video segmented control of a task's output mode (default: video). */
import React from 'react';
import type { OrchOutputMode } from '@/apps/pycore-manager/api';
import { ORCH_L } from './orchShared';
import { ORCH_OUTPUT_ICONS, ORCH_OUTPUT_MODES } from './orchSources';

export const orchOutputModeLabel = (mode: OrchOutputMode): string => (
  mode === 'audio' ? ORCH_L.outputAudio : ORCH_L.outputVideo
);

const OrchOutputModeControl: React.FC<{
  value: OrchOutputMode;
  onChange: (mode: OrchOutputMode) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled = false }) => (
  <div role="radiogroup" aria-label={ORCH_L.outputMode} className="inline-flex overflow-hidden rounded-lg border border-slate-700">
    {ORCH_OUTPUT_MODES.map((mode) => {
      const Icon = ORCH_OUTPUT_ICONS[mode];
      const selected = value === mode;
      return (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={selected}
          disabled={disabled}
          onClick={() => onChange(mode)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
            selected ? 'bg-sky-600 text-white' : 'bg-slate-950/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Icon className="w-3.5 h-3.5" /> {orchOutputModeLabel(mode)}
        </button>
      );
    })}
  </div>
);

export default OrchOutputModeControl;
