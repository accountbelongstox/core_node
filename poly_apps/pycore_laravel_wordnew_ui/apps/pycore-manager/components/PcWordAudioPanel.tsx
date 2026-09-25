/**
 * Unified Word Audio panel. The Queue Center section switch is the only
 * worker control; the static Kokoro/CPU batch policy is read-only here.
 */
import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { laravelApi, pycoreApi } from '@/apps/pycore-manager/api';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';
import { PcWordAudioLog, type PcWordAudioLogRow } from './PcWordAudioLog';
import { PcAudioDeliveryOutboxStatus } from './PcAudioDeliveryOutboxStatus';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';
import { useQueueWorkerEventPage } from '../hooks/useQueueWorkerEventPage';

export function PcWordAudioPanel(): ReactElement {
  const { t } = useTranslation('pc');
  const hub = useQueueCenterHub();
  const [expanded, setExpanded] = useState(() => StorageManager.getRaw(StorageKeys.PYCORE_WORD_AUDIO_EXPANDED) === '1');
  const [actionError, setActionError] = useState<string | null>(null);
  /*
   * [gpt-5.3-codex-spark:LEGACY-START]
   * Old behavior read worker status from hub.controls.word_audio?.running and showed
   * worker state from `auto_start` + controls signals.
   * New behavior uses sectionContracts.word_audio for contract-aligned status.
   * // const workerOn = hub.voiceWord?.auto_start === true;
   // const workerRunning = hub.controls.word_audio?.running === true;
   // const heartbeatOn = worker?.heartbeat_enabled ?? hub.voiceWord?.heartbeat_enabled ?? false;
   * [gpt-5.3-codex-spark:LEGACY-END]
   */
  const wordSection = hub.sectionContracts.word_audio;
  const worker = hub.voiceWord?.worker;
  const workerOn = wordSection.toggle.enabled;
  const workerRunning = wordSection.lifecycle === 'on';
  const workerConfigured = workerOn && wordSection.lifecycle !== 'off';
  const heartbeatOn = wordSection.worker.online || worker?.heartbeat_enabled || false;
  const pending = wordSection.queue.pending;
  const leased = wordSection.queue.leased;
  const queueProgress = worker?.queue_progress;
  const batchEngine = worker?.batch_engine || worker?.planned_engine || 'kokoro';
  const batchDevice = worker?.batch_device || 'cpu';
  const batchSize = worker?.batch_size || 20;
  const fullSync = wordSection.full_sync ?? null;
  const [fullSyncBusy, setFullSyncBusy] = useState(false);
  const runFullSync = useCallback(async () => {
    if (fullSyncBusy) return;
    setFullSyncBusy(true);
    setActionError(null);
    try {
      const response = await pycoreApi.wordAudioFullSync();
      if (!response.success) throw new Error(response.error || t('queueCenter.wordAudioQueue.errors.fullSyncFailed'));
      await hub.refreshHub();
    } catch (error: any) {
      setActionError(error?.message || t('queueCenter.wordAudioQueue.errors.fullSyncFailed'));
    } finally {
      setFullSyncBusy(false);
    }
  }, [fullSyncBusy, hub, t]);
  const eventPage = useQueueWorkerEventPage(
    'word',
    expanded,
    worker?.event_revision ?? 0,
  );

  const sectionWorkerState = workerOn
    ? (wordSection.lifecycle === 'starting' ? 'starting' : workerRunning ? 'running' : workerConfigured ? 'configured' : 'off')
    : 'off';
  const sectionWorkerLabel = t(`queueCenter.wordAudioQueue.lifecycle.${sectionWorkerState}`);

  const toggleExpanded = useCallback(() => {
    setExpanded((current) => {
      const next = !current;
      StorageManager.setRaw(StorageKeys.PYCORE_WORD_AUDIO_EXPANDED, next ? '1' : '0');
      return next;
    });
  }, []);

  const rows = useMemo<PcWordAudioLogRow[]>(() => eventPage.items
    .map((event) => ({
      at: (event.at ?? 0) * 1000,
      kind: event.kind || 'event',
      text: event.text_preview || '',
      detail: event.detail,
      lang: event.language,
      taskDisplayId: event.task_display_id,
      stage: event.stage,
      progress: event.progress,
      progressTotal: event.progress_total,
      playable: Boolean(event.text_preview && event.language && event.kind === 'ok'),
    }))
    .sort((left, right) => right.at - left.at), [eventPage.items]);

  const playRow = useCallback(async (row: PcWordAudioLogRow) => {
    if (!row.text || !row.lang) return;
    setActionError(null);
    try {
      const source = await laravelApi.getWordAudioMediaDataUrl(row.text, row.lang);
      await new Audio(source).play();
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : t('queueCenter.wordAudioQueue.errors.playbackFailed'));
    }
  }, [t]);

  return (
    <div className="mb-3 rounded-lg border border-slate-700 bg-slate-900/80">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-sm font-semibold text-sky-300">🔊 {t('queueCenter.wordAudioQueue.title')}</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/20 text-violet-400">
          {batchEngine}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-700/70 text-slate-300 uppercase">
          {batchDevice} · {t('queueCenter.wordAudioQueue.batch.badge')}
        </span>
        <span className={`text-[10px] font-bold ${workerOn ? 'text-emerald-400' : 'text-slate-500'}`}>
          {workerOn
            ? t('queueCenter.wordAudioQueue.workerState', { state: sectionWorkerLabel })
            : t('queueCenter.wordAudioQueue.workerOff')}
        </span>
        <span className="text-[10px] text-slate-500 truncate flex-1 min-w-0">
          {t('queueCenter.wordAudioQueue.queueSummary', { pending: pending ?? '—', leased: leased ?? '—' })}
          {queueProgress?.total != null
            ? ` · ${queueProgress.completed ?? 0}/${queueProgress.total}`
            : ''}
        </span>
        <button type="button" onClick={toggleExpanded}
          className="shrink-0 rounded bg-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-600">
          {expanded ? t('queueCenter.wordAudioQueue.collapse') : t('queueCenter.wordAudioQueue.expand')}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-700/60 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
              {t('queueCenter.wordAudioQueue.batch.engine')}
            </span>
            <span className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-mono text-slate-200">
              {batchEngine}
            </span>
            <span className="text-[10px] text-slate-400">
              {t('queueCenter.wordAudioQueue.batch.policy', { device: batchDevice.toUpperCase(), size: batchSize })}
            </span>
          </div>

        <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1 text-[10px] text-slate-500 flex items-center gap-2 flex-wrap">
          <span className="uppercase tracking-wider text-slate-400">{t('queueCenter.wordAudioQueue.fullSync.title')}</span>
          {fullSync ? (
            <>
              <span className={fullSync.running ? 'text-amber-400' : 'text-slate-400'}>
                {fullSync.running
                  ? t('queueCenter.wordAudioQueue.fullSync.running')
                  : fullSync.last_sync_at
                    ? t('queueCenter.wordAudioQueue.fullSync.lastSync', { time: new Date(fullSync.last_sync_at * 1000).toLocaleString() })
                    : t('queueCenter.wordAudioQueue.fullSync.never')}
              </span>
              {fullSync.last_result?.pulled != null && fullSync.last_result.pulled > 0 && (
                <span className="font-mono">
                  {t('queueCenter.wordAudioQueue.fullSync.pulled', {
                    pulled: fullSync.last_result.pulled,
                    inserted: fullSync.last_result.inserted ?? 0,
                  })}
                </span>
              )}
              <span className="font-mono">
                {t('queueCenter.wordAudioQueue.fullSync.queued', { count: fullSync.queue_count })}
              </span>
              {fullSync.last_result?.error && (
                <span className="text-rose-400">{fullSync.last_result.error}</span>
              )}
            </>
          ) : (
            <span>{t('queueCenter.wordAudioQueue.fullSync.unavailable')}</span>
          )}
          <button type="button" onClick={() => void runFullSync()} disabled={!workerOn || fullSyncBusy || fullSync?.running}
            title={t('queueCenter.wordAudioQueue.fullSync.actionTitle')}
            className="ml-auto rounded bg-indigo-600/80 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
            {t('queueCenter.wordAudioQueue.fullSync.action')}
          </button>
        </div>

        <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1 text-[10px] text-slate-500 flex gap-2 flex-wrap">
          <span>{t('queueCenter.wordAudioQueue.pycoreWorker')}</span>
          <span className={heartbeatOn ? 'text-emerald-400' : 'text-slate-500'}>
            {heartbeatOn
              ? t('queueCenter.wordAudioQueue.heartbeatOn')
              : t('queueCenter.wordAudioQueue.heartbeatOff')}
          </span>
          <span className="font-mono">
              {t('queueCenter.wordAudioQueue.workerTotals', {
                claimed: wordSection.worker.claimed ?? 0,
                ok: wordSection.worker.ok ?? 0,
                fail: wordSection.worker.fail ?? 0,
              })}
          </span>
        </div>

          <PcAudioDeliveryOutboxStatus
            lane="word"
            running={worker?.delivery_outbox_running}
            status={worker?.delivery_outbox}
            onChanged={hub.refreshHub}
          />

          <p className="rounded border border-sky-700/40 bg-sky-950/20 px-2 py-1 text-[10px] text-sky-300/90">
            {t('queueCenter.wordAudioQueue.batch.help')}
          </p>
          {actionError && <p className="text-[10px] text-rose-400">{actionError}</p>}
          {eventPage.error && (
            <p className="text-[10px] text-rose-400">
              {t('queueCenter.logPagination.unavailable')} {eventPage.error}
            </p>
          )}
          <PcWordAudioLog
            rows={rows}
            title={t('queueCenter.wordAudioQueue.logTitle')}
            progressLabel={t('queueCenter.wordAudioQueue.progress')}
            stageLabel={(stage) => t(`queueCenter.sentenceQueue.stage.${stage}`, { defaultValue: stage })}
            onPlay={playRow}
            page={eventPage.page}
            pages={eventPage.pages}
            total={eventPage.total}
            loading={eventPage.loading}
            onPage={eventPage.setPage}
          />
        </div>
      )}
    </div>
  );
}
