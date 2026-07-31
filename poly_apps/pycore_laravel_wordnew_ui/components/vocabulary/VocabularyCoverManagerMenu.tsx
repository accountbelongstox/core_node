/**
 * VocabularyCoverManagerMenu — a top-right management dropdown for the
 * "Vocabulary Libraries" section. Groups the cover-maintenance actions that
 * drive mcp-chrome's pull-based cover replacement:
 *
 *   - Regenerate ALL covers  -> clearCover({ all:true })  (delete files + fresh
 *                               randomized prompt; destructive -> confirm)
 *   - Regenerate FAILED only  -> clearCover({ failed_only:true })
 *   - Retry failed (keep img) -> retryCover({ all:true })  (reset, no delete)
 *   - Re-enqueue missing      -> reconcileCovers()         (ready-but-no-file)
 *
 * Anchored popover via the shared Portal (matching ApiEndpointSwitcher): fixed
 * position from the button rect, click-outside to close, OVERLAY_Z.modal layer.
 * Destructive "Regenerate ALL" routes through ConfirmModal. After any success
 * it calls onChanged() so the caller reloads the library list.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Wrench, Wand2, ImageOff, RotateCcw, RefreshCw, ChevronDown } from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import Portal from '../shared/Portal';
import { OVERLAY_Z } from '../../styles/overlay';
import { ConfirmModal, useToast } from '../admin';
import { logError, logInfo, logSuccess } from '../../core/logstore/logStore';

interface Props {
  /** Called after a successful action so the parent can reload the libraries. */
  onChanged: () => void;
}

interface MenuPos { top: number; right: number; }

const VocabularyCoverManagerMenu: React.FC<Props> = ({ onChanged }) => {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos>({ top: 0, right: 0 });
  // Label of the action currently running (disables the menu + spins its icon).
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRegenAll, setConfirmRegenAll] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Position the popover under the button (right-aligned), like ApiEndpointSwitcher.
  const reposition = useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
  }, []);

  useLayoutEffect(() => { if (open) reposition(); }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScrollOrResize = () => reposition();
    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, reposition]);

  // Run an action, surface a toast + log, then reload the parent's list.
  const run = useCallback(async (
    label: string,
    fn: () => Promise<{ success: boolean; data?: any; error?: string }>,
    describe: (data: any) => string,
  ) => {
    if (busy) return;
    setBusy(label);
    logInfo('covers', `${label}…`);
    try {
      const res = await fn();
      if (res.success) {
        // Count fields may sit under `.data` (wrapped) or at the response root
        // depending on BaseAPI unwrapping — read whichever carries them.
        const payload = (res as any).data ?? res;
        const msg = describe(payload);
        toast.success(msg);
        logSuccess('covers', `${label}: ${msg}`);
        onChanged();
      } else {
        toast.error(res.error || `${label} failed`);
        logError('covers', `${label} failed: ${res.error || 'unknown error'}`);
      }
    } catch (e: any) {
      toast.error(e?.message || `${label} failed`);
      logError('covers', `${label} failed: ${e?.message || e}`);
    } finally {
      setBusy(null);
      setOpen(false);
    }
  }, [busy, toast, onChanged]);

  const regenerateAll = useCallback(() => {
    setConfirmRegenAll(false);
    void run(
      'Regenerate all covers',
      () => api.appQyV1.clearCover({ all: true }),
      (d) => `Cleared ${d.cleared ?? 0} cover(s) (${d.files_deleted ?? 0} image file(s) deleted) — mcp-chrome will replace them.`,
    );
  }, [run]);

  const regenerateFailed = useCallback(() => {
    void run(
      'Regenerate failed covers',
      () => api.appQyV1.clearCover({ failed_only: true }),
      (d) => `Cleared ${d.cleared ?? 0} failed cover(s) for regeneration.`,
    );
  }, [run]);

  const retryFailed = useCallback(() => {
    void run(
      'Retry failed covers',
      () => api.appQyV1.retryCover({ all: true }),
      (d) => `Re-queued ${d.reset ?? 0} failed cover(s) (image kept).`,
    );
  }, [run]);

  const reconcileMissing = useCallback(() => {
    void run(
      'Re-enqueue missing covers',
      () => api.appQyV1.reconcileCovers(),
      (d) => `Re-queued ${d.reset ?? 0} of ${d.checked ?? 0} cover(s) whose file was missing.`,
    );
  }, [run]);

  const itemCls =
    'w-full flex items-start gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
        title="Cover management — clear / regenerate / recover covers"
      >
        <Wrench className="w-3.5 h-3.5" />
        Manage
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <Portal lockScroll={false}>
          <div
            ref={menuRef}
            style={{ top: pos.top, right: pos.right }}
            className={`fixed w-80 ${OVERLAY_Z.modal} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden`}
          >
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" /> Cover management
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Covers are generated by pycore (pull-only). These actions re-queue work.
              </p>
            </div>

            <button onClick={() => setConfirmRegenAll(true)} disabled={!!busy} className={itemCls}>
              <Wand2 className={`w-4 h-4 mt-0.5 shrink-0 text-rose-500 ${busy === 'Regenerate all covers' ? 'animate-spin' : ''}`} />
              <span>
                <span className="font-medium text-slate-800 dark:text-slate-100">Regenerate all covers</span>
                <span className="block text-[11px] text-slate-400">Delete every cover image and rebuild with a fresh, varied prompt.</span>
              </span>
            </button>

            <button onClick={regenerateFailed} disabled={!!busy} className={itemCls}>
              <ImageOff className={`w-4 h-4 mt-0.5 shrink-0 text-amber-500 ${busy === 'Regenerate failed covers' ? 'animate-spin' : ''}`} />
              <span>
                <span className="font-medium text-slate-800 dark:text-slate-100">Regenerate failed covers</span>
                <span className="block text-[11px] text-slate-400">Clear only failed/retry covers and rebuild them.</span>
              </span>
            </button>

            <button onClick={retryFailed} disabled={!!busy} className={itemCls}>
              <RotateCcw className={`w-4 h-4 mt-0.5 shrink-0 text-indigo-500 ${busy === 'Retry failed covers' ? 'animate-spin' : ''}`} />
              <span>
                <span className="font-medium text-slate-800 dark:text-slate-100">Retry failed covers</span>
                <span className="block text-[11px] text-slate-400">Re-queue failed covers without deleting the existing image.</span>
              </span>
            </button>

            <button onClick={reconcileMissing} disabled={!!busy} className={itemCls}>
              <RefreshCw className={`w-4 h-4 mt-0.5 shrink-0 text-emerald-500 ${busy === 'Re-enqueue missing covers' ? 'animate-spin' : ''}`} />
              <span>
                <span className="font-medium text-slate-800 dark:text-slate-100">Re-enqueue missing covers</span>
                <span className="block text-[11px] text-slate-400">Recover covers marked ready whose image file is gone.</span>
              </span>
            </button>
          </div>
        </Portal>
      )}

      <ConfirmModal
        isOpen={confirmRegenAll}
        onClose={() => { if (busy !== 'Regenerate all covers') setConfirmRegenAll(false); }}
        onConfirm={regenerateAll}
        title="Regenerate all covers"
        message="This deletes every cover image and re-queues all libraries for search-based replacement. Existing covers will be gone until mcp-chrome submits replacements. Continue?"
        confirmText="Regenerate all"
        cancelText="Cancel"
        variant="danger"
        loading={busy === 'Regenerate all covers'}
      />
    </>
  );
};

export default VocabularyCoverManagerMenu;
