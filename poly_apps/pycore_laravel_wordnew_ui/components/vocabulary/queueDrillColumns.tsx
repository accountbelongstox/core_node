import React from 'react';
import { Play, Loader2, Zap } from 'lucide-react';
import type { PaginatedListColumn } from './PaginatedListModal';

export type QueueDrillColumnDeps = {
  playWordAudio: (url: string, label?: string) => void;
  playSentenceAudio: (sentence: any, language: string) => void;
  sentenceAudioState: Record<string, { resolving: boolean; queued: boolean; url: string | null }>;
  sentenceAudioKey: (text: string, language: string) => string;
};

const priorityCell = (r: any) => {
  const p = typeof r.priority === 'number' ? r.priority : 0;
  const fast = p >= 100;
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono text-xs font-bold ${
      fast ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'
    }`} title={fast ? 'Fast lane (wordnew bump)' : undefined}>
      {fast && <Zap className="w-3 h-3" />}
      {p}
    </span>
  );
};

const audioCell = (
  r: any,
  deps: QueueDrillColumnDeps,
) => {
  const text = r.content_text || r.content || r.text || '';
  const lang = r.language || 'english';
  const lane = r.category || r.task_type || '';
  const isAudio = lane.includes('audio') || lane === 'word' || r.audio_url;
  if (!isAudio || !text) return <span className="text-slate-400">—</span>;

  if (r.audio_url) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); deps.playWordAudio(r.audio_url, text); }}
        className="inline-flex items-center justify-center rounded-full p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
        title="Play audio"
      >
        <Play className="w-3.5 h-3.5" />
      </button>
    );
  }

  const key = deps.sentenceAudioKey(text, lang);
  const st = deps.sentenceAudioState[key];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        deps.playSentenceAudio({ text, content_text: text }, lang);
      }}
      disabled={!!st?.resolving}
      className="inline-flex items-center justify-center rounded-full p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-50"
      title={st?.queued ? 'Generating…' : 'Resolve & play'}
    >
      {st?.resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
    </button>
  );
};

export const buildAssistQueueColumns = (deps: QueueDrillColumnDeps): PaginatedListColumn[] => [
  {
    key: 'content_text',
    header: 'Content',
    className: 'text-slate-900 dark:text-slate-100 max-w-xs truncate',
    render: (r) => r.content_text || r.word || r.title || '—',
  },
  {
    key: 'priority',
    header: 'Pri',
    className: 'text-center',
    render: priorityCell,
  },
  {
    key: 'audio',
    header: 'Audio',
    className: 'text-center',
    render: (r) => audioCell(r, deps),
  },
  {
    key: 'category',
    header: 'Lane',
    render: (r) => r.category || r.task_type || '—',
  },
  {
    key: 'language',
    header: 'Lang',
    className: 'uppercase',
    render: (r) => r.language || '—',
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <span className={r.status === 'leased' ? 'text-cyan-600 dark:text-cyan-400 font-semibold' : ''}>
        {r.status || '—'}
      </span>
    ),
  },
  {
    key: 'assigned_to',
    header: 'Worker',
    className: 'truncate max-w-[7rem] text-[11px] font-mono',
    render: (r) => r.assigned_to || '—',
  },
];

export const buildTtsQueueColumns = (deps: QueueDrillColumnDeps): PaginatedListColumn[] => [
  {
    key: 'content_text',
    header: 'Content',
    className: 'text-slate-900 dark:text-slate-100 max-w-xs truncate',
    render: (r) => r.content_text || r.content || r.text || '—',
  },
  {
    key: 'priority',
    header: 'Pri',
    className: 'text-center',
    render: priorityCell,
  },
  {
    key: 'audio',
    header: 'Audio',
    className: 'text-center',
    render: (r) => audioCell(r, deps),
  },
  {
    key: 'task_type',
    header: 'Type',
    render: (r) => r.task_type || r.type || '—',
  },
  {
    key: 'language',
    header: 'Lang',
    className: 'uppercase',
    render: (r) => r.language || '—',
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => r.status || '—',
  },
];
