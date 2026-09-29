/** "Automatic generation" switch of a task (pycore queue starts it by itself when on). */
import React from 'react';
import { ORCH_L } from './orchShared';

const OrchAutoGenerateSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    title={ORCH_L.autoGenerateHint}
    onClick={() => onChange(!checked)}
    className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-50"
  >
    <span className={`relative inline-block h-4 w-7 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-600'}`}>
      <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${checked ? 'left-3.5' : 'left-0.5'}`} />
    </span>
    {ORCH_L.autoGenerate}
  </button>
);

export default OrchAutoGenerateSwitch;
