import React from 'react';
import type { DevHistoryTurn } from '../../../core/api/modules/DevHistoryAPI';
import { ROLE_STYLE } from './shared';

interface TurnViewProps {
  turn: DevHistoryTurn;
  subagentLabel: string;
}

const TurnView: React.FC<TurnViewProps> = ({ turn, subagentLabel }) => {
  const style = ROLE_STYLE[turn.role] || ROLE_STYLE.system;
  return (
    <div className={`pl-3 border-l-2 ${style.ring}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-slate-400 mb-0.5">
        {style.icon}
        {style.label}
        {turn.name ? <span className="text-amber-500">· {turn.name}</span> : null}
        {turn.model ? <span className="text-slate-400">· {turn.model}</span> : null}
        {turn.is_subagent && <span className="text-fuchsia-500">· {subagentLabel}</span>}
        {turn.time ? <span className="ml-auto font-normal">{turn.time}</span> : null}
      </div>
      <p
        className={`text-xs whitespace-pre-wrap break-words ${
          turn.role === 'thinking' ? 'italic text-slate-400' : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        {turn.text}
      </p>
    </div>
  );
};

export default TurnView;
