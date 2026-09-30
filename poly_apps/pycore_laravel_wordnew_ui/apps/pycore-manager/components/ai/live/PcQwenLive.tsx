/**
 * PcQwenLive — qwen3tts server live view: load state, GPU, queue depth, per-job
 * chunk progress, generation info and recent results.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, CircleSlash, XCircle } from 'lucide-react';
import type { QwenLive, QwenLiveJob } from '@/apps/pycore-manager/api';
import { absoluteTime, formatElapsedMs, toEpochMs } from '../../../utils/pcFormat';
import { formatBytes } from '../../../../../core/utils/formatters';
import { PcStatusPill } from '../PcStatusPill';
import { PcGpuMeters } from './PcLiveSystemMeters';
import { PcLiveProgressRow, PcLiveSection, PcLiveStat, progressPercent } from './PcLiveParts';

const PROGRESS_STALL_MS = 30_000;
const JOB_STATUS_RUNNING = 'running';
const SUMMARY_MAX_CHARS = 80;

const QwenJobRow: React.FC<{ job: QwenLiveJob }> = ({ job }) => {
  const { t } = useTranslation('pc');
  const running = job.status === JOB_STATUS_RUNNING;
  const total = job.chunks_total ?? job.progress_total ?? 0;
  const done = job.chunks_completed ?? job.progress ?? 0;
  const stalled = running && (job.progress_age_ms ?? 0) > PROGRESS_STALL_MS;
  const summary = job.text_summary
    ? (job.text_summary.length > SUMMARY_MAX_CHARS ? `${job.text_summary.slice(0, SUMMARY_MAX_CHARS)}…` : job.text_summary)
    : job.job_id;
  return (
    <PcLiveProgressRow
      percent={progressPercent(done, total)}
      tone={stalled ? 'warn' : running ? 'info' : 'idle'}
      left={summary}
      right={total > 0 ? t('aiHub.live.qwen.chunks', { done, total }) : t('aiHub.live.qwen.chunksUnknown')}
      detail={(
        <>
          <span>{running ? t('aiHub.live.qwen.running') : t('aiHub.live.qwen.queued', { position: job.queue_position ?? 0 })}</span>
          {job.phase && <span>{t('aiHub.live.qwen.phase')}: {job.phase}</span>}
          <span>{t('aiHub.live.qwen.elapsed')}: {formatElapsedMs(job.elapsed_ms)}</span>
          {job.progress_age_ms != null && running && (
            <span className={stalled ? 'text-amber-500' : ''}>
              {t('aiHub.live.qwen.progressAge', { time: formatElapsedMs(job.progress_age_ms) })}
            </span>
          )}
          {job.language && <span>{job.language}</span>}
          {job.speaker && <span>{job.speaker}</span>}
        </>
      )}
    />
  );
};

export const PcQwenLive: React.FC<{ live?: QwenLive | null }> = ({ live }) => {
  const { t } = useTranslation('pc');
  if (!live) return <p className="text-[11px] italic text-slate-400">{t('aiHub.live.noData')}</p>;
  const queue = live.queue ?? {};
  const jobs = live.jobs ?? [];
  const recent = live.recent ?? [];
  const hasGpu = !!live.gpu && (live.gpu.mem_total_mb != null || live.gpu.util_percent != null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PcStatusPill
          tone={live.online ? 'ok' : 'bad'}
          Icon={live.online ? CheckCircle2 : CircleSlash}
          label={live.online ? t('aiHub.live.qwen.online') : t('aiHub.live.qwen.offline')}
        />
        <PcStatusPill
          tone={live.model_loaded ? 'ok' : 'idle'}
          label={live.model_loaded ? t('aiHub.live.modelLoaded') : t('aiHub.live.modelNotLoaded')}
        />
        {queue.stalled && <PcStatusPill tone="warn" Icon={AlertTriangle} label={t('aiHub.live.qwen.stalled')} />}
        {live.device && <span className="text-[10px] font-mono text-slate-400">{live.device}{live.dtype ? ` · ${live.dtype}` : ''}</span>}
        {live.model_id && <span className="text-[10px] font-mono text-slate-400 truncate max-w-[260px]" title={live.model_id}>{live.model_id}</span>}
        {live.attention && <span className="text-[10px] font-mono text-slate-400">{live.attention}</span>}
        {!!live.max_parallel && <span className="text-[10px] font-mono text-slate-400">{t('aiHub.live.qwen.maxParallel', { count: live.max_parallel })}</span>}
      </div>

      {hasGpu && live.gpu && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PcGpuMeters gpu={live.gpu} />
        </div>
      )}

      <PcLiveSection title={t('aiHub.live.queue')}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <PcLiveStat label={t('aiHub.live.qwen.pending')} value={`${queue.pending ?? 0}${queue.queue_max ? ` / ${queue.queue_max}` : ''}`} />
          <PcLiveStat label={t('aiHub.live.qwen.runningJobs')} value={queue.running ?? 0} />
          <PcLiveStat label={t('aiHub.live.qwen.avgElapsed')} value={formatElapsedMs(queue.average_elapsed_ms)} />
          <PcLiveStat
            label={t('aiHub.live.qwen.oldestRunning')}
            value={formatElapsedMs(queue.oldest_running_ms)}
            tone={(queue.oldest_progress_age_ms ?? 0) > PROGRESS_STALL_MS ? 'warn' : undefined}
          />
        </div>
      </PcLiveSection>

      <PcLiveSection
        title={t('aiHub.live.qwen.jobs', { count: jobs.length })}
        aside={(
          <span className="text-[10px] font-mono text-slate-400">
            {t('aiHub.live.qwen.counters', { done: live.synthesized_count ?? 0, failed: live.failed_count ?? 0 })}
          </span>
        )}>
        {jobs.length === 0
          ? <p className="text-[11px] italic text-slate-400">{t('aiHub.live.qwen.noJobs')}</p>
          : <div className="space-y-2">{jobs.map((job) => <QwenJobRow key={job.job_id} job={job} />)}</div>}
      </PcLiveSection>

      {recent.length > 0 && (
        <PcLiveSection title={t('aiHub.live.recent')}>
          <ul className="space-y-1">
            {recent.map((item) => (
              <li key={item.job_id} className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                {item.ok
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  : <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                <span className="truncate">{item.job_id}</span>
                <span className="shrink-0">{formatElapsedMs(item.elapsed_ms)}</span>
                {item.result_bytes != null && <span className="shrink-0">{formatBytes(item.result_bytes)}</span>}
                {item.language && <span className="shrink-0">{item.language}</span>}
                {item.speaker && <span className="shrink-0">{item.speaker}</span>}
                <span className="ml-auto shrink-0 text-slate-400">{absoluteTime(toEpochMs(item.finished_at) || null)}</span>
              </li>
            ))}
          </ul>
        </PcLiveSection>
      )}
    </div>
  );
};
