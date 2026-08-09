import React from 'react';
import { User as UserIcon } from 'lucide-react';
import type { DevHistorySessionDetail } from '@/apps/laravel-manager/api';
import { toolLabel, toolPill } from './shared';
import TurnView from './TurnView';

interface SessionDetailViewProps {
  detail: DevHistorySessionDetail;
  subagentLabel: string;
}

const SessionDetailView: React.FC<SessionDetailViewProps> = ({ detail, subagentLabel }) => (
  <div className="flex flex-col h-full">
    <div className="px-4 py-3 border-b border-black/5 dark:border-white/10 sticky top-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur">
      <div className="flex items-center gap-2 mb-1">
        <span className={toolPill(detail.tool)}>{toolLabel(detail.tool)}</span>
        <UserIcon size={12} className="text-slate-400" />
        <span className="text-xs text-slate-500">{detail.os_user}</span>
        {detail.has_subagent && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-500/30">
            {subagentLabel}
          </span>
        )}
      </div>
      <div className="text-sm font-semibold text-slate-800 dark:text-white truncate">
        {detail.title || detail.project || detail.raw_id}
      </div>
      {detail.project && (
        <div className="text-[11px] text-slate-400 truncate">{detail.project}</div>
      )}
    </div>

    <div className="p-3 space-y-2">
      {(detail.turns || []).map((turn, i) => (
        <TurnView key={i} turn={turn} subagentLabel={subagentLabel} />
      ))}
    </div>
  </div>
);

export default SessionDetailView;
