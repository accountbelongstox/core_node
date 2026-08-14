import React from 'react';
import { Play, Loader2, Zap } from 'lucide-react';
import type { PaginatedListColumn } from './PaginatedListModal';
import {
  GLOBAL_TASK_PRIORITIES,
  getGlobalTaskOrderValue,
  isGlobalTaskQueuePositionOrdered,
} from '@/core/contracts/QueueCenterContract';

export type QueueDrillLabels = {
  content: string;
  order: string;
  audio: string;
  lane: string;
  language: string;
  status: string;
  worker: string;
  type: string;
  queue_position: string;
  fast_lane: string;
  play_audio: string;
  generating: string;
  resolve_play: string;
  worker_lease: string;
  task_id: string;
  content_id: string;
  leased_at: string;
  requested: string;
  retries: string;
  error: string;
};

export type QueueDrillColumnDeps = {
  playWordAudio: (url: string, label?: string) => void;
  playSentenceAudio: (sentence: any, language: string) => void;
  sentenceAudioState: Record<string, { resolving: boolean; queued: boolean; url: string | null }>;
  sentenceAudioKey: (text: string, language: string) => string;
  labels: QueueDrillLabels;
};

const orderCell = (r: any, labels: QueueDrillLabels) => {
  const taskType = r.task_type || r.category || r.type || '';
  const queuePositionOrdered = isGlobalTaskQueuePositionOrdered(taskType);
  const rawValue = queuePositionOrdered ? r.queue_position : r.priority;
  const value = getGlobalTaskOrderValue({
    task_type: taskType,
    queue_position: r.queue_position,
    priority: r.priority,
  });
  const fast = !queuePositionOrdered && value >= GLOBAL_TASK_PRIORITIES.fast;
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono text-xs font-bold ${
      fast ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'
    }`} title={fast ? labels.fast_lane : queuePositionOrdered ? labels.queue_position : undefined}>
      {fast && <Zap className="w-3 h-3" />}
      {queuePositionOrdered ? '#' : ''}{typeof rawValue === 'number' ? value : '—'}
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
  const isAudio = isGlobalTaskQueuePositionOrdered(lane) || r.audio_url;
  if (!isAudio || !text) return <span className="text-slate-400">—</span>;

  if (r.audio_url) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); deps.playWordAudio(r.audio_url, text); }}
        className="inline-flex items-center justify-center rounded-full p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
        title={deps.labels.play_audio}
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
      title={st?.queued ? deps.labels.generating : deps.labels.resolve_play}
    >
      {st?.resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
    </button>
  );
};

export const buildAssistQueueColumns = (deps: QueueDrillColumnDeps): PaginatedListColumn[] => [
  {
    key: 'content_text',
    header: deps.labels.content,
    className: 'text-slate-900 dark:text-slate-100 max-w-xs truncate',
    render: (r) => r.content_text || r.word || r.title || '—',
  },
  {
    key: 'order',
    header: deps.labels.order,
    className: 'text-center',
    render: (r) => orderCell(r, deps.labels),
  },
  {
    key: 'audio',
    header: deps.labels.audio,
    className: 'text-center',
    render: (r) => audioCell(r, deps),
  },
  {
    key: 'category',
    header: deps.labels.lane,
    render: (r) => r.category || r.task_type || '—',
  },
  {
    key: 'language',
    header: deps.labels.language,
    className: 'uppercase',
    render: (r) => r.language || '—',
  },
  {
    key: 'status',
    header: deps.labels.status,
    render: (r) => (
      <span className={r.status === 'leased' ? 'text-cyan-600 dark:text-cyan-400 font-semibold' : ''}>
        {r.status || '—'}
      </span>
    ),
  },
  {
    key: 'assigned_to',
    header: deps.labels.worker,
    className: 'truncate max-w-[7rem] text-[11px] font-mono',
    render: (r) => r.assigned_to || '—',
  },
];

export const buildTtsQueueColumns = (deps: QueueDrillColumnDeps): PaginatedListColumn[] => [
  {
    key: 'content_text',
    header: deps.labels.content,
    className: 'text-slate-900 dark:text-slate-100 max-w-xs truncate',
    render: (r) => r.content_text || r.content || r.text || '—',
  },
  {
    key: 'order',
    header: deps.labels.order,
    className: 'text-center',
    render: (r) => orderCell(r, deps.labels),
  },
  {
    key: 'audio',
    header: deps.labels.audio,
    className: 'text-center',
    render: (r) => audioCell(r, deps),
  },
  {
    key: 'task_type',
    header: deps.labels.type,
    render: (r) => r.task_type || r.type || '—',
  },
  {
    key: 'language',
    header: deps.labels.language,
    className: 'uppercase',
    render: (r) => r.language || '—',
  },
  {
    key: 'status',
    header: deps.labels.status,
    render: (r) => r.status || '—',
  },
];
