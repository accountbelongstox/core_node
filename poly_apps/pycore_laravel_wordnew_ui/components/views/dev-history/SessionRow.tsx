import React from 'react';
import { User as UserIcon } from 'lucide-react';
import type { DevHistorySessionSummary } from '@/apps/laravel-manager/api';
import { toolLabel, toolPill } from './shared';

interface SessionRowProps {
  s: DevHistorySessionSummary;
  active: boolean;
  subagentLabel: string;
  onClick: () => void;
}

const SessionRow: React.FC<SessionRowProps> = ({ s, active, subagentLabel, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-2.5 border-b border-black/5 dark:border-white/10 transition-colors ${
      active ? 'bg-indigo-500/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
    }`}
  >
    <div className="flex items-center gap-2 mb-1">
      <span className={toolPill(s.tool)}>{toolLabel(s.tool)}</span>
      {s.has_subagent && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-500/30">
          {subagentLabel}
        </span>
      )}
      <span className="ml-auto text-[10px] text-slate-400">{s.started_at}</span>
    </div>
    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
      {s.title || s.project || s.raw_id}
    </div>
    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
      <UserIcon size={11} /> {s.os_user}
      <span className="ml-auto">
        {s.prompt_count} · {s.message_count}
      </span>
    </div>
  </button>
);

export default SessionRow;
