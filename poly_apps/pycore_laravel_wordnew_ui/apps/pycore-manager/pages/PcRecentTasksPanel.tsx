/**
 * Persistent completed-task history grouped by canonical cross-end task_type.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  History, Loader2, AlertTriangle, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, MinusCircle, Database, Download,
} from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { PcTaskRecord } from '@/apps/pycore-manager/api';
import { extractAudioPath, PcTaskAudioPreview } from '../components/PcTaskAudioPreview';
import { PcTaskSynthInfo } from '../components/PcTaskSynthInfo';
import { mergeTaskResultSources } from '../utils/pcTaskResult';
import { humanBytes, relativeTime } from '../utils/pcFormat';
import type { QueueCenterPanelProps } from '../utils/pcQueueCenterTypes';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';
import { usePycoreTaskCenterState, type CompletedTaskType, type CanonicalCompletedTaskType } from '../hooks/TaskCenterState';

/** Status icon: green check for success, amber for released/skipped, red x else. */
const RecentStatusIcon: React.FC<{ rec: PcTaskRecord }> = ({ rec }) => {
  if (rec.success) return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (rec.status === 'released' || rec.status === 'skipped')
    return <MinusCircle className="w-4 h-4 text-amber-500 shrink-0" />;
  return <XCircle className="w-4 h-4 text-rose-500 shrink-0" />;
};

const COMPLETED_TASK_TYPE_LABEL_KEY: Record<CanonicalCompletedTaskType, string> = {
  word_audio: 'wordAudio',
  sentence_audio: 'sentenceAudio',
  translation: 'translation',
  assist: 'assist',
  media_image: 'mediaImage',
};

