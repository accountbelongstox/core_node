/**
 * Standalone Audio Orchestration page (/pycore-manager/audio-orchestration).
 * Hosts the source-agnostic AudioOrchWorkspace; the source filter is kept in
 * `?source=` so other pages can deep-link to one source.
 */
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AudioLines } from 'lucide-react';
import AudioOrchWorkspace from './audio-orchestration/AudioOrchWorkspace';
import { ORCH_L } from './audio-orchestration/orchShared';
import type { OrchSourceFilter } from './audio-orchestration/orchSources';

const SOURCE_PARAM = 'source';

export default function PcAudioOrchestrationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceFilter: OrchSourceFilter = searchParams.get(SOURCE_PARAM) || 'all';

  const selectFilter = (filter: OrchSourceFilter) => {
    const next = new URLSearchParams(searchParams);
    if (filter === 'all') next.delete(SOURCE_PARAM);
    else next.set(SOURCE_PARAM, filter);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <header className="flex items-center gap-2">
        <AudioLines className="w-6 h-6 text-sky-400" />
        <div>
          <h1 className="text-xl font-bold text-slate-100">{ORCH_L.pageTitle}</h1>
          <p className="text-sm text-slate-400">{ORCH_L.pageSubtitle}</p>
        </div>
      </header>

      <AudioOrchWorkspace sourceFilter={sourceFilter} onSourceFilterChange={selectFilter} />
    </div>
  );
}
