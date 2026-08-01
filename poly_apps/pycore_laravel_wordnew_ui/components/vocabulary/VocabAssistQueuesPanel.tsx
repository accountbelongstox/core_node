import React, { useState } from 'react';
import {
  LayoutGrid, RefreshCw, Cpu, Chrome, Sparkles, Users, ChevronDown, ChevronRight, Eye, Wifi, WifiOff,
} from 'lucide-react';
import { commonClasses } from '../../styles/theme';
import { LoadingBlock, EmptyState } from '../common';
import type {
  AssistOverviewResponse, AssistQueueCategory, AssistQueueWorker,
} from '@/apps/laravel-manager/api';

type DrillStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'leased';

const HANDLER_STYLE: Record<string, { chip: string; Icon: React.FC<{ className?: string }> }> = {
  chrome: { chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', Icon: Chrome },
  pycore: { chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', Icon: Cpu },
  ai: { chip: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', Icon: Sparkles },
};

const handlerStyle = (handler: string) => HANDLER_STYLE[handler] ?? HANDLER_STYLE.pycore;

interface VocabAssistQueuesPanelProps {
  overview: AssistOverviewResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onDrill: (label: string, category: string, status?: DrillStatus) => void;
}

const CountBtn: React.FC<{
  value: number;
  label: string;
  accent: string;
  onClick?: () => void;
}> = ({ value, label, accent, onClick }) => {
  const inner = (
    <>
      <span className={`text-lg font-bold font-mono ${value > 0 ? accent : 'text-slate-400'}`}>{value}</span>
      <span className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
    </>
  );
  if (!onClick) {
    return (
      <span className="inline-flex flex-col items-center px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60">
        {inner}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex flex-col items-center px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:ring-2 hover:ring-indigo-400/40 transition group"
    >
      <span className={`flex items-center gap-0.5 ${value > 0 ? accent : 'text-slate-400'}`}>
        <span className="text-lg font-bold font-mono">{value}</span>
        <Eye className="w-3 h-3 opacity-0 group-hover:opacity-50" />
      </span>
      <span className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
    </button>
  );
};

const WorkerChip: React.FC<{ worker: AssistQueueWorker }> = ({ worker }) => {
  const hs = handlerStyle(worker.kind);
  const HIcon = hs.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] border ${
        worker.online
          ? 'border-emerald-400/40 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-400'
      }`}
      title={worker.processor_types?.join(', ') || worker.id}
    >
      <HIcon className="w-3 h-3 shrink-0" />
      <span className="font-medium truncate max-w-[8rem]">{worker.name || worker.id}</span>
      {worker.claimed > 0 && (
        <span className="font-mono text-[10px] opacity-80">{worker.claimed}</span>
      )}
    </span>
  );
};

const CategoryCard: React.FC<{
  category: AssistQueueCategory;
  expanded: boolean;
  onToggle: () => void;
  onDrill: (label: string, status?: DrillStatus) => void;
}> = ({ category: c, expanded, onToggle, onDrill }) => {
  const hs = handlerStyle(String(c.primary_handler));
  const HIcon = hs.Icon;
  const langs = c.by_language ? Object.entries(c.by_language).filter((entry) => Number(entry[1]) > 0) : [];
  const samples = c.sample ?? [];

  return (
    <div className="rounded-xl p-3 border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/40 space-y-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={c.label}>
          {c.label}
        </span>
        <span title={`Eligible: ${c.claimants.join(', ')}`} className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase shrink-0 ${hs.chip}`}>
          <HIcon className="w-3 h-3" />
          {c.primary_handler}
          {c.claimants.length > 1 && <Users className="w-3 h-3" />}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <CountBtn
          value={c.pending ?? 0}
          label="Pending"
          accent="text-yellow-600 dark:text-yellow-400"
          onClick={() => onDrill('Pending', 'pending')}
        />
        <CountBtn
          value={c.processing ?? 0}
          label="Processing"
          accent="text-blue-600 dark:text-blue-400"
          onClick={() => onDrill('Processing', 'processing')}
        />
        <CountBtn
          value={c.leased ?? 0}
          label="Leased"
          accent="text-cyan-600 dark:text-cyan-400"
          onClick={() => onDrill('Leased', 'leased')}
        />
        <CountBtn
          value={c.total ?? 0}
          label="Total"
          accent="text-slate-600 dark:text-slate-300"
          onClick={() => onDrill('All', undefined)}
        />
      </div>
      {(langs.length > 0 || samples.length > 0) && (
        <button
          type="button"
          onClick={onToggle}
          className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Details
        </button>
      )}
      {expanded && (
        <div className="space-y-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          {langs.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {langs.map(([lang, n]) => (
                <span key={lang} className="px-1.5 py-0.5 rounded bg-white/60 dark:bg-black/20 font-mono">
                  {lang}: {n}
                </span>
              ))}
            </div>
          )}
          {samples.length > 0 && (
            <ul className="space-y-0.5 truncate">
              {samples.slice(0, 5).map((s, i) => (
                <li key={i} className="truncate" title={s.word || s.title || s.source_key || ''}>
                  {s.word || s.title || s.source_key || `#${s.id ?? i}`}
                  {s.language ? ` · ${s.language}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Worker queue lanes (pycore / chrome / ai) from GET /assist/overview.
 * Complements the dictionary TTS queue stats with GlobalTask + assist lanes.
 */
const VocabAssistQueuesPanel: React.FC<VocabAssistQueuesPanelProps> = ({
  overview,
  loading,
  onRefresh,
  onDrill,
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const categories = overview?.categories ?? [];
  const workers = overview?.workers ?? [];
  const onlineWorkers = workers.filter((w) => w.online);

  return (
    <div className={`${commonClasses.card} p-4 mb-4`}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-indigo-500" />
          <h3 className="font-semibold text-lg">Worker Queues</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            pycore · mpc-chrome · Laravel assist
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {overview?.generated_at && (
        <p className="text-[10px] text-slate-400 mb-2 font-mono">
          Snapshot {new Date(overview.generated_at).toLocaleString()}
        </p>
      )}

      {workers.length > 0 && (
        <div className="mb-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-black/20">
          <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <Users className="w-3.5 h-3.5" />
            Registered workers
            <span className={`ml-1 inline-flex items-center gap-0.5 text-[10px] font-normal ${
              onlineWorkers.length > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'
            }`}>
              {onlineWorkers.length > 0 ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {onlineWorkers.length}/{workers.length} online
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {workers.map((w) => (
              <WorkerChip key={w.id} worker={w} />
            ))}
          </div>
        </div>
      )}

      {loading && !overview ? (
        <LoadingBlock />
      ) : categories.length === 0 ? (
        <EmptyState message="No worker queue categories available" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((c) => (
            <CategoryCard
              key={c.key}
              category={c}
              expanded={!!expanded[c.key]}
              onToggle={() => setExpanded((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
              onDrill={(label, status) => onDrill(`${c.label} — ${label}`, c.key, status)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default VocabAssistQueuesPanel;
