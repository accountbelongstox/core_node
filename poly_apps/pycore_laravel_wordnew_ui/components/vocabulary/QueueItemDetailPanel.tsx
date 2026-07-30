import React from 'react';
import { Play, Loader2, Zap } from 'lucide-react';

const AUDIO_LANES = new Set(['sentence_audio', 'word', 'word_audio']);

export interface QueueItemDetailPanelProps {
  row: Record<string, any>;
  playWordAudio: (url: string, label?: string) => void;
  playSentenceAudio: (sentence: any, language: string) => void;
  sentenceAudioState: Record<string, { resolving: boolean; queued: boolean; url: string | null }>;
  sentenceAudioKey: (text: string, language: string) => string;
}

const PriorityBadge: React.FC<{ priority: number | null | undefined }> = ({ priority }) => {
  const p = typeof priority === 'number' ? priority : 0;
  const fast = p >= 100;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono ${
      fast
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-400/50'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
    }`}>
      {fast && <Zap className="w-3 h-3" />}
      P{p}
    </span>
  );
};

/** Expandable detail for queue drill rows — lease info, priority, audio playback. */
const QueueItemDetailPanel: React.FC<QueueItemDetailPanelProps> = ({
  row,
  playWordAudio,
  playSentenceAudio,
  sentenceAudioState,
  sentenceAudioKey,
}) => {
  const lang = row.language || 'english';
  const text = row.content_text || row.content || row.text || '';
  const lane = row.category || row.task_type || '';
  const isAudioLane = AUDIO_LANES.has(lane) || lane.includes('audio');
  const audioUrl = row.audio_url as string | undefined;
  const sentKey = text ? sentenceAudioKey(text, lang) : '';
  const sentState = sentKey ? sentenceAudioState[sentKey] : undefined;

  const metaRows: Array<[string, React.ReactNode]> = [
    ['Status', row.status || '—'],
    ['Priority', <PriorityBadge priority={row.priority} />],
    ['Worker / lease', row.assigned_to || '—'],
    ['Language', lang],
    ['Task type', row.task_type || lane || '—'],
  ];
  if (row.task_id) metaRows.push(['Task ID', String(row.task_id)]);
  if (row.content_id) metaRows.push(['Content ID', String(row.content_id)]);
  if (row.leased_at) metaRows.push(['Leased at', row.leased_at]);
  if (row.requested_at) metaRows.push(['Requested', String(row.requested_at)]);
  if (row.retry_count != null) metaRows.push(['Retries', String(row.retry_count)]);
  if (row.error_message) metaRows.push(['Error', row.error_message]);

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
              <Play className="w-3.5 h-3.5" /> Play audio
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
              {sentState?.queued ? 'Generating…' : sentState?.url ? 'Play audio' : 'Resolve & play'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default QueueItemDetailPanel;
