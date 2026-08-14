/**
 * PcSentenceQueuePanel — dedicated sentence-audio generation queue (Queue Center tab).
 * Single merged panel: status row, current-task banner, Laravel missing rows,
 * worker events log, and the qwen3tts speaker selector.
 * Reachability comes from the shared hub (task-center), never from the snapshot.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  MessageSquareText, RefreshCw, AlertTriangle, Loader2, ChevronDown, ChevronUp, Cpu,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pycoreApi, ttsConcurrencyAnnotation } from '@/apps/pycore-manager/api';
import type { SentenceAudioQueueSnapshot, SentenceWorkerTask, TtsStatus } from '@/apps/pycore-manager/api';

import type { QueueCenterPanelProps } from '../utils/pcQueueCenterTypes';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';
import { usePycoreTaskCenterState } from '../hooks/TaskCenterState';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';
import PcTagFilteredLog from '../components/PcTagFilteredLog';
import { QUEUE_CENTER_DIFF_DELIVERY } from '../../../core/contracts/QueueCenterContract';

type PcSentenceQueuePanelProps = QueueCenterPanelProps;

const preview = (text?: string | null, max = 72): string => {
  const t = (text || '').trim();
  if (!t) return '—';
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

const formatDuration = (seconds?: number | null): string => {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return `${value.toFixed(value < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(value / 60);
  const remainder = Math.floor(value % 60);
  return `${minutes}m ${remainder}s`;
};

export const PcSentenceQueuePanel: React.FC<PcSentenceQueuePanelProps> = () => {
  const { t } = useTranslation('pc');
  const hub = useQueueCenterHub();
  const state = usePycoreTaskCenterState();
  // Snapshot from the SHARED hub (one poll for the whole page).
  const raw = hub.sentenceQueue as any;
  const snap: SentenceAudioQueueSnapshot | null =
    raw && raw.success !== false ? (raw as SentenceAudioQueueSnapshot) : null;
  const loading = hub.loading;
  const [logOpen, setLogOpen] = useState(true);
  const [concurrencyInput, setConcurrencyInput] = useState(() =>
    StorageManager.get(StorageKeys.PYCORE_SENTENCE_WORKER_CONCURRENCY, ''),
  );
  const [speakerInput, setSpeakerInput] = useState(() =>
    StorageManager.get(StorageKeys.PYCORE_SENTENCE_QWEN_SPEAKER, ''),
  );
  const err = state.sentenceActionErr || hub.sliceErrors.sentence_queue || null;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  /*
   * [gpt-5.3-codex-spark:LEGACY-START]
   * onMeta reporting used to push { count, loading } to the page-level badge:
   * const total = snap ? (snap.queue?.total ?? snap.queue?.items?.length ?? 0) : null;
   * onMeta?.({ count: total, loading: hub.loading });
   * [gpt-5.3-codex-spark:LEGACY-END]
   */


  const items = snap?.queue?.items ?? [];
  const events = snap?.worker?.events ?? [];
  // Concurrent worker exposes a LIST of in-flight tasks; older builds a single dict.
  const currentRaw = snap?.worker?.current_task;
  const inFlight: SentenceWorkerTask[] = Array.isArray(currentRaw)
    ? currentRaw
    : currentRaw
      ? [currentRaw]
      : [];
  // Reachability verdict comes ONLY from the shared hub (task-center remote_queue).
  const reachable = hub.laravelReachable === true;

  // Status-row figures: processor state + Laravel counts from the shared voice
  // status, worker totals from the queue snapshot (falling back to the status).
  const voiceSentence = hub.voiceSentence;
  const processorOn = voiceSentence?.processor_enabled
    ?? voiceSentence?.auto_start
    ?? snap?.worker?.enabled
    ?? false;
  const laravelPending = hub.sectionContracts.sentence_audio.queue.pending;
  const laravelLeased = hub.sectionContracts.sentence_audio.queue.leased;
  const totalClaimed = snap?.worker?.total_claimed ?? voiceSentence?.worker?.total_claimed ?? null;
  const totalSucceeded = snap?.worker?.total_succeeded ?? voiceSentence?.worker?.total_succeeded ?? null;
  const totalFailed = snap?.worker?.total_failed ?? voiceSentence?.worker?.total_failed ?? null;
  const queueProgress = snap?.worker?.queue_progress ?? voiceSentence?.worker?.queue_progress;

  // Sentence Audio has one required engine. The shared TTS snapshot decides
  // whether qwen3tts is ready or can be started by the managed lifecycle.
  const ttsRaw = hub.tts as any;
  const ttsStatus: TtsStatus | null =
    ttsRaw && ttsRaw.success !== false && Array.isArray(ttsRaw.engines) ? (ttsRaw as TtsStatus) : null;
  const requiredEngineName = hub.voiceSentence?.required_engine || 'qwen3tts';
  const requiredEngine = ttsStatus?.engines?.find((engine) => engine.name === requiredEngineName);
  const requiredEngineReady = !!requiredEngine && (
    requiredEngine.available
    || !!(requiredEngine.server_engine && requiredEngine.installed && requiredEngine.server_enabled !== false)
  );
  const activeEngineName = requiredEngineReady ? requiredEngineName : null;
  const activeEngine = requiredEngineReady ? requiredEngine : undefined;
  const concurrencyAnn = ttsConcurrencyAnnotation(activeEngine?.concurrency, activeEngineName || '');
  const concurrencyLimit = voiceSentence?.concurrency_limit ?? 1;
  const isSerialEngine = concurrencyLimit === 1
    || (activeEngine?.concurrency ?? (activeEngineName === 'edge' ? 'serial' : undefined)) === 'serial';
  const supportedSpeakers = voiceSentence?.supported_speakers ?? [];
  const selectedSpeaker = speakerInput || voiceSentence?.selected_speaker || '';
  const sentenceLogTags = QUEUE_CENTER_DIFF_DELIVERY.consumer_log_tags.sentence_audio ?? [];

  const workerConcurrency = (snap?.worker as any)?.concurrency ?? hub.voiceSentence?.concurrency;
  const concurrencyRecommended = (snap?.worker as any)?.concurrency_recommended ?? hub.voiceSentence?.concurrency_recommended;
  const onConcurrencyChange = React.useCallback((rawStr: string) => {
    setConcurrencyInput(rawStr);
    void state.setSentenceAudioConcurrency(
      rawStr,
      processorOn,
      hub.refreshHub,
      t('queueCenter.sentenceQueue.concurrencySaveFailed'),
    );
  }, [hub.refreshHub, processorOn, state, t]);
  const onSpeakerChange = React.useCallback((speaker: string) => {
    setSpeakerInput(speaker);
    void state.setSentenceAudioSpeaker(
      speaker,
      processorOn,
      concurrencyInput,
      hub.refreshHub,
      t('queueCenter.sentenceQueue.speakerSaveFailed'),
    );
  }, [concurrencyInput, hub.refreshHub, processorOn, state, t]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <MessageSquareText className="w-4 h-4 text-teal-400 shrink-0" />
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {t('queueCenter.sentenceQueue.title')}
        </span>
        <span className="text-[10px] text-slate-400">{t('queueCenter.sentenceQueue.subtitle')}</span>
        {snap?.queue?.total != null && (
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-500">{snap.queue.total}</span>
        )}
        {!reachable && (
          <span className="text-[10px] text-amber-500 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {t('queueCenter.sentenceQueue.laravelUnavailable')}
          </span>
        )}
        <button type="button" onClick={() => hub.refreshHub()} disabled={loading}
          className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-teal-500/10 text-teal-500 transition disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {ttsStatus && (
        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-500">
          <Cpu className="w-3 h-3 text-teal-400 shrink-0" />
          <span className="uppercase tracking-wide text-slate-400">
            {t('queueCenter.sentenceQueue.engineLabel')}
          </span>
          {activeEngineName ? (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              title={t('queueCenter.sentenceQueue.engineQwenTitle')}>
              {activeEngineName}
              {activeEngineName === 'qwen3tts' && (
                <span className="font-mono text-[9px] opacity-80">{t('queueCenter.sentenceQueue.engineGpu')}</span>
              )}
              {activeEngine?.server_running && <span className="font-mono text-[9px] opacity-80">svc</span>}
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400"
              title={t('queueCenter.sentenceQueue.engineFallbackTitle')}>
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {t('queueCenter.sentenceQueue.engineFallbackNone')}
            </span>
          )}
          {activeEngineName === 'qwen3tts' && (
            <label className="inline-flex items-center gap-1 text-[10px] text-slate-400">
              {t('queueCenter.sentenceQueue.voiceLabel')}
              <select
                value={selectedSpeaker}
                onChange={(event) => onSpeakerChange(event.target.value)}
                title={t('queueCenter.sentenceQueue.voiceTitle')}
                className="min-w-28 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200"
              >
                <option value="">{t('queueCenter.sentenceQueue.voiceAuto')}</option>
                {selectedSpeaker && !supportedSpeakers.includes(selectedSpeaker) && (
                  <option value={selectedSpeaker}>{selectedSpeaker}</option>
                )}
                {supportedSpeakers.map((speaker) => (
                  <option key={speaker} value={speaker}>{speaker}</option>
                ))}
              </select>
            </label>
          )}
          {concurrencyAnn && (
            <span className="text-[10px] font-mono text-slate-500">{concurrencyAnn}</span>
          )}
          <label className="inline-flex items-center gap-1 text-[10px] text-slate-400 ml-2">
            {t('queueCenter.sentenceQueue.concurrencyLabel')}
            <input
              type="text"
              value={isSerialEngine ? '1' : concurrencyInput || (workerConcurrency ? String(workerConcurrency) : '')}
              placeholder={concurrencyRecommended ? String(concurrencyRecommended) : t('queueCenter.sentenceQueue.autoValue')}
              onChange={(e) => onConcurrencyChange(e.target.value)}
              disabled={isSerialEngine}
              title={isSerialEngine
                ? t('queueCenter.sentenceQueue.concurrencyFixedTitle')
                : t('queueCenter.sentenceQueue.concurrencyTitle')}
              className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200 disabled:opacity-50"
            />
          </label>
        </div>
      )}

      {/* status row: processor state + Laravel counts + worker totals */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[10px] font-mono text-slate-500">
        <span className={`inline-flex items-center gap-1 ${processorOn ? 'text-emerald-500' : 'text-slate-400'}`}
          title={t('queueCenter.sentenceQueue.processorTitle')}>
          <span className={`w-1.5 h-1.5 rounded-full ${processorOn ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {processorOn
            ? t('queueCenter.sentenceQueue.processorOn')
            : t('queueCenter.sentenceQueue.processorOff')}
        </span>
        <span title={t('queueCenter.sentenceQueue.laravelQueueTitle')}>
          {t('queueCenter.sentenceQueue.laravelPending')} <b className="text-sky-500">{laravelPending ?? '—'}</b>
          {' · '}{t('queueCenter.sentenceQueue.leased')} <b className="text-violet-500">{laravelLeased ?? '—'}</b>
        </span>
        <span title={t('queueCenter.sentenceQueue.workerTotalsTitle')}>
          {t('queueCenter.sentenceQueue.claimed')} <b className="text-slate-700 dark:text-slate-300">{totalClaimed ?? 0}</b>
          {' · '}{t('queueCenter.sentenceQueue.succeeded')} <b className="text-emerald-500">{totalSucceeded ?? 0}</b>
          {' · '}{t('queueCenter.sentenceQueue.failed')} <b className={totalFailed ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}>{totalFailed ?? 0}</b>
        </span>
        {queueProgress?.total != null && (
          <span title={t('queueCenter.wordAudioQueue.progress')}>
            <b className="text-emerald-500">{queueProgress.completed ?? 0}</b>/{queueProgress.total}
          </span>
        )}
      </div>

      {inFlight.length > 0 && (
        <div className="space-y-1.5">
          {inFlight.map((task, i) => {
            const stage = task.stage || 'processing';
            const progress = Math.min(100, Math.max(0, task.progress ?? 0));
            return (
              <div key={task.task_id ?? task.content_id ?? i}
                className="pc-glass p-2.5 text-[11px] font-mono text-teal-600 dark:text-teal-300">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400 uppercase text-[9px] tracking-wide">
                    {t(`queueCenter.sentenceQueue.stage.${stage}`, { defaultValue: stage })}
                  </span>
                  <span>{progress}%</span>
                  <span>{t('queueCenter.sentenceQueue.elapsedLabel')} {formatDuration(task.elapsed_seconds)}</span>
                  <span className={task.backend_uploaded ? 'text-emerald-500' : 'text-amber-500'}>
                    {task.backend_uploaded
                      ? t('queueCenter.sentenceQueue.uploadOk')
                      : t('queueCenter.sentenceQueue.uploadPending')}
                  </span>
                  {stage === 'finalizing' && (
                    <span className={task.backend_result_accepted ? 'text-emerald-500' : 'text-amber-500'}>
                      {task.backend_result_accepted
                        ? t('queueCenter.sentenceQueue.resultOk')
                        : t('queueCenter.sentenceQueue.resultPending')}
                    </span>
                  )}
                  {task.speaker && <span>{t('queueCenter.sentenceQueue.voiceLabel')} {task.speaker}</span>}
                </div>
                <div className="mt-1">[{task.language}] {t('queueCenter.sentenceQueue.queuePosition')} #{task.queue_position ?? 0} · {preview(task.content as string, 96)}</div>
                <div className="mt-1 h-1 overflow-hidden rounded bg-slate-500/15">
                  <div className="h-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
                {(task.variant_count ?? 0) > 1 && (
                  <span className="mt-1 inline-block text-sky-400">
                    · {t('queueCenter.sentenceQueue.variantLabel')} {task.current_variant_index}/{task.variant_count}
                    {' '}({task.current_variant_key || t('queueCenter.sentenceQueue.primaryVariant')})
                    {' '}{t('queueCenter.sentenceQueue.providerLabel')} <b>{task.current_provider || t('queueCenter.sentenceQueue.pendingValue')}</b>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {err && (
        <p className="text-[11px] text-rose-500"><AlertTriangle className="w-3 h-3 inline mr-1" />{err}</p>
      )}

      <div className="pc-glass overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-500/10 text-[10px] uppercase tracking-wide text-slate-400 flex justify-between">
          <span>{t('queueCenter.sentenceQueue.missingRows')} ({snap?.queue?.total ?? items.length})</span>
          <span>{t('queueCenter.sentenceQueue.queueHeadHint')}</span>
        </div>
        {loading && !items.length ? (
          <p className="p-4 text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {t('queueCenter.sentenceQueue.loading')}</p>
        ) : !items.length ? (
          <p className="p-4 text-xs text-slate-400">{t('queueCenter.sentenceQueue.empty')}</p>
        ) : (
          <ul className="divide-y divide-slate-500/10 max-h-[320px] overflow-y-auto">
            {items.slice(0, 100).map((row) => {
              const key = row.task_id || `${row.language}:${row.content_id}`;
              const processing = row.tts_status === 'assigned' || row.tts_status === 'processing' || !!row.processing;
              const stage = row.stage || row.tts_status || 'pending';
              const progress = Math.min(100, Math.max(0, row.progress ?? 0));
              const assignedAtMs = row.assigned_at ? Date.parse(row.assigned_at) : Number.NaN;
              const elapsedSeconds = processing && Number.isFinite(assignedAtMs)
                ? Math.max(0, (Date.now() - assignedAtMs) / 1000)
                : null;
              return (
                <li key={key}
                  className={`px-3 py-2 text-xs ${processing ? 'bg-teal-500/5' : ''}`}>
                  <div className="flex items-start gap-2">
                    {processing
                      ? <Loader2 className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5 animate-spin" />
                      : null}
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 dark:text-slate-200 truncate" title={row.text}>{preview(row.text, 120)}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {row.task_id && <>{t('queueCenter.sentenceQueue.taskLabel')} <b>{row.task_id}</b>{' · '}</>}
                        {row.language} · {t('queueCenter.sentenceQueue.queuePosition')} <b className="text-amber-500">#{row.queue_position ?? 0}</b>
                        {' · '}{t(`queueCenter.sentenceQueue.stage.${stage}`, { defaultValue: stage })}
                        {' · '}{progress}%
                        {elapsedSeconds != null && <>{' · '}{t('queueCenter.sentenceQueue.elapsedLabel')} {formatDuration(elapsedSeconds)}</>}
                        {' · '}<span className={row.backend_uploaded ? 'text-emerald-500' : processing ? 'text-amber-500' : 'text-slate-400'}>
                          {row.backend_uploaded
                            ? t('queueCenter.sentenceQueue.uploadOk')
                            : processing
                              ? t('queueCenter.sentenceQueue.uploadPending')
                              : t('queueCenter.sentenceQueue.uploadNotStarted')}
                        </span>
                        {row.tts_locked_by ? ` · ${row.tts_locked_by}` : ''}
                      </p>
                      <div className="mt-1 h-1 overflow-hidden rounded bg-slate-500/15">
                        <div className="h-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Merged log: worker events (completed/failed sentences land here once
          they leave the queue head) + the live qwen3tts/worker pycore_log stream. */}
      <div className="pc-glass overflow-hidden">
        <button type="button" onClick={() => setLogOpen((v) => !v)}
          className="w-full px-3 py-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400 hover:bg-slate-500/5">
          <span>{t('queueCenter.sentenceQueue.workerLog')} ({events.length})</span>
          {logOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {logOpen && (
          <div>
            <ul className="divide-y divide-slate-500/10 max-h-[220px] overflow-y-auto text-[10px] font-mono">
              {!events.length ? (
                <li className="px-3 py-2 text-slate-400">{t('queueCenter.sentenceQueue.noLog')}</li>
              ) : events.map((ev, i) => (
                <li key={`${ev.at}-${i}`} className="px-3 py-1.5 text-slate-500">
                  <span className="text-slate-400">{new Date((ev.at || 0) * 1000).toLocaleTimeString()}</span>
                  {' '}[{ev.kind}] {ev.detail}
                  {ev.text_preview ? ` · "${ev.text_preview}"` : ''}
                  {ev.elapsed_seconds != null && (
                    <span className="ml-2 text-sky-500">+{formatDuration(ev.elapsed_seconds)}</span>
                  )}
                  {typeof ev.backend_uploaded === 'boolean' && (
                    <span className={`ml-2 ${ev.backend_uploaded ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {ev.backend_uploaded
                        ? t('queueCenter.sentenceQueue.uploadOk')
                        : t('queueCenter.sentenceQueue.uploadPending')}
                    </span>
                  )}
                  {typeof ev.backend_result_accepted === 'boolean' && (
                    <span className={`ml-2 ${ev.backend_result_accepted ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {ev.backend_result_accepted
                        ? t('queueCenter.sentenceQueue.resultOk')
                        : t('queueCenter.sentenceQueue.resultPending')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-500/10">
              <PcTagFilteredLog
                bare
                tags={sentenceLogTags}
                title={t('queueCenter.sentenceQueue.liveLog')}
                emptyHint={t('queueCenter.sentenceQueue.liveLogEmpty')}
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default PcSentenceQueuePanel;
