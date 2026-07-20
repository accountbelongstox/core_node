/**
 * PcAiHistoryView — the unified "Usage History" tab inside the AI & Pycore
 * Capabilities page. It merges every usage-record store the backend keeps into
 * ONE newest-first feed: AI image generations (/ai/image/history), image searches
 * (/image-search/history), subtitle searches (/subtitle-search/history) and
 * translations (/translate/history). Each store is fetched in parallel, normalized
 * to a common row shape, merged and sorted by timestamp; a kind filter, per-row
 * delete and a per-kind / global clear sit on top.
 *
 * Every store shares the same backend discipline (PersistedHistoryStore — JSON ring
 * buffer under .data/.ai_state). This view never persists anything itself; delete /
 * clear call the matching pycoreApi endpoint and re-fetch. pycoreApi + lucide-react
 * + Tailwind / `.pc-glass` only.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  History, Image as ImageIcon, ScanSearch, Captions, Languages,
  Trash2, RefreshCcw, AlertTriangle,
} from 'lucide-react';
import { PcBlobImage } from './PcBlobMedia';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type {
  ImageHistoryEntry, ImageSearchHistoryEntry, SubtitleSearchHistoryEntry,
  TranslateHistoryEntry,
} from '../../../core/api-libs/pycore';
import AiUsagePanel from '../../../components/ai-tools/AiUsagePanel';

type HistKind = 'aiImage' | 'imageSearch' | 'subtitleSearch' | 'translate';

interface HistRow {
  kind: HistKind;
  id: string;
  ts: number;
  title: string;       // primary line (prompt / query / source text)
  subtitle: string;    // secondary line (provider·model / engine·count / langs)
  thumb?: string;      // image url (aiImage only)
}

const KIND_ICON: Record<HistKind, React.FC<{ className?: string }>> = {
  aiImage: ImageIcon, imageSearch: ScanSearch, subtitleSearch: Captions, translate: Languages,
};
const KIND_ACCENT: Record<HistKind, string> = {
  aiImage: 'text-fuchsia-500', imageSearch: 'text-sky-500',
  subtitleSearch: 'text-amber-500', translate: 'text-emerald-500',
};

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
const fmtTs = (t: number) => (t ? new Date(t).toLocaleString() : '—');

const PcAiHistoryView: React.FC<{ refreshSignal?: number }> = ({ refreshSignal }) => {
  const { t } = useTranslation('pc');
  const [rows, setRows] = useState<HistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const [filter, setFilter] = useState<HistKind | 'all'>('all');
  const [busy, setBusy] = useState(false);

  const results = useCallback((n: number) => t('ai.history.results', { n }), [t]);

  const load = useCallback(async () => {
    setLoading(true);
    // Each store is independent — allSettled so one offline endpoint (e.g. an old
    // pycore without /translate/history) never blanks the whole feed.
    const [img, imgSearch, subSearch, trans] = await Promise.allSettled([
      pycoreApi.getImageHistory(100),
      pycoreApi.getImageSearchHistory(100),
      pycoreApi.getSubtitleSearchHistory(100),
      pycoreApi.getTranslateHistory(100),
    ]);
    const out: HistRow[] = [];
    let anyOk = false;

    if (img.status === 'fulfilled') {
      anyOk = true;
      (img.value?.entries ?? []).forEach((e: ImageHistoryEntry) => out.push({
        kind: 'aiImage', id: e.id, ts: e.ts,
        title: trunc(e.prompt || '(no prompt)', 120),
        subtitle: [e.provider, e.model].filter(Boolean).join(' · ') || e.size || '',
        thumb: pycoreApi.imageHistoryFileUrl(e.id),
      }));
    }
    if (imgSearch.status === 'fulfilled') {
      anyOk = true;
      (imgSearch.value?.entries ?? []).forEach((e: ImageSearchHistoryEntry) => out.push({
        kind: 'imageSearch', id: e.id, ts: e.ts,
        title: trunc(e.query || '', 120),
        subtitle: [e.engine, results(e.result_count ?? 0)].filter(Boolean).join(' · '),
      }));
    }
    if (subSearch.status === 'fulfilled') {
      anyOk = true;
      (subSearch.value?.entries ?? []).forEach((e: SubtitleSearchHistoryEntry) => out.push({
        kind: 'subtitleSearch', id: e.id, ts: e.ts,
        title: trunc(e.query || '', 120),
        subtitle: [(e.languages ?? []).join(', '), results(e.result_count ?? 0)].filter(Boolean).join(' · '),
      }));
    }
    if (trans.status === 'fulfilled') {
      anyOk = true;
      (trans.value?.entries ?? []).forEach((e: TranslateHistoryEntry) => out.push({
        kind: 'translate', id: e.id, ts: e.ts,
        title: trunc(e.text || '', 120),
        subtitle: `${e.source || '?'} → ${e.target || '?'} · ${e.engine || ''}${e.result ? ` · ${trunc(e.result, 60)}` : ''}`,
      }));
    }

    out.sort((a, b) => b.ts - a.ts);
    setRows(out);
    setUnreachable(!anyOk);
    setLoading(false);
  }, [results]);

  useEffect(() => { load(); }, [load, refreshSignal]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, aiImage: 0, imageSearch: 0, subtitleSearch: 0, translate: 0 };
    rows.forEach((r) => { c[r.kind] += 1; });
    return c;
  }, [rows]);

  const shown = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.kind === filter)),
    [rows, filter],
  );

  const deleteRow = useCallback(async (r: HistRow) => {
    setBusy(true);
    try {
      if (r.kind === 'aiImage') await pycoreApi.deleteImageHistory(r.id);
      else if (r.kind === 'imageSearch') await pycoreApi.deleteImageSearchHistory(r.id);
      else if (r.kind === 'subtitleSearch') await pycoreApi.deleteSubtitleSearchHistory(r.id);
      else await pycoreApi.deleteTranslateHistory(r.id);
      setRows((prev) => prev.filter((x) => !(x.kind === r.kind && x.id === r.id)));
    } catch { /* ignore — re-fetch below covers it */ }
    finally { setBusy(false); }
  }, []);

  const clearKind = useCallback(async (kind: HistKind) => {
    if (kind === 'aiImage') await pycoreApi.clearImageHistory();
    else if (kind === 'imageSearch') await pycoreApi.clearImageSearchHistory();
    else if (kind === 'subtitleSearch') await pycoreApi.clearSubtitleSearchHistory();
    else await pycoreApi.clearTranslateHistory();
  }, []);

  const clearAll = useCallback(async () => {
    if (!window.confirm(t('ai.history.clearConfirm'))) return;
    setBusy(true);
    try {
      if (filter === 'all') {
        await Promise.allSettled([
          pycoreApi.clearImageHistory(), pycoreApi.clearImageSearchHistory(),
          pycoreApi.clearSubtitleSearchHistory(), pycoreApi.clearTranslateHistory(),
        ]);
      } else {
        await clearKind(filter);
      }
      await load();
    } finally { setBusy(false); }
  }, [filter, clearKind, load, t]);

  const FILTERS: Array<{ key: HistKind | 'all'; label: string }> = [
    { key: 'all', label: t('ai.history.all') },
    { key: 'aiImage', label: t('nav.aiImage') },
    { key: 'imageSearch', label: t('ai.tabs.imageSearch') },
    { key: 'subtitleSearch', label: t('ai.tabs.subtitleSearch') },
    { key: 'translate', label: t('ai.tabs.translate') },
  ];

  return (
    <div className="space-y-4">
      {/* Global AI usage (shared cross-runtime store: text / vision / probe). The
          getAiUsage client already wraps the raw {success,stats,entries} into the
          {success,data,error} envelope AiUsagePanel reads, so it mounts unchanged. */}
      <AiUsagePanel
        title={t('ai.history.usageTitle')}
        fetchUsage={(limit) => pycoreApi.getAiUsage(limit)}
      />

      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <History className="w-4 h-4 text-indigo-500" /> {t('ai.history.title')}
            <span className="text-xs font-normal text-slate-400">{t('ai.history.records', { n: rows.length })}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('ai.history.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} title={t('common.refresh')}
            className="px-3 py-2 pc-glass hover:bg-indigo-500/10 text-xs font-bold rounded-xl flex items-center gap-1 transition text-slate-700 dark:text-slate-200">
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('common.refresh')}
          </button>
          <button onClick={clearAll} disabled={busy || !shown.length}
            className="px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1 transition bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 disabled:opacity-40">
            <Trash2 className="w-3.5 h-3.5" /> {filter === 'all' ? t('ai.history.clearAll') : t('ai.history.clearKind')}
          </button>
        </div>
      </div>

      {unreachable && (
        <div className="flex items-start gap-2 text-xs rounded-xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-500">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{t('ai.history.unreachable')}</span>
        </div>
      )}

      {/* filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
              filter === key ? 'bg-indigo-500/15 text-indigo-500'
                : 'text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
            }`}>
            {label} <span className="opacity-60">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* feed */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {shown.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-center text-xs text-slate-500 px-6">
            {loading ? '…' : t('ai.history.empty')}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/70 max-h-[560px] overflow-auto">
            {shown.map((r) => {
              const Icon = KIND_ICON[r.kind];
              return (
                <li key={`${r.kind}:${r.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-100/50 dark:hover:bg-white/5 transition">
                  {r.thumb ? (
                    <PcBlobImage path={r.thumb} alt="" loading="lazy"
                      className="w-10 h-10 rounded-lg object-cover bg-slate-200 dark:bg-slate-800 shrink-0" />
                  ) : (
                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 shrink-0 ${KIND_ACCENT[r.kind]}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                      <Icon className={`w-3 h-3 shrink-0 ${KIND_ACCENT[r.kind]}`} />
                      {r.title || '—'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{r.subtitle}</div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 hidden sm:block">{fmtTs(r.ts)}</span>
                  <button onClick={() => deleteRow(r)} disabled={busy} title={t('ai.history.deleteTitle')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition shrink-0 disabled:opacity-40">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PcAiHistoryView;
