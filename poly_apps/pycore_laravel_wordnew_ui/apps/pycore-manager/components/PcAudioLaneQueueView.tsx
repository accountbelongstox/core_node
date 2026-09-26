/**
 * One audio lane's Queue made visible: Part1 (local priority), Part2 (Laravel
 * backlog) and the whole Queue, plus the Part1 fill tracker. Used for the
 * word lane AND the sentence lane (each lane has its own Queue) in the Queue
 * Center, and — scoped to one owner — inside an orchestration task to watch
 * that task's missing words / sentences get filled.
 *
 * Pure render of pycore-owned state (AudioLaneStateStore / owner views); it
 * never derives or caches lane state itself.
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type {
  AudioLaneKey,
  AudioLaneQueueRow,
  AudioLaneQueueView,
  AudioLaneTrackState,
  AudioLaneTrackedItem,
} from '@/apps/pycore-manager/api';
import { absoluteTime, formatElapsed, spanSeconds } from '../utils/pcFormat';

const TRACK_STATES: AudioLaneTrackState[] = ['queued', 'processing', 'done', 'failed'];

const STATE_CLASS: Record<AudioLaneTrackState, string> = {
  queued: 'bg-sky-500/15 text-sky-300',
  processing: 'bg-amber-500/15 text-amber-300',
  done: 'bg-emerald-500/15 text-emerald-300',
  failed: 'bg-rose-500/15 text-rose-300',
};

const nf = (value: number | null | undefined): string => (typeof value === 'number' ? value.toLocaleString() : '—');

function HeadList({ title, rows, empty }: { title: string; rows: AudioLaneQueueRow[]; empty: string }): ReactElement {
  return (
    <div className="min-w-0 flex-1 rounded border border-slate-800 bg-slate-950/50 px-2 py-1">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{title}</p>
      {rows.length === 0 ? (
        <p className="text-[10px] text-slate-600">{empty}</p>
      ) : (
        <ol className="space-y-0.5">
          {rows.map((row) => (
            <li key={row.task_id || row.text} className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span className="shrink-0 font-mono text-[10px] text-slate-500">{row.language}</span>
              <span className="truncate">{row.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function OwnerItems({ items, empty }: { items: AudioLaneTrackedItem[]; empty: string }): ReactElement {
  const { t } = useTranslation('pc');
  if (items.length === 0) return <p className="text-[10px] text-slate-500">{empty}</p>;
  return (
    <ul className="max-h-40 space-y-0.5 overflow-y-auto">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5 text-[11px]">
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${STATE_CLASS[item.state]}`}>
            {t(`queueCenter.audioLane.states.${item.state}`)}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-slate-500">{item.language}</span>
          <span className="truncate text-slate-300">{item.text}</span>
          {item.provider && <span className="shrink-0 font-mono text-[10px] text-slate-500">{item.provider}</span>}
          {item.started_at && (
            <span
              className="shrink-0 font-mono text-[10px] text-slate-500"
              title={[
                `${t('queueCenter.audioLane.queuedAt')} ${absoluteTime(item.queued_at)}`,
                `${t('queueCenter.audioLane.startedAt')} ${absoluteTime(item.started_at)}`,
                `${t('queueCenter.audioLane.finishedAt')} ${absoluteTime(item.finished_at)}`,
              ].join('\n')}
            >
              {formatElapsed(spanSeconds(item.started_at, item.finished_at))}
            </span>
          )}
          {item.settled_by && item.state !== 'queued' && (
            <span className="shrink-0 text-[10px] text-slate-500">
              {item.settled_by === 'lane' ? t('queueCenter.audioLane.settledByLane') : t('queueCenter.audioLane.settledByOwner')}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function PcAudioLaneQueueView({
  lane,
  view,
  loading = false,
  error = null,
  compact = false,
}: {
  lane: AudioLaneKey;
  view: AudioLaneQueueView | null | undefined;
  loading?: boolean;
  error?: string | null;
  compact?: boolean;
}): ReactElement {
  const { t } = useTranslation('pc');
  const title = lane === 'word_audio' ? t('queueCenter.audioLane.wordTitle') : t('queueCenter.audioLane.sentenceTitle');
  if (!view) {
    return (
      <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-[10px] text-slate-500 flex items-center gap-2">
        <span className="uppercase tracking-wider text-slate-400">{title}</span>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>{error || t('queueCenter.audioLane.unavailable')}</span>}
      </div>
    );
  }
  const part1 = view.part1 + view.taken;
  const total = Math.max(1, part1 + view.part2);
  const part1Pct = Math.round((part1 / total) * 100);
  const owner = view.owner;
  const ownerTotal = owner ? Math.max(1, owner.total) : 1;
  const ownerDone = owner ? owner.counts.done : 0;
  const ownerFailed = owner ? owner.counts.failed : 0;

  return (
    <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap text-[10px]">
        <span className="uppercase tracking-wider text-slate-400">{title}</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-slate-500" />}
        <span className="text-slate-300" title={t('queueCenter.audioLane.wholeHint')}>
          {t('queueCenter.audioLane.whole')} <b className="font-mono">{nf(view.queued + view.taken)}</b>
        </span>
        <span className="text-indigo-300" title={t('queueCenter.audioLane.part1Hint')}>
          {t('queueCenter.audioLane.part1')} <b className="font-mono">{nf(part1)}</b>
        </span>
        <span className="text-slate-400" title={t('queueCenter.audioLane.part2Hint')}>
          {t('queueCenter.audioLane.part2')} <b className="font-mono">{nf(view.part2)}</b>
        </span>
        {view.taken > 0 && (
          <span className="text-amber-300">{t('queueCenter.audioLane.taken', { count: view.taken })}</span>
        )}
      </div>
      <div className="flex h-1.5 overflow-hidden rounded bg-slate-800" aria-hidden="true">
        <div className="bg-indigo-500" style={{ width: `${part1Pct}%` }} />
        <div className="bg-slate-500" style={{ width: `${100 - part1Pct}%` }} />
      </div>
      <div className="flex items-center gap-1 flex-wrap text-[10px]">
        <span className="text-slate-500">{t('queueCenter.audioLane.fill')}</span>
        {TRACK_STATES.map((state) => (
          <span key={state} className={`rounded px-1.5 py-0.5 ${STATE_CLASS[state]}`}>
            {t(`queueCenter.audioLane.states.${state}`)} {nf(view.tracked?.[state] ?? 0)}
          </span>
        ))}
      </div>
      {!compact && (
        <div className="flex gap-2">
          <HeadList
            title={`${t('queueCenter.audioLane.part1')} · ${t('queueCenter.audioLane.head')}`}
            rows={view.part1_head}
            empty={t('queueCenter.audioLane.empty')}
          />
          <HeadList
            title={`${t('queueCenter.audioLane.part2')} · ${t('queueCenter.audioLane.head')}`}
            rows={view.part2_head}
            empty={t('queueCenter.audioLane.empty')}
          />
        </div>
      )}
      {owner && (
        <div className="space-y-1 border-t border-slate-800 pt-1.5">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="uppercase tracking-wider text-slate-400">{t('queueCenter.audioLane.taskFill')}</span>
            {TRACK_STATES.map((state) => (
              <span key={state} className={`rounded px-1.5 py-0.5 ${STATE_CLASS[state]}`}>
                {t(`queueCenter.audioLane.states.${state}`)} {nf(owner.counts[state] ?? 0)}
              </span>
            ))}
          </div>
          <div className="flex h-1.5 overflow-hidden rounded bg-slate-800" aria-hidden="true">
            <div className="bg-emerald-500" style={{ width: `${Math.round((ownerDone / ownerTotal) * 100)}%` }} />
            <div className="bg-rose-500" style={{ width: `${Math.round((ownerFailed / ownerTotal) * 100)}%` }} />
          </div>
          <OwnerItems items={owner.items} empty={t('queueCenter.audioLane.noTaskItems')} />
        </div>
      )}
    </div>
  );
}
