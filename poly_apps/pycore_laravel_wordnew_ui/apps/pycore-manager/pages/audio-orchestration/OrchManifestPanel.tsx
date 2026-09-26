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
import { useTranslation } from 'react-i18next';
import { ArrowUpToLine, Loader2 } from 'lucide-react';
import {
  pycoreApi,
  type OrchManifestCategory,
  type OrchManifestItem,
} from '@/apps/pycore-manager/api';
import PcFloatingPanel from '../../components/PcFloatingPanel';
import PcPager from '../agent-history/PcPager';
import { humanInt } from '../vocabulary/vocabShared';
import { ORCH_L, orchErrorMessage } from './orchShared';
import { absoluteTime } from '../../utils/pcFormat';

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
  const { t } = useTranslation('pc');
  const [category, setCategory] = useState<OrchManifestCategory>(initialCategory);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<OrchManifestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // LOCAL self-adjust only: promoting fills Part1 of the Pycore shared
  // audio queue and NEVER notifies Laravel (wordnew owns the Part2 path).
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promotedIds, setPromotedIds] = useState<Set<string>>(new Set());


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

  const promoteToHead = useCallback(async (item: OrchManifestItem) => {
    if (promotingId) return;
    setPromotingId(item.resource_id);
    try {
      const kind = item.kind === 'word' ? 'word' : 'sentence';
      const response = await pycoreApi.promoteLocalQueueHead({
        queue: kind === 'word' ? 'word_audio' : 'sentence_audio',
        items: [{ kind, language: item.language, text: item.text }],
        owner: taskId,
      });
      if (!response.success) throw new Error(response.error || ORCH_L.actionFailed);
      setPromotedIds((prev) => new Set(prev).add(item.resource_id));
      setError(null);
      void load(category, page);
    } catch (e) {
      setError(orchErrorMessage(e, ORCH_L.actionFailed));
    } finally {
      setPromotingId(null);
    }
  }, [promotingId, category, page, load, taskId]);

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
                {item.resolved_at && (
                  <span className="shrink-0 text-[10px] font-mono text-slate-500" title={ORCH_L.resolvedAt}>
                    {absoluteTime(item.resolved_at)}
                  </span>
                )}
                {item.queue_state && (
                  <span className="shrink-0 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] text-indigo-300">
                    {t('queueCenter.audioLane.part1')} · {t(`queueCenter.audioLane.states.${item.queue_state}`)}
                  </span>
                )}
                {(item.synced || item.sync_queued) && (
                  <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
                    {item.synced ? ORCH_L.manifestSynced : ORCH_L.syncingNow}
                  </span>
                )}
                <button
                  type="button"
                  title={ORCH_L.moveToHead}
                  disabled={promotingId !== null || promotedIds.has(item.resource_id)}
                  onClick={() => void promoteToHead(item)}
                  className="ml-auto shrink-0 rounded border border-slate-300 dark:border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500 dark:text-slate-400 hover:border-indigo-400/50 hover:text-indigo-300 disabled:opacity-50 disabled:hover:border-slate-300 dark:disabled:hover:border-white/10 disabled:hover:text-slate-500 dark:disabled:hover:text-slate-400"
                >
                  {promotingId === item.resource_id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : promotedIds.has(item.resource_id) ? (
                    ORCH_L.moveToHeadDone
                  ) : (
                    <ArrowUpToLine className="w-3 h-3" />
                  )}
                </button>
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
