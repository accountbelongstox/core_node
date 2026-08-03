/**
 * PcTranslationQueuePanel — Laravel translation queue read and mutated through
 * the browser-owned Laravel API boundary.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ListOrdered, RefreshCcw, AlertTriangle, CheckCircle2, WifiOff, Wifi, Radio,
  Clock, Languages, ChevronUp, ChevronsUp, ChevronDown, Flame, Zap, User,
} from 'lucide-react';
import type { TranslationQueueItem, TranslationQueueSummary, PycoreGlobalTaskDetail } from '@/apps/pycore-manager/api';
import {
  GLOBAL_TASK_STATUSES_BY_ROLE,
  GLOBAL_TASK_TYPE_BY_KEY,
} from '@/apps/pycore-manager/api';
import { PcGlobalTaskDetailModal } from '../components/PcTaskDetailModal';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';
import { usePycoreTaskCenterState } from '../hooks/TaskCenterState';
import type { QueueCenterPanelProps } from '../utils/pcQueueCenterTypes';

const EMPTY_SUMMARY: TranslationQueueSummary = {
  pending: 0, processing: 0, leased: 0, completed: 0, failed: 0, total: 0, missing_dictionary_words: 0,
};

function ageLabel(seconds: number): string {
  if (seconds == null || seconds < 0) return '-';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function wordsLabel(words: string[]): string {
  if (!words || words.length === 0) return '-';
  const head = words.slice(0, 3).join(', ');
  return words.length > 3 ? `${head} +${words.length - 3}` : head;
}

/** Contract with PcQueueCenterPage. */
type PanelProps = QueueCenterPanelProps;

