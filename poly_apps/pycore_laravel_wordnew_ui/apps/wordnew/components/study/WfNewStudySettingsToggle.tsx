import React from 'react';
import { Settings2 } from 'lucide-react';

interface WfNewStudySettingsToggleProps {
  active: boolean;
  title: string;
  onClick: () => void;
}

/** Gear button that opens / closes the study settings sheet. */
export const WfNewStudySettingsToggle: React.FC<WfNewStudySettingsToggleProps> = ({ active, title, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`p-2.5 rounded-xl border transition-all ${
      active
        ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
        : 'bg-white/5 border-white/5 hover:bg-white/10 text-zinc-400'
    }`}
    title={title}
  >
    <Settings2 className="w-3.5 h-3.5" />
  </button>
);
