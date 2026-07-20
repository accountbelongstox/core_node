/**
 * PcRecentTasksPanel — Queue Center Recent tab.
 * GET /api/local/tasks/recent
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  History, Loader2, AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, MinusCircle, Chrome, Cpu,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { PcTaskRecord } from '../../../core/api-libs/pycore';
import { extractAudioPath, PcTaskAudioPreview } from '../components/PcTaskAudioPreview';
import { PcTaskSynthInfo } from '../components/PcTaskSynthInfo';
import { mergeTaskResultSources } from '../utils/pcTaskResult';
import { humanBytes, relativeTime } from '../utils/pcFormat';
import type { QueueCenterPanelProps } from '../utils/pcQueueCenterTypes';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';

/** Status icon: green check for success, amber for released/skipped, red x else. */
const RecentStatusIcon: React.FC<{ rec: PcTaskRecord }> = ({ rec }) => {
  if (rec.success) return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (rec.status === 'released' || rec.status === 'skipped')
    return <MinusCircle className="w-4 h-4 text-amber-500 shrink-0" />;
  return <XCircle className="w-4 h-4 text-rose-500 shrink-0" />;
};

const PcRecentTasksPanel: React.FC<QueueCenterPanelProps> = ({ onMeta }) => {
  const { t } = useTranslation('pc');
  const hub = useQueueCenterHub();
  // Records/stats from the SHARED hub (unfiltered base list); the end+worker
  // filters are applied client-side below (`filtered`).
  const records = hub.recent?.records ?? [];
  const stats = hub.recent?.stats ?? null;
  const loading = hub.loading;
  const err = hub.pycoreReachable ? null : hub.error;
  const [endFilter, setEndFilter] = useState<string>('all');
  const [workerFilter, setWorkerFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    onMeta?.({
      count: hub.recent ? (stats?.total ?? hub.recent.count ?? records.length) : null,
      loading: hub.loading,
    });
  }, [hub.recent, stats, records.length, hub.loading, onMeta]);

  const clearHistory = useCallback(async () => {
    if (clearing) return;
    setClearing(true);
    setClearMsg(null);
    try {
      const r = await pycoreApi.clearRecentTasks();
      if (!mounted.current) return;
      if (r?.ok) setClearMsg(t('queueCenter.recent.cleared'));
      else setClearMsg(t('queueCenter.recent.clearFailed', { error: (r as any)?.error || 'unavailable' }));
      hub.refreshHub();
    } catch (e: any) {
      if (mounted.current) setClearMsg(t('queueCenter.recent.clearFailed', { error: e?.message || 'pycore unreachable' }));
    } finally {
      if (mounted.current) setClearing(false);
    }
  }, [clearing, hub, t]);

  // Distinct workers seen (for the worker filter chips).
  const workers = Array.from(new Set(records.map((r) => r.worker).filter(Boolean)));
  const filtered = records.filter((r) =>
    (endFilter === 'all' || r.end === endFilter) &&
    (workerFilter === 'all' || r.worker === workerFilter));

  if (!stats && records.length === 0) {
    return (
      <section className="pc-glass p-6 text-xs text-slate-500 flex items-center gap-2">
        {loading
          ? (<><Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> {t('queueCenter.recent.loading')}</>)
          : err
            ? (<><AlertTriangle className="w-4 h-4 text-amber-400" /> {err}</>)
            : (<><History className="w-4 h-4 text-slate-400" /> {t('queueCenter.recent.empty')}</>)}
      </section>
    );
  }

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
      active
        ? 'bg-indigo-500/15 text-indigo-500 ring-1 ring-inset ring-indigo-500/30'
        : 'pc-glass text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'}`;

  const ends = ['all', 'pycore', 'chrome'];

  return (
    <div className="space-y-4">
      {/* header + summary + clear */}
      <section className="pc-glass p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <History className="w-4 h-4 text-indigo-500 shrink-0" />
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('queueCenter.recent.title')}</h2>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <button onClick={clearHistory} disabled={clearing}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold pc-glass hover:bg-rose-500/10 text-rose-500 transition disabled:opacity-50"
              title={t('queueCenter.recent.clear')}>
              {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {clearing ? t('queueCenter.recent.clearing') : t('queueCenter.recent.clear')}
            </button>
            <button onClick={() => hub.refreshHub()} disabled={loading}
              className="p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50"
              title={t('queueCenter.recent.refresh')}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('queueCenter.recent.hint')}</p>
        <p className="text-[11px]">
          <Link to="/pycore-manager/task-log" className="text-indigo-500 hover:underline font-bold">
            {t('taskLog.openFromRecent')}
          </Link>
        </p>
        {stats && (
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] font-mono text-slate-500">
            <span>{t('queueCenter.recent.total')} <b className="text-slate-700 dark:text-slate-300">{stats.total}</b></span>
            <span>{t('queueCenter.recent.success')} <b className="text-emerald-500">{stats.success}</b></span>
            <span>{t('queueCenter.recent.failed')} <b className={stats.failed ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}>{stats.failed}</b></span>
            <span>{t('queueCenter.recent.postedBack')} <b className="text-sky-500">{stats.posted_back}</b></span>
          </div>
        )}
        {clearMsg && <p className="text-[11px] text-slate-500 dark:text-slate-400">{clearMsg}</p>}
        {err && <p className="text-[11px] text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" />{err}</p>}
      </section>

      {/* filter chips */}
      <section className="pc-glass p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide text-slate-400 shrink-0">{t('queueCenter.recent.filterEnd')}</span>
          {ends.map((e) => (
            <button key={e} onClick={() => setEndFilter(e)} className={chip(endFilter === e)}>
              {e === 'all' ? t('queueCenter.recent.all') : e}
            </button>
          ))}
        </div>
        {workers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-slate-400 shrink-0">{t('queueCenter.recent.filterWorker')}</span>
            <button onClick={() => setWorkerFilter('all')} className={chip(workerFilter === 'all')}>
              {t('queueCenter.recent.all')}
            </button>
            {workers.map((w) => (
              <button key={w} onClick={() => setWorkerFilter(w)} className={chip(workerFilter === w)}>{w}</button>
            ))}
          </div>
        )}
      </section>

      {/* table */}
      {filtered.length === 0 ? (
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
              {filtered.map((rec) => {
                const rowKey = `${rec.end}:${rec.seq}:${rec.task_id}`;
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
                          {rec.end === 'chrome'
                            ? <Chrome className="w-3 h-3 text-amber-500 shrink-0" />
                            : <Cpu className="w-3 h-3 text-indigo-500 shrink-0" />}
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
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${
                          rec.posted_back ? 'bg-sky-500/15 text-sky-500' : 'bg-slate-500/15 text-slate-400'}`}>
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
    </div>
  );
};

/** Expanded detail for one recent-task row. */
const PcRecentTaskDetail: React.FC<{ rec: PcTaskRecord }> = ({ rec }) => {
  const { t } = useTranslation('pc');
  const d = rec.detail ?? {};
  const merged = mergeTaskResultSources(undefined, d);
  const audioPath = extractAudioPath(merged);
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
    'filename', 'words', 'translations', 'failed_words', 'synth_command',
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
