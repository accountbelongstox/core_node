/**
 * PcSentenceQueuePanel — dedicated sentence-audio generation queue (Queue Center tab).
 * Single merged panel: status row, current-task banner, Laravel missing rows,
 * worker events log, and the voice-variant editor as a collapsible sub-section.
 * Reachability comes from the shared hub (task-center), never from the snapshot.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  MessageSquareText, RefreshCw, AlertTriangle, Zap, Loader2, Play, ChevronDown, ChevronUp, Cpu,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pycoreApi, ttsConcurrencyAnnotation } from '@/apps/pycore-manager/api';
import type { SentenceAudioQueueSnapshot, SentenceWorkerTask, TtsStatus } from '@/apps/pycore-manager/api';

import type { QueueCenterPanelProps } from '../utils/pcQueueCenterTypes';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';
import { usePycoreTaskCenterState } from '../hooks/TaskCenterState';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';
import PcSentenceVoiceVariantsPanel from '../components/PcSentenceVoiceVariantsPanel';
import PcTagFilteredLog from '../components/PcTagFilteredLog';

type PcSentenceQueuePanelProps = QueueCenterPanelProps;

const preview = (text?: string | null, max = 72): string => {
  const t = (text || '').trim();
  if (!t) return '—';
  return t.length > max ? `${t.slice(0, max)}…` : t;
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
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [concurrencyInput, setConcurrencyInput] = useState(() =>
    StorageManager.get(StorageKeys.PYCORE_SENTENCE_WORKER_CONCURRENCY, ''),
  );
  const err = state.sentenceActionErr || hub.sliceErrors.sentence_queue || (hub.pycoreReachable ? null : hub.error);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  /*
   * [gpt-5.3-codex-spark:LEGACY-START]
   * onMeta reporting used to push { count, loading } to the page-level badge:
   * const total = snap ? (snap.queue?.total ?? snap.queue?.items?.length ?? 0) : null;
   * onMeta?.({ count: total, loading: hub.loading });
   * [gpt-5.3-codex-spark:LEGACY-END]
   */

  const runOnce = async () => {
    await state.runSentenceAudioOnce(hub.refreshHub);
  };

  const items = snap?.queue?.items ?? [];
  const events = snap?.worker?.events ?? [];
  // Per-language pending counts (non-zero only) for the variants header chips.
  const langPendingChips = Object.entries(snap?.queue?.summary?.languages ?? {})
    .filter(([, count]) => (count ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 8) as Array<[string, number]>;
  // Concurrent worker exposes a LIST of in-flight tasks; older builds a single dict.
  const currentRaw = snap?.worker?.current_task;
  const inFlight: SentenceWorkerTask[] = Array.isArray(currentRaw)
    ? currentRaw
    : currentRaw
      ? [currentRaw]
      : [];
  // Reachability verdict comes ONLY from the shared hub (task-center remote_queue).
  const reachable = hub.laravelReachable === true;

  // Status-row figures: live heartbeat + Laravel counts from the shared voice
  // status, worker totals from the queue snapshot (falling back to the status).
  const voiceSentence = hub.voiceSentence;
  const heartbeatOn = snap?.worker?.heartbeat_enabled ?? voiceSentence?.heartbeat_enabled ?? false;
  const laravelPending = voiceSentence?.laravel?.pending ?? null;
  const laravelLeased = voiceSentence?.laravel?.leased ?? null;
  const totalClaimed = snap?.worker?.total_claimed ?? voiceSentence?.worker?.total_claimed ?? null;
  const totalSucceeded = snap?.worker?.total_succeeded ?? voiceSentence?.worker?.total_succeeded ?? null;
  const totalFailed = snap?.worker?.total_failed ?? voiceSentence?.worker?.total_failed ?? null;

  // Sentence-audio engine indicator (presentational): sentence TTS is qwen3tts-first
  // (GPU neural voice). Read the qwen3tts entry from the shared TTS status; when it is
  // not ready (venv not ready / server down) show the highest-priority available fallback engine.
  const ttsRaw = hub.tts as any;
  const ttsStatus: TtsStatus | null =
    ttsRaw && ttsRaw.success !== false && Array.isArray(ttsRaw.engines) ? (ttsRaw as TtsStatus) : null;
  const sentencePriority = ttsStatus?.sentence_priority?.length
    ? ttsStatus.sentence_priority
    : [...(ttsStatus?.engines ?? [])].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)).map((engine) => engine.name);
  const activeEngineName = sentencePriority.find((name) => (
    ttsStatus?.engines?.find((engine) => engine.name === name)?.available
  )) ?? null;
  const activeEngine = ttsStatus?.engines?.find(e => e.name === activeEngineName);
  const concurrencyAnn = ttsConcurrencyAnnotation(activeEngine?.concurrency, activeEngineName || '');
  const isSerialEngine = (activeEngine?.concurrency ?? (activeEngineName === 'edge' ? 'serial' : undefined)) === 'serial';

  const workerConcurrency = (snap?.worker as any)?.concurrency ?? hub.voiceSentence?.concurrency;
  const concurrencyRecommended = (snap?.worker as any)?.concurrency_recommended ?? hub.voiceSentence?.concurrency_recommended;
  const onConcurrencyChange = React.useCallback((rawStr: string) => {
    setConcurrencyInput(rawStr);
    void state.setSentenceAudioConcurrency(rawStr, hub.voiceSentence?.auto_start === true, hub.refreshHub);
  }, [hub, state]);

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
            <AlertTriangle className="w-3 h-3" /> Laravel unreachable
          </span>
        )}
        <button type="button" onClick={runOnce} disabled={state.sentenceBusy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold pc-glass text-teal-600 hover:bg-teal-500/10 transition disabled:opacity-50">
          {state.sentenceBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {t('queueCenter.sentenceAudio.runOnce')}
        </button>
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
              title="First available engine in the configured sentence TTS priority">
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
          {concurrencyAnn && (
            <span className="text-[10px] font-mono text-slate-500">{concurrencyAnn}</span>
          )}
          <label className="inline-flex items-center gap-1 text-[10px] text-slate-400 ml-2">
            concurrency
            <input
              type="text"
              value={isSerialEngine ? '1' : concurrencyInput || (workerConcurrency ? String(workerConcurrency) : '')}
              placeholder={concurrencyRecommended ? String(concurrencyRecommended) : 'auto'}
              onChange={(e) => onConcurrencyChange(e.target.value)}
              disabled={isSerialEngine}
              title={isSerialEngine
                ? 'Serial engine — concurrency is fixed at 1'
                : 'pycore sentence worker concurrency (0/empty = recommended)'}
              className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200 disabled:opacity-50"
            />
          </label>
        </div>
      )}

      {/* status row: live heartbeat + Laravel counts + worker totals */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[10px] font-mono text-slate-500">
        <span className={`inline-flex items-center gap-1 ${heartbeatOn ? 'text-emerald-500' : 'text-slate-400'}`}
          title="Sentence worker live heartbeat">
          <span className={`w-1.5 h-1.5 rounded-full ${heartbeatOn ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          heartbeat {heartbeatOn ? 'on' : 'off'}
        </span>
        <span title="Laravel sentence-audio queue (pending / leased)">
          laravel pending <b className="text-sky-500">{laravelPending ?? '—'}</b>
          {' · '}leased <b className="text-violet-500">{laravelLeased ?? '—'}</b>
        </span>
        <span title="Worker totals (this process)">
          claimed <b className="text-slate-700 dark:text-slate-300">{totalClaimed ?? 0}</b>
          {' · '}ok <b className="text-emerald-500">{totalSucceeded ?? 0}</b>
          {' · '}fail <b className={totalFailed ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}>{totalFailed ?? 0}</b>
        </span>
      </div>

      {inFlight.length > 0 && (
        <div className="space-y-1.5">
          {inFlight.map((task, i) => (
            <div key={task.task_id ?? task.content_id ?? i}
              className="pc-glass p-2.5 text-[11px] font-mono text-teal-600 dark:text-teal-300">
              <span className="text-slate-400 uppercase text-[9px] tracking-wide mr-2">synthesizing</span>
              [{task.language}] p={task.priority} · {preview(task.content as string, 96)}
              {(task.variant_count ?? 0) > 1 && (
                <span className="ml-2 text-sky-400">
                  · variant {task.current_variant_index}/{task.variant_count}
                  {' '}({task.current_variant_key || 'primary'})
                  {' '}via <b>{task.current_provider || 'pending'}</b>
                </span>
              )}
            </div>
          ))}
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
          <p className="p-4 text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> loading…</p>
        ) : !items.length ? (
          <p className="p-4 text-xs text-slate-400">{t('queueCenter.sentenceQueue.empty')}</p>
        ) : (
          <ul className="divide-y divide-slate-500/10 max-h-[320px] overflow-y-auto">
            {items.slice(0, 100).map((row) => {
              const key = `${row.language}:${row.content_id}`;
              const bumped = !!row.recently_bumped;
              const processing = !!row.processing;
              return (
                <li key={key}
                  className={`px-3 py-2 text-xs ${bumped ? 'ring-2 ring-inset ring-amber-400/50 bg-amber-500/5' : ''} ${processing ? 'bg-teal-500/5' : ''}`}>
                  <div className="flex items-start gap-2">
                    {processing
                      ? <Loader2 className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5 animate-spin" />
                      : bumped
                        ? <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        : null}
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 dark:text-slate-200 truncate" title={row.text}>{preview(row.text, 120)}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {row.language} · prio <b className="text-amber-500">{row.tts_priority ?? 0}</b>
                        {' · '}{processing ? 'synthesizing' : row.tts_status || 'pending'}
                        {row.tts_locked_by ? ` · ${row.tts_locked_by}` : ''}
                      </p>
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
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-500/10">
              <PcTagFilteredLog
                bare
                tags={['[TTSSentenceWorker]', '[qwen3tts]', '[managed]']}
                title={t('queueCenter.sentenceQueue.liveLog')}
                emptyHint="No qwen3tts / sentence-worker log lines yet."
              />
            </div>
          </div>
        )}
      </div>

      {/* Voice variants editor — the per-language accent/gender specs stored in
          Laravel's variant-specs table; they decide which sentences are claimable
          (a language with no specs generates nothing). */}
      <div className="pc-glass overflow-hidden">
        <button type="button" onClick={() => setVariantsOpen((v) => !v)}
          className="w-full px-3 py-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-slate-400 hover:bg-slate-500/5">
          <span className="flex items-center gap-2 flex-wrap">
            {t('queueCenter.sentenceQueue.variantsTitle')}
            {langPendingChips.length > 0 && (
              <span className="flex items-center gap-1 flex-wrap normal-case tracking-normal">
                {langPendingChips.map(([lang, count]) => (
                  <span key={lang} className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 font-mono text-[9px]">
                    {lang}:{count}
                  </span>
                ))}
              </span>
            )}
          </span>
          {variantsOpen ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
        </button>
        {variantsOpen && (
          <div className="p-2 border-t border-slate-500/10">
            <PcSentenceVoiceVariantsPanel />
          </div>
        )}
      </div>
    </div>
  );
};

export default PcSentenceQueuePanel;