const PcRecentTasksPanel: React.FC<QueueCenterPanelProps> = () => {
  const { t } = useTranslation('pc');
  const hub = useQueueCenterHub();
  const state = usePycoreTaskCenterState();
  const [selectedType, setSelectedType] = useState<CompletedTaskType>('all');
  const [showAll, setShowAll] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const selectedCanonicalType = useMemo<CanonicalCompletedTaskType | null>(() => {
    if (selectedType === 'all') return null;
    return selectedType;
  }, [selectedType]);

  const visibleRecords = useMemo(
    () => showAll
      ? state.recentRecords
      : state.recentRecords.filter((record) => selectedCanonicalType && (
        record.task_type.includes(selectedCanonicalType.split('_')[0]) // Simplified check for UI
      )),
    [state.recentRecords, showAll, selectedCanonicalType],
  );

  const chipLabel = useCallback((taskType: Exclude<CompletedTaskType, 'all'>) => (
    t(`queueCenter.recent.type.${COMPLETED_TASK_TYPE_LABEL_KEY[taskType]}`)
  ), [t]);

  const typeEntries = useMemo(
    () => (Object.keys(state.recentTypes) as CanonicalCompletedTaskType[]).map((taskType) => [taskType, state.recentTypes[taskType] || 0] as const),
    [state.recentTypes],
  );

  const total = useMemo(
    () => Object.values(state.recentTypes).reduce((sum, count) => sum + count, 0),
    [state.recentTypes],
  );
  const visibleTotal = useMemo(
    () => (showAll ? total : (selectedCanonicalType ? state.recentTypes[selectedCanonicalType] || 0 : total)),
    [showAll, selectedCanonicalType, total, state.recentTypes],
  );

  useEffect(() => { void state.initialSync(); }, [state]);
  const syncArchive = useCallback(async () => {
    await state.syncArchive();
  }, [state]);

  const loadMore = useCallback(async () => {
    await state.loadMoreArchive();
  }, [state]);

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${active
      ? 'bg-indigo-500/15 text-indigo-500 ring-1 ring-inset ring-indigo-500/30'
      : 'pc-glass text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
    }`;

  if (state.recentLoading && visibleRecords.length === 0) {
    return (
      <section className="pc-glass p-6 text-xs text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> {t('queueCenter.recent.loading')}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and persistent cache state. */}
      <section className="pc-glass p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <History className="w-4 h-4 text-indigo-500 shrink-0" />
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('queueCenter.recent.title')}</h2>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <button onClick={syncArchive} disabled={state.recentSyncing}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50"
              title={t('queueCenter.recent.refreshPageHint')}>
              {state.recentSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              {state.recentSyncing ? t('queueCenter.recent.refreshingPage') : t('queueCenter.recent.refreshPage')}
            </button>
            <button onClick={() => hub.refreshHub()} disabled={state.recentLoading || hub.loading}
              className="p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50"
              title={t('queueCenter.recent.refresh')}>
              <RefreshCw className={`w-3.5 h-3.5 ${state.recentLoading || hub.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('queueCenter.recent.hint')}</p>
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] font-mono text-slate-500">
          <span>{t('queueCenter.recent.total')} <b className="text-slate-700 dark:text-slate-300">{total}</b></span>
          <span>{t('queueCenter.recent.lastRefresh')} <b className="text-slate-700 dark:text-slate-300">{state.recentLastSyncAt ? relativeTime(state.recentLastSyncAt) : t('queueCenter.recent.never')}</b></span>
        </div>
        {state.recentErr && <p className="text-[11px] text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" />{state.recentErr}</p>}
      </section>

      {/* task_type is the canonical completed-history dimension. */}
      <section className="pc-glass p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 cursor-pointer">
            <input type="checkbox" checked={showAll} disabled={state.recentRecords.length === 0} onChange={(event) => {
              const next = event.target.checked;
              setShowAll(next);
              if (!next && selectedType === 'all' && typeEntries.length > 0) {
                setSelectedType(typeEntries[0][0]);
              }
            }} />
            {t('queueCenter.recent.showAll')}
          </label>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setShowAll(true); setSelectedType('all'); }}
            className={chip(showAll)}
          >
            {t('queueCenter.recent.all')} ({total})
          </button>
          {typeEntries.map(([taskType, count]) => (
            <button
              key={taskType}
              onClick={() => { setShowAll(false); setSelectedType(taskType); }}
              className={chip(!showAll && selectedType === taskType)}
            >
              {chipLabel(taskType)} ({count})
            </button>
          ))}
        </div>
      </section>

      {/* table */}
      {visibleRecords.length === 0 ? (
        <section className="pc-glass p-6 text-xs text-slate-500">{t('queueCenter.recent.empty')}</section>
      ) : (
        <section className="pc-glass p-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                <th className="px-2 py-1.5 font-semibold w-8"></th>
                <th className="px-2 py-1.5 font-semibold">{t('queueCenter.recent.colWorker')}</th>
                <th className="px-2 py-1.5 font-semibold">{t('queueCenter.recent.colTitle')}</th>
                <th className="px-2 py-1.5 font-semibold">{t('queueCenter.recent.colLanguage')}</th>
                <th className="px-2 py-1.5 font-semibold">{t('queueCenter.recent.colSource')}</th>
                <th className="px-2 py-1.5 font-semibold">{t('queueCenter.recent.colPosted')}</th>
                <th className="px-2 py-1.5 font-semibold text-right">{t('queueCenter.recent.colLatency')}</th>
                <th className="px-2 py-1.5 font-semibold text-right">{t('queueCenter.recent.colTime')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((rec) => {
                const rowKey = String(rec.archive_id || `${rec.end}:${rec.seq}:${rec.task_id}`);
                const isOpen = !!expanded[rowKey];
                return (
                  <React.Fragment key={rowKey}>
                    <tr onClick={() => setExpanded((p) => ({ ...p, [rowKey]: !isOpen }))}
                      className="border-t border-slate-200/40 dark:border-white/5 hover:bg-slate-100/50 dark:hover:bg-white/5 cursor-pointer">
                      <td className="px-2 py-1.5 align-middle">
                        <div className="flex items-center gap-1">
                          {isOpen ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                          <RecentStatusIcon rec={rec} />
                        </div>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <div className="flex items-center gap-1 min-w-0">
                          <Database className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate" title={`${rec.end}/${rec.worker}:${rec.task_type}`}>
                            {rec.worker}<span className="text-slate-400">:{rec.task_type}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <span className="text-xs text-slate-700 dark:text-slate-200 truncate block max-w-[16rem]"
                          title={(rec as any).content || rec.title}>
                          {(rec as any).content || rec.title || '—'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <span className="text-[11px] font-mono text-slate-500">{rec.language || '—'}</span>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <span className="text-[11px] font-mono text-slate-400 truncate block max-w-[12rem]" title={rec.source_api}>{rec.source_api || '—'}</span>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${rec.posted_back ? 'bg-sky-500/15 text-sky-500' : 'bg-slate-500/15 text-slate-400'
                          }`}>
                          {rec.posted_back ? t('queueCenter.recent.posted') : t('queueCenter.recent.notReturned')}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 align-middle text-right">
                        <span className="text-[11px] font-mono text-slate-500">{rec.latency_ms != null ? `${rec.latency_ms}ms` : '—'}</span>
                      </td>
                      <td className="px-2 py-1.5 align-middle text-right">
                        <span className="text-[11px] font-mono text-slate-400" title={rec.ts}>{relativeTime(rec.ts)}</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-100/40 dark:bg-white/[0.03]">
                        <td colSpan={8} className="px-4 py-3">
                          <PcRecentTaskDetail rec={rec} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      {state.recentNextCursorId != null && (
        <div className="flex justify-center">
          <button type="button" onClick={loadMore} disabled={state.recentLoading}
            className="px-3 py-1.5 rounded-xl pc-glass text-xs font-bold text-indigo-500 hover:bg-indigo-500/10 disabled:opacity-50">
            {state.recentLoading ? t('queueCenter.recent.loading') : t('queueCenter.recent.loadMore', { loaded: visibleRecords.length, total: visibleTotal })}
          </button>
        </div>
      )}
    </div>
  );
};

/** Cached archive audio transferred through its dedicated HTTP API route. */
const PcCompletedArchiveAudio: React.FC<{ cacheKey: string }> = ({ cacheKey }) => {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSource(null);
    setError(null);
    void pycoreApi.getCompletedTaskResourceDataUrl(cacheKey)
      .then((value) => { if (active) setSource(value); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Audio load failed');
      });
    return () => { active = false; };
  }, [cacheKey]);

  if (error) return <p className="text-[10px] text-rose-500">{error}</p>;
  if (!source) return <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />;
  return <audio controls preload="none" className="w-full max-w-md" src={source} />;
};

/** Expanded detail for one recent-task row. */
const PcRecentTaskDetail: React.FC<{ rec: PcTaskRecord }> = ({ rec }) => {
  const { t } = useTranslation('pc');
  const d = rec.detail ?? {};
  const merged = mergeTaskResultSources(undefined, d);
  const cachedAudio = rec.resources?.find((resource) => resource.cached && resource.cache_key && resource.mime?.startsWith('audio/'));
  const audioPath = cachedAudio ? null : extractAudioPath(merged);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const downloadResource = useCallback(async (cacheKey: string, mime?: string) => {
    setResourceError(null);
    try {
      const source = await pycoreApi.getCompletedTaskResourceDataUrl(cacheKey);
      const link = document.createElement('a');
      const extension = mime?.split('/')[1]?.replace(/[^a-z0-9]+/gi, '') || 'bin';
      link.href = source;
      link.download = `queue-center-resource.${extension}`;
      link.click();
    } catch (reason: unknown) {
      setResourceError(reason instanceof Error ? reason.message : 'Resource download failed');
    }
  }, []);
  const field = (label: string, value: React.ReactNode) => (
    <div key={label} className="min-w-0">
      <div className="text-[9px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-[11px] text-slate-700 dark:text-slate-300 break-words">{value}</div>
    </div>
  );
  const fields: React.ReactNode[] = [];
  const push = (label: string, value: React.ReactNode) => { if (value != null && value !== '') fields.push(field(label, value)); };

  push(t('queueCenter.recent.text'), d.text);
  push(t('queueCenter.recent.translation'), d.translation);
  push(t('queueCenter.recent.provider'), d.provider);
  push(t('queueCenter.recent.model'), d.model);
  push(t('queueCenter.recent.engine'), d.engine);
  push(t('queueCenter.recent.voice'), d.voice);
  push(t('queueCenter.recent.audioSize'), typeof d.audio_bytes === 'number' ? humanBytes(d.audio_bytes) : undefined);
  push(t('queueCenter.recent.imageSize'), typeof d.image_bytes === 'number' ? humanBytes(d.image_bytes) : undefined);
  push(t('queueCenter.recent.wordCount'), typeof d.word_count === 'number' ? String(d.word_count) : undefined);
  push(t('queueCenter.recent.audioOk'), typeof d.audio_ok === 'number' ? String(d.audio_ok) : undefined);
  push(t('queueCenter.recent.audioFailed'), typeof d.audio_failed === 'number' ? String(d.audio_failed) : undefined);
  push(t('queueCenter.recent.mediaType'), d.media_type);
  push(t('queueCenter.recent.year'), d.year != null ? String(d.year) : undefined);
  push(t('queueCenter.recent.filename'), d.filename ? <span className="font-mono break-all">{d.filename}</span> : undefined);
  push(t('queueCenter.recent.taskId'), <span className="font-mono break-all">{rec.task_id}</span>);

  // Generic catch-all: every detail key NOT already rendered specially above.
  // Surfaces producer-specific fields (chrome bing/notebooklm/gemini, cover
  // prompt/size, tts speed, …) so non-assist tasks aren't near-empty on expand.
  // Keys rendered specially above. NOTE: 'mime'/'size'/'translated'/'skipped'
  // are intentionally NOT listed so the generic catch-all below surfaces them
  // (cover size, poster/gemini mime, word_translation translated/skipped counts,
  // chrome bing's translated flag) instead of swallowing them.
  const HANDLED_KEYS = new Set<string>([
    'text', 'translation', 'provider', 'model', 'engine', 'voice',
    'audio_path', 'audio_bytes', 'image_bytes', 'word_count',
    'audio_ok', 'audio_failed', 'media_type', 'year',
    'filename', 'words', 'translations', 'failed_words', 'synth_command', 'resources',
  ]);
  const otherDetail: [string, string][] = [];
  for (const [k, v] of Object.entries(d)) {
    if (HANDLED_KEYS.has(k) || v == null || v === '') continue;
    let text: string;
    if (Array.isArray(v)) text = `[${v.length}]`;
    else if (typeof v === 'object') text = JSON.stringify(v).slice(0, 120);
    else text = String(v);
    if (text !== '') otherDetail.push([k, text]);
  }

  return (
    <div className="space-y-3">
      {cachedAudio?.cache_key && (
        <PcCompletedArchiveAudio cacheKey={cachedAudio.cache_key} />
      )}
      {audioPath && (
        <PcTaskAudioPreview
          audioPath={audioPath}
          label={t('queueCenter.recent.audioAddress')}
        />
      )}

      {(typeof merged.engine === 'string' || typeof merged.synth_command === 'string' || rec.status === 'processing') && (
        <PcTaskSynthInfo
          engine={typeof merged.engine === 'string' ? merged.engine : null}
          synthCommand={typeof merged.synth_command === 'string' ? merged.synth_command : null}
          processing={rec.status === 'processing'}
        />
      )}

      {Array.isArray(rec.resources) && rec.resources.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-400 mb-1">Locally cached resources</div>
          <div className="flex flex-wrap gap-1.5">
            {rec.resources.map((resource, index) => resource.cached && resource.cache_key ? (
              <button type="button" key={`${resource.cache_key}:${index}`}
                onClick={() => { void downloadResource(resource.cache_key as string, resource.mime); }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/10 text-[10px] font-mono text-sky-600 hover:bg-sky-500/20"
                title={resource.source}>
                <Download className="w-3 h-3" />
                {resource.mime || 'resource'}{typeof resource.size === 'number' ? ` · ${humanBytes(resource.size)}` : ''}
              </button>
            ) : (
              <span key={`${resource.source}:${index}`}
                className="px-2 py-1 rounded-lg bg-rose-500/10 text-[10px] font-mono text-rose-500"
                title={resource.error || resource.source}>cache failed</span>
            ))}
          </div>
          {resourceError && <p className="mt-1 text-[10px] text-rose-500">{resourceError}</p>}
        </div>
      )}

      {fields.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">{fields}</div>
      )}

      {Array.isArray(d.words) && d.words.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-400 mb-1">{t('queueCenter.recent.words')}</div>
          <div className="flex flex-wrap gap-1">
            {d.words.map((w, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-500/10 text-[10px] font-mono text-slate-500"
                title={w.engine ? `${w.word} · ${w.engine}` : w.word}>
                {w.word}
                {typeof w.audio_bytes === 'number' && <b className="text-slate-700 dark:text-slate-300">{humanBytes(w.audio_bytes)}</b>}
              </span>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(d.translations) && d.translations.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-400 mb-1">{t('queueCenter.recent.translations')}</div>
          <ul className="space-y-0.5">
            {d.translations.map((tr, i) => (
              <li key={i} className="text-[10px] font-mono text-slate-500 truncate">
                <span className="text-slate-700 dark:text-slate-300">{tr.word}</span> → {tr.translation}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(d.failed_words) && d.failed_words.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wide text-rose-400 mb-1">{t('queueCenter.recent.failedWords')}</div>
          <div className="flex flex-wrap gap-1">
            {d.failed_words.map((w, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded-md bg-rose-500/10 text-[10px] font-mono text-rose-500">{w}</span>
            ))}
          </div>
        </div>
      )}

      {otherDetail.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-400 mb-1">{t('queueCenter.recent.otherDetail')}</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
            {otherDetail.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <div className="text-[9px] uppercase tracking-wide text-slate-400 break-all">{k}</div>
                <div className="text-[11px] font-mono text-slate-700 dark:text-slate-300 break-all">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rec.error && (
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
          <div className="text-[9px] uppercase tracking-wide font-semibold text-rose-500 mb-0.5">{t('queueCenter.recent.error')}</div>
          <div className="text-[11px] font-mono text-rose-600 dark:text-rose-400 whitespace-pre-wrap break-all">{rec.error}</div>
        </div>
      )}
    </div>
  );
};

export default PcRecentTasksPanel;
