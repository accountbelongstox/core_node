/** Task list header: one tab per task source (with its total from `counts`) and the name search box. */
import React from 'react';
import { Search } from 'lucide-react';
import type { OrchTaskSource } from '@/apps/pycore-manager/api';
import { humanInt } from '../vocabulary/vocabShared';
import { ORCH_L } from './orchShared';
import { ORCH_BOOK_SOURCE, ORCH_TASK_TABS, orchSourcePresentation } from './orchSources';
import { ORCH_INPUT_CLASS } from './orchStyles';

const tabLabel = (source: OrchTaskSource): string => (source === ORCH_BOOK_SOURCE ? ORCH_L.tabBooks : ORCH_L.tabPrompts);

const OrchTaskTabs: React.FC<{
  source: OrchTaskSource;
  counts: Record<string, number>;
  queryInput: string;
  onSourceChange: (source: OrchTaskSource) => void;
  onQueryChange: (query: string) => void;
}> = ({ source, counts, queryInput, onSourceChange, onQueryChange }) => (
  <div className="flex flex-wrap items-center gap-2 border-b border-slate-700/60">
    <div role="tablist" className="flex items-center gap-1">
      {ORCH_TASK_TABS.map((tab) => {
        const presentation = orchSourcePresentation(tab);
        const selected = tab === source;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSourceChange(tab)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              selected ? 'border-sky-400 text-sky-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <presentation.Icon className="w-3.5 h-3.5" />
            {tabLabel(tab)}
            <span className={`rounded-full px-1.5 text-[10px] font-mono ${selected ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-700/60 text-slate-400'}`}>
              {humanInt(counts[tab] || 0)}
            </span>
          </button>
        );
      })}
    </div>
    <label className="relative ml-auto mb-1 block w-full sm:w-64">
      <Search className="pointer-events-none absolute left-2 top-2 w-3.5 h-3.5 text-slate-500" />
      <input
        type="search"
        value={queryInput}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={ORCH_L.searchTasks}
        aria-label={ORCH_L.searchTasks}
        className={`${ORCH_INPUT_CLASS} pl-7`}
      />
    </label>
  </div>
);

export default OrchTaskTabs;