const PcTranslationQueuePanel: React.FC<PanelProps> = () => {
  const hub = useQueueCenterHub();
  const state = usePycoreTaskCenterState();
  const { laravelStoredEndpoint, laravelActiveEndpoint, hubState, diagnostics } = hub;
  const laravelEndpoint = laravelStoredEndpoint || laravelActiveEndpoint;
  const snap = hub.translationQueue;
  const items: TranslationQueueItem[] | null = snap?.items ?? null;
  const summary: TranslationQueueSummary = snap?.summary ?? EMPTY_SUMMARY;
  const eventConnected = snap?.event_connected ?? null;
  const error = hub.sliceErrors.translation ?? snap?.error ?? null;
  const loading = hubState === 'loading' && snap === null;

  const [stackWords, setStackWords] = useState('');
  const [stackLang, setStackLang] = useState('en');
  const [stackTarget, setStackTarget] = useState('zh');

  const [selectedItem, setSelectedItem] = useState<TranslationQueueItem | null>(null);

  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  /*
   * [gpt-5.3-codex-spark:LEGACY-START]
   * { onMeta?.({ count: snap ? summary.pending : null, loading: loading || refreshing }); }
   * [gpt-5.3-codex-spark:LEGACY-END]
   */

  // Force Laravel's monitor once after a mutation, then refresh the shared snapshot.
  const fetchQueue = useCallback(async (refresh: boolean) => {
    await state.fetchTranslationQueue(refresh, hub.refreshHub);
  }, [state, hub]);

  const changePriority = useCallback(async (it: TranslationQueueItem, next: number) => {
    await state.changeTranslationPriority(it.task_id, next, hub.promoteTranslationTask);
  }, [state, hub]);

  const submitStack = useCallback(async () => {
    await state.submitTranslationStack(stackWords, stackLang, stackTarget, hub.refreshHub);
    setStackWords('');
  }, [stackWords, stackLang, stackTarget, state, hub]);

  const openTaskDetail = useCallback(async (it: TranslationQueueItem) => {
    setSelectedItem(it);
    await state.openTranslationTaskDetail(it.task_id, {
      task_id: it.task_id,
      app_name: '—',
      task_type: GLOBAL_TASK_TYPE_BY_KEY.word_translation.key,
      execution_type: GLOBAL_TASK_TYPE_BY_KEY.word_translation.execution_type,
      status: it.status,
      progress: it.status === GLOBAL_TASK_STATUSES_BY_ROLE.completed ? 100 : 0,
      assigned_to: it.assigned_to,
      created_at: it.created_at,
      updated_at: null,
      payload: { words: it.words, language: it.language, target_language: it.target_language, priority: it.priority },
    });
  }, [state]);

  const closeTaskDetail = useCallback(() => {
    setSelectedItem(null);
    state.closeTranslationTaskDetail();
  }, [state]);

  const inputCls = 'w-full rounded-xl px-3 py-2 text-sm border outline-none transition bg-white dark:bg-white/5 border-slate-300 dark:border-white/10 focus:border-sky-400 text-slate-700 dark:text-zinc-200';
  const stat = 'rounded-2xl p-4 border bg-slate-100/60 dark:bg-white/5 border-slate-300/35 dark:border-white/5';

  const chip = (label: string, value: number, cls: string) => (
    <div className={stat}>
      <div className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-0.5">{label}</div>
    </div>
  );

  const list = items ?? [];

  return (
    <div className="space-y-5">
      <section className="pc-glass p-6">
        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <ListOrdered className="w-4 h-4 text-sky-500" /> Missing word translations
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500">{summary.missing_dictionary_words ?? summary.pending}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Laravel owns the queue; pycore translates with Google first and shared fallbacks.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${eventConnected === true ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400'}`}>
                <Radio className="w-3 h-3" />
                HTTP Events: {eventConnected === true ? 'Online' : 'Offline'}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${hubState === 'ready' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
                Queue Source: {hubState === 'ready' ? 'Reachable' : hubState === 'error' ? 'Unreachable' : 'Unknown'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {eventConnected && (snap?.event_count ?? 0) === 0
                ? 'HTTP API Online / Queue snapshot: waiting for first successful poll'
                : `Queue Count: ${summary.total} | Event Count: ${snap?.event_count ?? 0}`}
            </div>
          </div>
        </div>

        {hubState !== 'ready' && hubState !== 'loading' && (
          <div className={`mb-4 flex items-start gap-2 text-xs rounded-2xl p-3 border ${hubState === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'}`}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="break-words font-bold">
                {hubState === 'error' ? 'Backend unreachable' : 'Backend degraded'}
                {laravelEndpoint ? <> at <span className="font-mono">{laravelEndpoint}</span></> : null}
              </span>
              {error && <span className="break-words">{error}</span>}
              {diagnostics && (
                <div className="mt-1 font-mono text-[10px] opacity-80">
                  HTTP {diagnostics.http_status ?? 'N/A'} • {diagnostics.response_time_ms ?? 'N/A'}ms
                </div>
              )}
            </div>
          </div>
        )}

        {/* summary stat chips */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          {chip('Queued Pending', summary.pending, 'text-sky-500')}
          {chip('Processing', summary.processing, 'text-violet-500')}
          {chip('Leased', summary.leased, 'text-amber-500')}
          {chip('Completed', summary.completed, 'text-emerald-500')}
          {chip('Failed', summary.failed, 'text-rose-500')}
        </div>

        {loading && list.length === 0 ? (
          <div className="text-xs text-slate-500 py-8 text-center flex flex-col items-center gap-2">
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" />
            Loading queue…
          </div>
        ) : list.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
            {(summary.missing_dictionary_words ?? 0) > 0 && summary.pending === 0
              ? '有缺词但尚未入队'
              : 'The translation queue is empty.'}
          </div>
        ) : (
          <ul className="space-y-1.5 max-h-[480px] overflow-y-auto">
            {list.map((it) => {
              const busy = state.translationBusyTask === it.task_id;
              return (
                <li key={it.task_id}
                  onClick={() => openTaskDetail(it)}
                  className={`${stat} flex items-center gap-3 transition cursor-pointer hover:border-sky-400/40 ${it.recently_bumped ? 'ring-2 ring-amber-400/70 animate-pulse border-amber-400/40' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-sky-500/15 text-sky-500 tabular-nums" title="Priority">
                        <Flame className="w-3 h-3" /> {it.priority}
                      </span>
                      <span className="text-sm font-bold text-slate-700 dark:text-zinc-200 truncate" title={it.words?.join(', ')}>
                        {wordsLabel(it.words)}
                      </span>
                      {it.recently_bumped && (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-amber-500/20 text-amber-500">
                          <Zap className="w-3 h-3" /> bumped
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1" title="Status">
                        {it.status === 'pending' ? <ListOrdered className="w-3 h-3" /> :
                          it.status === 'processing' || it.status === 'assigned' ? <RefreshCcw className="w-3 h-3 animate-spin" /> :
                            <CheckCircle2 className="w-3 h-3" />}
                        <span className="font-mono">{it.status}</span>
                      </span>
                      <span className="inline-flex items-center gap-1" title="Translation">
                        <Languages className="w-3 h-3" />
                        <span className="font-mono">{it.language} → {it.target_language}</span>
                      </span>
                      <span className="inline-flex items-center gap-1" title="Age">
                        <Clock className="w-3 h-3" />
                        <span className="font-mono">{ageLabel(it.age_seconds)}</span>
                      </span>
                      {it.assigned_to && (
                        <span className="inline-flex items-center gap-1" title="Assigned to">
                          <User className="w-3 h-3" />
                          <span className="font-mono truncate max-w-[8rem]">{it.assigned_to}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => changePriority(it, it.priority + 1)} disabled={busy}
                      title="Raise priority"
                      className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 transition disabled:opacity-40">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => changePriority(it, it.priority + 10)} disabled={busy}
                      title="Boost priority"
                      className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 transition disabled:opacity-40">
                      <ChevronsUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => changePriority(it, Math.max(0, it.priority - 1))} disabled={busy || it.priority <= 0}
                      title="Lower priority"
                      className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 transition disabled:opacity-40">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {state.translationNotice && (
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{state.translationNotice}</p>
        )}
      </section>

      {/* stack control card */}
      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 mb-1 text-slate-800 dark:text-slate-100">
          <Zap className="w-4 h-4 text-amber-500" /> Stack words
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Dedup + bump existing words, or enqueue new ones at high priority.
        </p>
        <textarea
          value={stackWords}
          onChange={(e) => setStackWords(e.target.value)}
          placeholder="words, separated by commas or new lines"
          rows={2}
          className={`${inputCls} resize-y mb-3`} />
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1 text-[11px] text-slate-500">
            Source language
            <input value={stackLang} onChange={(e) => setStackLang(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <label className="flex-1 text-[11px] text-slate-500">
            Target language
            <input value={stackTarget} onChange={(e) => setStackTarget(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <button onClick={submitStack} disabled={state.translationStacking}
            className="self-end px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 shrink-0">
            <Zap className={`w-3.5 h-3.5 ${state.translationStacking ? 'animate-pulse' : ''}`} /> Stack
          </button>
        </div>
      </section>

      {selectedItem && (
        <PcGlobalTaskDetailModal
          task={state.translationTaskDetail}
          loading={state.translationDetailLoading}
          onClose={closeTaskDetail}
        />
      )}
    </div>
  );
};

export default PcTranslationQueuePanel;
