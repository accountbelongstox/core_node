/**
 * AiImageHistoryPanel — image generation management for the AI Tools console.
 *
 * Gallery over the shared cross-runtime image history
 * (GET /api/local/ai/image/history). Each tile loads the bytes from the file
 * endpoint (GET .../file/{id}) and shows the prompt, provider/model, time and
 * an origin badge (pycore / laravel). Per-tile Delete + a Clear-all. Clicking a
 * tile enlarges it in a portaled lightbox where the prompt can be re-used into
 * the Image Gen tool.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Images, RefreshCcw, Trash2, AlertTriangle, X, Wand2, Clock, Timer,
} from 'lucide-react';
import { api } from '../../core/api';
import { useToast } from '../admin';
import { appendLog } from '../../core/logstore/logStore';
import type { AiImageHistoryEntry } from '../../core/api/modules/AiManagementAPI';
import ToolWrapper from '../universal/ToolWrapper';
import { commonClasses } from '../../styles/theme';
import { AiBentoCard, AiToolAlert } from './ui';
import { Portal } from '../shared';
import { OVERLAY_CONTAINER, OVERLAY_BACKDROP, OVERLAY_Z } from '../../styles/overlay';
import { reusePrompt } from './imageGenBridge';

/** Origin pill: which runtime produced the entry. */
const OriginBadge: React.FC<{ origin: string }> = ({ origin }) => {
  const cls = origin === 'pycore'
    ? 'bg-sky-500/15 text-sky-500'
    : origin === 'laravel'
      ? 'bg-rose-500/15 text-rose-500'
      : 'bg-slate-500/15 text-slate-400';
  return (
    <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${cls}`}>
      {origin || 'unknown'}
    </span>
  );
};

function fmtTime(entry: AiImageHistoryEntry): string {
  if (entry.iso) {
    const d = new Date(entry.iso);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  if (entry.ts) return new Date(entry.ts * 1000).toLocaleString();
  return '-';
}

const AiImageHistoryPanel: React.FC<{ onReuse?: () => void }> = ({ onReuse }) => {
  const toast = useToast();

  const [entries, setEntries] = useState<AiImageHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [clearing, setClearing] = useState(false);
  const [active, setActive] = useState<AiImageHistoryEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.aiManagement.imageHistory(50);
      if (res.success && res.data && Array.isArray(res.data.entries)) {
        setEntries(res.data.entries);
      } else {
        setError(res.error || 'Image history unavailable.');
      }
    } catch (e: any) {
      setError(e?.message || 'Image history backend unreachable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const removeOne = useCallback(async (id: string) => {
    setDeleting((s) => { const n = new Set(s); n.add(id); return n; });
    try {
      const res = await api.aiManagement.deleteImageHistory(id);
      if (res.success && res.data?.success !== false) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        setActive((a) => (a && a.id === id ? null : a));
        appendLog('success', 'ai', `Image history: deleted ${id}`);
        toast.success('Image deleted', 'Image history');
      } else {
        toast.error(res.error || 'Delete failed', 'Image history');
        appendLog('error', 'ai', `Image history delete failed: ${res.error || id}`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed', 'Image history');
    } finally {
      setDeleting((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }, [toast]);

  const clearAll = useCallback(async () => {
    if (clearing || entries.length === 0) return;
    setClearing(true);
    appendLog('info', 'ai', 'Image history: clearing all…');
    try {
      const res = await api.aiManagement.clearImageHistory();
      if (res.success && res.data?.success !== false) {
        const removed = res.data?.removed ?? entries.length;
        setEntries([]);
        setActive(null);
        appendLog('success', 'ai', `Image history cleared (${removed} removed)`);
        toast.success(`Cleared ${removed} images`, 'Image history');
      } else {
        toast.error(res.error || 'Clear failed', 'Image history');
        appendLog('error', 'ai', `Image history clear failed: ${res.error || ''}`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Clear failed', 'Image history');
    } finally {
      setClearing(false);
    }
  }, [clearing, entries.length, toast]);

  const handleReuse = useCallback((entry: AiImageHistoryEntry) => {
    reusePrompt(entry.prompt);
    setActive(null);
    appendLog('info', 'ai', `Image history: reuse prompt → ${entry.prompt.slice(0, 60)}`);
    toast.info('Prompt sent to Image Gen', 'Image history');
    if (onReuse) onReuse();
  }, [onReuse, toast]);

  return (
    <ToolWrapper
      title="Image History"
      icon={Images}
      gradient="amber"
      description="Shared cross-runtime image generation history"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => void clearAll()}
            disabled={clearing || entries.length === 0}
            title="Delete every image in the shared history"
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
          >
            <Trash2 className={`w-3.5 h-3.5 ${clearing ? 'animate-pulse' : ''}`} />
            Clear all
          </button>
        </div>
      }
    >
      <div className="space-y-4 sm:space-y-5">
        {error && (
          <AiToolAlert variant="warning">
            <span className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </span>
          </AiToolAlert>
        )}

        {loading && entries.length === 0 ? (
          <div className="text-xs text-slate-500 py-10 text-center flex flex-col items-center gap-2">
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" /> Loading history…
          </div>
        ) : entries.length === 0 ? (
          <AiBentoCard>
            <div className="text-center py-12">
              <Images className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-slate-500 dark:text-slate-400">No images generated yet.</p>
            </div>
          </AiBentoCard>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {entries.map((e) => {
              const busy = deleting.has(e.id);
              return (
                <div
                  key={e.id}
                  className="group relative rounded-2xl overflow-hidden border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => setActive(e)}
                    className="relative block aspect-square w-full overflow-hidden bg-slate-100 dark:bg-white/5"
                    title="Click to enlarge"
                  >
                    <img
                      src={api.aiManagement.imageHistoryFileUrl(e.id)}
                      alt={e.prompt.slice(0, 80)}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute top-1.5 left-1.5 flex flex-col items-start gap-1">
                      <OriginBadge origin={e.origin} />
                      {e.source === 'assist-cover' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-fuchsia-500/85 text-white">
                          cover
                        </span>
                      )}
                    </span>
                  </button>

                  <div className="p-2.5 flex flex-col gap-1.5 min-w-0">
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-snug" title={e.prompt}>
                      {e.prompt || '(no prompt)'}
                    </p>
                    <div className="flex items-center justify-between gap-1 text-[9px] font-mono text-slate-400">
                      <span className="truncate" title={`${e.provider}/${e.model}`}>{e.provider}/{e.model}</span>
                      {e.latency_ms != null && (
                        <span className="inline-flex items-center gap-0.5 shrink-0"><Timer className="w-2.5 h-2.5" />{Math.round(e.latency_ms)}ms</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-400 truncate" title={fmtTime(e)}>
                        <Clock className="w-2.5 h-2.5 shrink-0" />{fmtTime(e)}
                      </span>
                      <button
                        onClick={() => void removeOne(e.id)}
                        disabled={busy}
                        title="Delete this image"
                        className="shrink-0 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition disabled:opacity-40"
                      >
                        {busy ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Enlarge / reuse lightbox — portaled to <body> per the overlay convention. */}
      {active && (
        <Portal>
          <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal}`}>
            <div className={`absolute inset-0 ${OVERLAY_BACKDROP}`} onClick={() => setActive(null)} />
            <div className="relative w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200/60 dark:ring-white/10 shadow-2xl">
              <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-slate-200/70 dark:border-white/5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{active.provider}/{active.model}</span>
                    <OriginBadge origin={active.origin} />
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{fmtTime(active)}</div>
                </div>
                <button
                  onClick={() => setActive(null)}
                  className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] transition"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <img
                  src={api.aiManagement.imageHistoryFileUrl(active.id)}
                  alt={active.prompt.slice(0, 120)}
                  className="w-full h-auto rounded-xl ring-1 ring-slate-200/60 dark:ring-white/10"
                />
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Prompt</div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                    {active.prompt || '(no prompt)'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleReuse(active)}
                    className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-xs flex items-center gap-1.5`}
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Reuse prompt
                  </button>
                  <button
                    onClick={() => void removeOne(active.id)}
                    disabled={deleting.has(active.id)}
                    className={`${commonClasses.button} ${commonClasses.buttonSecondary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </ToolWrapper>
  );
};

export default AiImageHistoryPanel;
