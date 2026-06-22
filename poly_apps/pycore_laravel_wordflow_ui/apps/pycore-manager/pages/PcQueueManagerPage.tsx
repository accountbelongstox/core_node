/**
 * PcQueueManagerPanel — pycore queue inspector (Queue Manager tab body).
 *
 * Formerly the standalone PcQueueManagerPage (route /pycore-manager/queue);
 * now one tab of PcQueueCenterPage, which owns the page header, the shared
 * refresh button (`refreshTick`) and the auto-refresh interval. The data logic
 * is unchanged: a read-only table of queued system operations
 * (PycoreApi.getQueue) with per-category badges and a status column, kept live
 * via the `voice_subtitle_queue_update` WS snapshot (subscribe +
 * connectPycoreWs), with the queue cache covering the WS-down case. Degrades
 * to an inline "pycore unreachable" banner and the last cached snapshot when
 * the backend is offline. Count/loading are reported up through `onMeta` so
 * the tab label can show a live count and the shared refresh button a spinner.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, AlertTriangle, Layers2, Loader2 } from 'lucide-react';
import { pycoreApi, mapQueueSnapshot, subscribe, connectPycoreWs, loadQueueCache, saveQueueCache } from '../../../core/api-libs/pycore';
import type { QueueItem } from '../../../core/api-libs/pycore';
import { PcQueueItemDetailModal } from '../components/PcTaskDetailModal';

const CATEGORY_CLS: Record<string, string> = {
  Voice: 'bg-blue-500/15 text-blue-500',
  Window: 'bg-purple-500/15 text-purple-500',
  Task: 'bg-amber-500/15 text-amber-500',
  Video: 'bg-rose-500/15 text-rose-500',
  Image: 'bg-emerald-500/15 text-emerald-500',
  File: 'bg-cyan-500/15 text-cyan-500',
};

function statusLabel(s: QueueItem['status']): { text: string; cls: string } {
  switch (s) {
    case 'completed': return { text: 'READY', cls: 'text-emerald-500' };
    case 'processing': return { text: 'RUNNING', cls: 'text-sky-500' };
    case 'failed': return { text: 'FAILED', cls: 'text-rose-500' };
    default: return { text: 'QUEUED', cls: 'text-slate-400' };
  }
}

/** Contract with PcQueueCenterPage (kept local to avoid an import cycle). */
interface PanelProps {
  /** Bumped by the parent's refresh button / auto-refresh interval. */
  refreshTick?: number;
  /** Report the row count + in-flight state up to the tab bar. */
  onMeta?: (meta: { count: number | null; loading: boolean }) => void;
}

const PcQueueManagerPanel: React.FC<PanelProps> = ({ refreshTick = 0, onMeta }) => {
  const [queue, setQueue] = useState<QueueItem[]>(() => loadQueueCache() ?? []);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const r = await pycoreApi.getQueue();
      const list = Array.isArray(r?.items) ? r.items : [];
      setQueue(list);
      saveQueueCache(list);
      setCurrentIndex(typeof r?.currentIndex === 'number' ? r.currentIndex : null);
      setUnreachable(false);
      setError(r?.error ?? null);
    } catch (e: any) {
      // Dev proxy returns 502 / fetch throws when the backend is down. Keep the
      // last good snapshot and flag the unreachable state.
      setUnreachable(true);
      setError(e?.message || 'pycore unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  // Parent-driven refresh (manual button or the shared auto-refresh interval).
  const lastTick = useRef(refreshTick);
  useEffect(() => {
    if (refreshTick !== lastTick.current) {
      lastTick.current = refreshTick;
      fetchQueue();
    }
  }, [refreshTick, fetchQueue]);

  // Report count + loading up to the tab bar / shared spinner.
  useEffect(() => { onMeta?.({ count: queue.length, loading }); }, [queue.length, loading, onMeta]);

  // Live updates: the backend broadcasts a full snapshot on every queue mutation.
  useEffect(() => {
    connectPycoreWs();
    const off = subscribe('voice_subtitle_queue_update', (data: any) => {
      const r = mapQueueSnapshot(data);
      setQueue(r.items ?? []);
      saveQueueCache(r.items ?? []);
      if (typeof r.currentIndex === 'number') setCurrentIndex(r.currentIndex);
      setUnreachable(false);
    });
    return () => { off(); };
  }, []);

  return (
    <div className="space-y-6">
      {unreachable && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">
            pycore unreachable — showing the last cached snapshot. The backend (:59000) may be offline.
            {error ? ` (${error})` : ''}
          </span>
        </div>
      )}

      <section className="pc-glass overflow-hidden">
        <div className="p-5 border-b border-slate-200/40 dark:border-white/5 flex items-center justify-between gap-4">
          <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Layers className="w-4 h-4 text-indigo-500" /> Queued operations
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500">{queue.length}</span>
          </h2>
          {currentIndex != null && (
            <span className="text-[11px] font-mono text-sky-500">current #{currentIndex}</span>
          )}
        </div>

        <div className="px-4 md:px-5 pb-4 md:pb-5 max-h-[480px] overflow-auto min-h-[300px]">
          {loading && queue.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <p className="text-xs">Loading queue…</p>
            </div>
          ) : queue.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-500">
              <Layers2 className="w-8 h-8 opacity-40 mb-2 text-indigo-500" />
              <p className="text-xs italic">Queue is empty — no operations to inspect.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              {/* sticky header so column labels stay visible in long lists */}
              <thead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
                <tr className="text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200/40 dark:border-white/5">
                  <th className="py-3 font-semibold text-center w-8">#</th>
                  <th className="py-3 font-semibold">Text</th>
                  <th className="py-3 font-semibold">Category</th>
                  <th className="py-3 font-semibold text-center">Plays</th>
                  <th className="py-3 font-semibold">Created</th>
                  <th className="py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {queue.map((item) => {
                  const isCurrent = currentIndex != null && item.index === currentIndex;
                  const st = statusLabel(item.status);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`group hover:bg-indigo-500/5 transition-colors cursor-pointer ${isCurrent ? 'bg-indigo-500/10' : ''}`}>
                      <td className="py-3 font-mono opacity-60 font-semibold text-center">{String(item.index).padStart(3, '0')}</td>
                      <td className="py-3 max-w-xs">
                        <p className="font-medium text-slate-800 dark:text-zinc-200 line-clamp-2">{item.text}</p>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${CATEGORY_CLS[item.category] ?? 'bg-slate-500/15 text-slate-500'}`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-center">{item.playCount}</td>
                      <td className="py-3 font-mono text-slate-500 text-[10px]">
                        {item.created ? new Date(item.created).toLocaleString() : '-'}
                      </td>
                      <td className="py-3">
                        <span className={`text-[9px] font-bold uppercase ${st.cls}`}>{st.text}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {selectedItem && (
        <PcQueueItemDetailModal
          item={selectedItem}
          isCurrent={currentIndex != null && selectedItem.index === currentIndex}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};

export default PcQueueManagerPanel;
