import React from 'react';
import { Play, Loader2, Zap } from 'lucide-react';
import {
  GLOBAL_TASK_PRIORITIES,
  getGlobalTaskOrderValue,
  isGlobalTaskQueuePositionOrdered,
} from '@/core/contracts/QueueCenterContract';
import type { QueueDrillLabels } from './queueDrillColumns';

export interface QueueItemDetailPanelProps {
  row: Record<string, any>;
  playWordAudio: (url: string, label?: string) => void;
  playSentenceAudio: (sentence: any, language: string) => void;
  sentenceAudioState: Record<string, { resolving: boolean; queued: boolean; url: string | null }>;
  sentenceAudioKey: (text: string, language: string) => string;
  labels: QueueDrillLabels;
}

const OrderBadge: React.FC<{ row: Record<string, any> }> = ({ row }) => {
  const taskType = row.task_type || row.category || row.type || '';
  const queuePositionOrdered = isGlobalTaskQueuePositionOrdered(taskType);
  const rawValue = queuePositionOrdered ? row.queue_position : row.priority;
  const value = getGlobalTaskOrderValue({
    task_type: taskType,
    queue_position: row.queue_position,
    priority: row.priority,
  });
  const fast = !queuePositionOrdered && value >= GLOBAL_TASK_PRIORITIES.fast;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono ${
      fast
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-400/50'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
    }`}>
      {fast && <Zap className="w-3 h-3" />}
      {queuePositionOrdered ? '#' : 'P'}{typeof rawValue === 'number' ? value : '—'}
    </span>
  );
};

/** Expandable detail for queue drill rows and their contract ordering state. */
const QueueItemDetailPanel: React.FC<QueueItemDetailPanelProps> = ({
  row,
  playWordAudio,
  playSentenceAudio,
  sentenceAudioState,
  sentenceAudioKey,
  labels,
}) => {
  const lang = row.language || 'english';
  const text = row.content_text || row.content || row.text || '';
  const lane = row.category || row.task_type || '';
  const isAudioLane = isGlobalTaskQueuePositionOrdered(lane);
  const audioUrl = row.audio_url as string | undefined;
  const sentKey = text ? sentenceAudioKey(text, lang) : '';
  const sentState = sentKey ? sentenceAudioState[sentKey] : undefined;

  const metaRows: Array<[string, React.ReactNode]> = [
    [labels.status, row.status || '—'],
    [labels.order, <OrderBadge row={row} />],
    [labels.worker_lease, row.assigned_to || '—'],
    [labels.language, lang],
    [labels.type, row.task_type || lane || '—'],
  ];
  if (row.task_id) metaRows.push([labels.task_id, String(row.task_id)]);
  if (row.content_id) metaRows.push([labels.content_id, String(row.content_id)]);
  if (row.leased_at) metaRows.push([labels.leased_at, row.leased_at]);
  if (row.requested_at) metaRows.push([labels.requested, String(row.requested_at)]);
  if (row.retry_count != null) metaRows.push([labels.retries, String(row.retry_count)]);
  if (row.error_message) metaRows.push([labels.error, row.error_message]);

  const playSentence = () => {
    playSentenceAudio({ text, content_text: text, audio: audioUrl }, lang);
  };

  return (
    <div className="px-3 py-2 text-xs space-y-2 bg-slate-50/80 dark:bg-slate-900/40 rounded-lg border border-slate-200/60 dark:border-white/5">
      {text && (
        <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
          {text}
        </p>
      )}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
        {metaRows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="text-slate-700 dark:text-slate-300 break-all">{value}</dd>
          </div>
        ))}
      </dl>
      {isAudioLane && text && (
        <div className="flex items-center gap-2 pt-1">
          {audioUrl ? (
            <button
              type="button"
              onClick={() => playWordAudio(audioUrl, text)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-500 transition"
            >
              <Play className="w-3.5 h-3.5" /> {labels.play_audio}
            </button>
          ) : (
            <button
              type="button"
              onClick={playSentence}
              disabled={!!sentState?.resolving}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-500 transition disabled:opacity-60"
            >
              {sentState?.resolving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {sentState?.queued ? labels.generating : sentState?.url ? labels.play_audio : labels.resolve_play}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default QueueItemDetailPanel;
