/**
 * PcKokoroLive — Kokoro word / phrase batch live view: model load, queue depth,
 * batch progress (words, groups, words/s) and the recently generated words.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { KokoroLive, KokoroLiveBatch } from '@/apps/pycore-manager/api';
import { formatElapsedMs } from '../../../utils/pcFormat';
import { PcStatusPill } from '../PcStatusPill';
import { PcLiveProgressRow, PcLiveSection, PcLiveStat, progressPercent } from './PcLiveParts';

const RTF_DECIMALS = 2;

const KokoroBatchRow: React.FC<{ batch: KokoroLiveBatch; finished?: boolean }> = ({ batch, finished }) => {
  const { t } = useTranslation('pc');
  const total = batch.total_words ?? 0;
  const done = batch.done_words ?? 0;
  const failed = batch.failed_words ?? 0;
  return (
    <PcLiveProgressRow
      percent={progressPercent(done + failed, total)}
      tone={failed > 0 ? 'warn' : finished ? 'ok' : 'info'}
      left={finished ? t('aiHub.live.kokoro.lastBatch') : t('aiHub.live.kokoro.currentBatch')}
      right={t('aiHub.live.kokoro.words', { done, total })}
      detail={(
        <>
          {failed > 0 && <span className="text-amber-500">{t('aiHub.live.kokoro.failed', { count: failed })}</span>}
          {!!batch.total_groups && (
            <span>{t('aiHub.live.kokoro.groups', { current: batch.current_group ?? 0, total: batch.total_groups })}</span>
          )}
          {batch.words_per_s != null && <span>{t('aiHub.live.kokoro.wordsPerSecond', { rate: batch.words_per_s })}</span>}
          <span>{t('aiHub.live.kokoro.elapsed')}: {formatElapsedMs(batch.elapsed_ms)}</span>
          {batch.device && <span>{batch.device}</span>}
          {!!batch.batch_size && <span>{t('aiHub.live.kokoro.batchSize', { count: batch.batch_size })}</span>}
          {batch.phase && !finished && <span>{t('aiHub.live.kokoro.phase')}: {batch.phase}</span>}
        </>
      )}
    />
  );
};

export const PcKokoroLive: React.FC<{ live?: KokoroLive | null }> = ({ live }) => {
  const { t } = useTranslation('pc');
  if (!live) return <p className="text-[11px] italic text-slate-400">{t('aiHub.live.noData')}</p>;
  const queue = live.queue ?? {};
  const recent = live.recent ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PcStatusPill
          tone={live.loaded ? 'ok' : 'idle'}
          label={live.loaded ? t('aiHub.live.modelLoaded') : t('aiHub.live.modelNotLoaded')}
        />
        <PcStatusPill
          tone={live.running ? 'info' : 'idle'}
          busy={!!live.running}
          label={live.running ? t('aiHub.live.kokoro.running') : t('aiHub.live.kokoro.idle')}
        />
      </div>

      <PcLiveSection title={t('aiHub.live.queue')}>
        <div className="grid grid-cols-3 gap-2">
          <PcLiveStat label={t('aiHub.live.kokoro.queued')} value={queue.queued ?? 0} />
          <PcLiveStat label={t('aiHub.live.kokoro.processing')} value={queue.processing ?? 0} />
          <PcLiveStat label={t('aiHub.live.kokoro.modelQueue')} value={queue.model_queue_depth ?? 0} />
        </div>
      </PcLiveSection>

      <PcLiveSection title={t('aiHub.live.kokoro.batch')}>
        {live.batch
          ? <KokoroBatchRow batch={live.batch} />
          : live.last_batch
            ? <KokoroBatchRow batch={live.last_batch} finished />
            : <p className="text-[11px] italic text-slate-400">{t('aiHub.live.kokoro.noBatch')}</p>}
      </PcLiveSection>

      {recent.length > 0 && (
        <PcLiveSection title={t('aiHub.live.recent')}>
          <ul className="space-y-1 max-h-48 overflow-auto pr-1">
            {[...recent].reverse().map((item, position) => (
              <li key={`${item.md5 || item.word}-${position}`} className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                {item.ok
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  : item.ms === 0 && item.duration_ms === 0
                    ? <Loader2 className="w-3.5 h-3.5 text-slate-400 shrink-0 animate-spin" />
                    : <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                <span className="truncate text-slate-700 dark:text-slate-200">{item.word}</span>
                {item.ms != null && <span className="ml-auto shrink-0">{t('aiHub.live.kokoro.wordMs', { ms: item.ms })}</span>}
                {item.duration_ms != null && <span className="shrink-0">{t('aiHub.live.kokoro.audioMs', { ms: item.duration_ms })}</span>}
                {item.rtf != null && <span className="shrink-0">{t('aiHub.live.kokoro.rtf', { value: item.rtf.toFixed(RTF_DECIMALS) })}</span>}
              </li>
            ))}
          </ul>
        </PcLiveSection>
      )}
    </div>
  );
};
