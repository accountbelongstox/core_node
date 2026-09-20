/**
 * Orchestration manifest drill-down panel: pages the persisted manifest of one
 * task (ui/audio_orch/task/manifest_page) so every stats counter in the task
 * list (cache / Laravel / generated / synced / missing / pending) expands to
 * the exact resources behind it — text, kind/language, source and provider
 * (local generation shows the qwen TTS backend that produced the clip).
 *
 * Reuses the global PcFloatingPanel + PcPager; all data comes from the pycore
 * orch_store manifest, nothing is re-derived on the UI side.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  pycoreApi,
  type OrchManifestCategory,
  type OrchManifestItem,
} from '@/apps/pycore-manager/api';
import PcFloatingPanel from '../../../components/PcFloatingPanel';
import PcPager from '../../agent-history/PcPager';
import { humanInt } from '../vocabShared';
import { ORCH_L, orchErrorMessage } from './orchShared';

const PAGE_SIZE = 50;

const CATEGORIES: Array<{ key: OrchManifestCategory; label: () => string }> = [
  { key: 'all', label: () => ORCH_L.catAll },
  { key: 'cache', label: () => ORCH_L.manifestCache },
  { key: 'laravel', label: () => ORCH_L.manifestLaravel },
  { key: 'generated', label: () => ORCH_L.manifestGenerated },
  { key: 'synced', label: () => ORCH_L.manifestSynced },
  { key: 'missing', label: () => ORCH_L.manifestMissing },
  { key: 'pending', label: () => ORCH_L.catPending },
];

function sourceLabel(item: OrchManifestItem): string {
  if (item.status === 'pending') return ORCH_L.catPending;
  if (item.status === 'missing') return ORCH_L.manifestMissing;
  if (item.source === 'cache') return ORCH_L.manifestCache;
  if (item.source === 'laravel') return ORCH_L.manifestLaravel;
  if (item.source === 'generated') return ORCH_L.manifestGenerated;
  return ORCH_L.done;
}

function sourceBadgeClass(item: OrchManifestItem): string {
  if (item.status === 'pending') return 'bg-slate-500/15 text-slate-400';
  if (item.status === 'missing') return 'bg-amber-500/15 text-amber-400';
  if (item.source === 'cache') return 'bg-sky-500/15 text-sky-400';
  if (item.source === 'laravel') return 'bg-violet-500/15 text-violet-400';
  return 'bg-emerald-500/15 text-emerald-400';
}

const pagerTk = (key: string): string => String(ORCH_L[key as keyof typeof ORCH_L] || key);

const OrchManifestPanel: React.FC<{
  open: boolean;
  taskId: string;
  taskName: string;
  initialCategory: OrchManifestCategory;
  running?: boolean;
  onClose: () => void;
}> = ({ open, taskId, taskName, initialCategory, running, onClose }) => {
  const [category, setCategory] = useState<OrchManifestCategory>(initialCategory);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<OrchManifestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cat: OrchManifestCategory, targetPage: number) => {
    setLoading(true);
    try {
      const response = await pycoreApi.orchTaskManifestPage(taskId, cat, targetPage, PAGE_SIZE);
      if (!response.success) throw new Error(response.error || ORCH_L.loadFailed);
      setItems(response.items || []);
      setTotal(response.total || 0);
      setPageCount(response.page_count || 1);
      setPage(response.page || 1);
      setError(null);
    } catch (e) {
      setError(orchErrorMessage(e, ORCH_L.loadFailed));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!open) return;
    setCategory(initialCategory);
    setPage(1);
    void load(initialCategory, 1);
  }, [open, initialCategory, load]);

  // Live refresh while the task is generating so pending rows resolve in place.
  useEffect(() => {
    if (!open || !running) return;
    const timer = setInterval(() => void load(category, page), 5000);
    return () => clearInterval(timer);
  }, [open, running, category, page, load]);

  const pickCategory = (next: OrchManifestCategory) => {
    setCategory(next);
    setPage(1);
    void load(next, 1);
  };

  const changePage = (next: number) => {
    void load(category, next);
  };

  return (
    <PcFloatingPanel
      open={open}
      title={`${ORCH_L.manifestPanelTitle} — ${taskName}`}
      subtitle={`${humanInt(total)} ${ORCH_L.items} · ${ORCH_L.manifestScope}`}
      onClose={onClose}
      closeLabel={ORCH_L.close}
      widthClass="max-w-5xl"
      footer={<PcPager page={page} totalPages={pageCount} onChange={changePage} tk={pagerTk} />}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => pickCategory(cat.key)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                category === cat.key
                  ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                  : 'border-slate-300 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-indigo-400/50'
              }`}
            >
              {cat.label()}
            </button>
          ))}
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
        </div>
        {error && <p className="text-[11px] text-rose-400">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="text-[11px] text-slate-500">{ORCH_L.manifestEmpty}</p>
        )}
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.resource_id}
              className="rounded-lg border border-slate-200 dark:border-white/10 px-2.5 py-1.5"
            >
              <div className="flex items-center gap-2">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${sourceBadgeClass(item)}`}>
                  {sourceLabel(item)}
                </span>
                <span className="shrink-0 text-[10px] font-mono text-slate-500">
                  {item.kind}/{item.language}
                </span>
                {item.provider && (
                  <span className="shrink-0 text-[10px] font-mono text-slate-500">{item.provider}</span>
                )}
                {(item.synced || item.sync_queued) && (
                  <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
                    {item.synced ? ORCH_L.manifestSynced : ORCH_L.syncingNow}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-700 dark:text-slate-300 break-words">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </PcFloatingPanel>
  );
};

export default OrchManifestPanel;
