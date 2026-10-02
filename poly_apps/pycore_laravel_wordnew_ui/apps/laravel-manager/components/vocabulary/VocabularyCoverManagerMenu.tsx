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
 *   - Regenerate (AI) / Re-search for the loaded libraries -> cover tasks
 *                               (LibraryCoverTaskModel, polled per card)
 *
 * Anchored popover via the shared Portal (matching ApiEndpointSwitcher): fixed
 * position from the button rect, click-outside to close, OVERLAY_Z.modal layer.
 * Destructive "Regenerate ALL" routes through ConfirmModal. After any success
 * it calls onChanged() so the caller reloads the library list.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Wrench, Wand2, ImageOff, RotateCcw, RefreshCw, ChevronDown, Sparkles, ScanSearch } from 'lucide-react';
import { api, type LibraryCoverMode } from '@/apps/laravel-manager/api';
import { useTranslation } from '@/apps/laravel-manager/i18n';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_Z } from '@/shared/styles/overlay';
import { ConfirmModal, useToast } from '../admin';
import { logError, logInfo, logSuccess } from '@/core/logstore/logStore';
import { useLibraryCoverEnqueue } from './LibraryCoverTaskControls';

interface Props {
  /** Called after a successful action so the parent can reload the libraries. */
  onChanged: () => void;
  /** Currently loaded libraries — targets of the bulk cover-task actions. */
  libraryIds: Array<number | string>;
}

interface MenuPos { top: number; right: number; }

const ACTION_REGEN_ALL = 'regenerate_all';
const ACTION_REGEN_FAILED = 'regenerate_failed';
const ACTION_RETRY_FAILED = 'retry_failed';
const ACTION_REENQUEUE_MISSING = 'reenqueue_missing';

const VocabularyCoverManagerMenu: React.FC<Props> = ({ onChanged, libraryIds }) => {
  const toast = useToast();
  const { t } = useTranslation();
  const enqueueCoverTasks = useLibraryCoverEnqueue();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos>({ top: 0, right: 0 });
  // Id of the action currently running (disables the menu + spins its icon).
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
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
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
    actionId: string,
    label: string,
    fn: () => Promise<{ success: boolean; data?: any; error?: string }>,
    describe: (data: any) => string,
  ) => {
    if (busy) return;
    setBusy(actionId);
    logInfo('covers', `${actionId}…`);
    try {
      const res = await fn();
      if (res.success) {
        // Count fields may sit under `.data` (wrapped) or at the response root
        // depending on BaseAPI unwrapping — read whichever carries them.
        const payload = (res as any).data ?? res;
        const msg = describe(payload);
        toast.success(msg);
        logSuccess('covers', `${actionId}: ${msg}`);
        onChanged();
      } else {
        toast.error(res.error || t('uiVocab.coverManagerMenu.action_failed', { label }));
        logError('covers', `${actionId} failed: ${res.error || 'unknown error'}`);
      }
    } catch (e: any) {
      toast.error(e?.message || t('uiVocab.coverManagerMenu.action_failed', { label }));
      logError('covers', `${actionId} failed: ${e?.message || e}`);
    } finally {
      setBusy(null);
      setOpen(false);
    }
  }, [busy, toast, onChanged, t]);

  const regenerateAll = useCallback(() => {
    setConfirmRegenAll(false);
    void run(
      ACTION_REGEN_ALL,
      t('uiVocab.coverManagerMenu.regenerate_all'),
      () => api.appQyV1.clearCover({ all: true }),
      (d) => t('uiVocab.coverManagerMenu.cleared_all', { cleared: d.cleared ?? 0, files: d.files_deleted ?? 0 }),
    );
  }, [run, t]);

  const regenerateFailed = useCallback(() => {
    void run(
      ACTION_REGEN_FAILED,
      t('uiVocab.coverManagerMenu.regenerate_failed'),
      () => api.appQyV1.clearCover({ failed_only: true }),
      (d) => t('uiVocab.coverManagerMenu.cleared_failed', { cleared: d.cleared ?? 0 }),
    );
  }, [run, t]);

  const retryFailed = useCallback(() => {
    void run(
      ACTION_RETRY_FAILED,
      t('uiVocab.coverManagerMenu.retry_failed'),
      () => api.appQyV1.retryCover({ all: true }),
      (d) => t('uiVocab.coverManagerMenu.requeued_failed', { count: d.reset ?? 0 }),
    );
  }, [run, t]);

  const reconcileMissing = useCallback(() => {
    void run(
      ACTION_REENQUEUE_MISSING,
      t('uiVocab.coverManagerMenu.reenqueue_missing'),
      () => api.appQyV1.reconcileCovers(),
      (d) => t('uiVocab.coverManagerMenu.requeued_missing', { reset: d.reset ?? 0, checked: d.checked ?? 0 }),
    );
  }, [run, t]);

  const enqueueLoaded = useCallback(async (mode: LibraryCoverMode) => {
    if (busy || libraryIds.length === 0) return;
    setBusy(`cover-task-${mode}`);
    try {
      await enqueueCoverTasks(libraryIds, mode);
    } finally {
      setBusy(null);
      setOpen(false);
    }
  }, [busy, libraryIds, enqueueCoverTasks]);

  const itemCls =
    'w-full flex items-start gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
        title={t('uiVocab.coverManagerMenu.button_title')}
      >
        <Wrench className="w-3.5 h-3.5" />
        {t('uiVocab.coverManagerMenu.manage')}
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
                <Wrench className="w-3.5 h-3.5" /> {t('uiVocab.coverManagerMenu.heading')}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t('uiVocab.coverManagerMenu.intro')}
              </p>
            </div>

            <button
              onClick={() => void enqueueLoaded('generate')}
              disabled={!!busy || libraryIds.length === 0}
              className={itemCls}
              title={libraryIds.length === 0 ? t('libraryCover.none_loaded') : undefined}
            >
              <Sparkles className={`w-4 h-4 mt-0.5 shrink-0 text-violet-500 ${busy === 'cover-task-generate' ? 'animate-spin' : ''}`} />
              <span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{t('libraryCover.bulk_regenerate')}</span>
                <span className="block text-[11px] text-slate-400">{t('libraryCover.bulk_regenerate_hint')}</span>
              </span>
            </button>

            <button
              onClick={() => void enqueueLoaded('search')}
              disabled={!!busy || libraryIds.length === 0}
              className={itemCls}
              title={libraryIds.length === 0 ? t('libraryCover.none_loaded') : undefined}
            >
              <ScanSearch className={`w-4 h-4 mt-0.5 shrink-0 text-sky-500 ${busy === 'cover-task-search' ? 'animate-spin' : ''}`} />
              <span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{t('libraryCover.bulk_research')}</span>
                <span className="block text-[11px] text-slate-400">{t('libraryCover.bulk_research_hint')}</span>
              </span>
            </button>

            <button onClick={() => setConfirmRegenAll(true)} disabled={!!busy} className={itemCls}>
              <Wand2 className={`w-4 h-4 mt-0.5 shrink-0 text-rose-500 ${busy === ACTION_REGEN_ALL ? 'animate-spin' : ''}`} />
              <span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{t('uiVocab.coverManagerMenu.regenerate_all')}</span>
                <span className="block text-[11px] text-slate-400">{t('uiVocab.coverManagerMenu.regenerate_all_hint')}</span>
              </span>
            </button>

            <button onClick={regenerateFailed} disabled={!!busy} className={itemCls}>
              <ImageOff className={`w-4 h-4 mt-0.5 shrink-0 text-amber-500 ${busy === ACTION_REGEN_FAILED ? 'animate-spin' : ''}`} />
              <span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{t('uiVocab.coverManagerMenu.regenerate_failed')}</span>
                <span className="block text-[11px] text-slate-400">{t('uiVocab.coverManagerMenu.regenerate_failed_hint')}</span>
              </span>
            </button>

            <button onClick={retryFailed} disabled={!!busy} className={itemCls}>
              <RotateCcw className={`w-4 h-4 mt-0.5 shrink-0 text-indigo-500 ${busy === ACTION_RETRY_FAILED ? 'animate-spin' : ''}`} />
              <span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{t('uiVocab.coverManagerMenu.retry_failed')}</span>
                <span className="block text-[11px] text-slate-400">{t('uiVocab.coverManagerMenu.retry_failed_hint')}</span>
              </span>
            </button>

            <button onClick={reconcileMissing} disabled={!!busy} className={itemCls}>
              <RefreshCw className={`w-4 h-4 mt-0.5 shrink-0 text-emerald-500 ${busy === ACTION_REENQUEUE_MISSING ? 'animate-spin' : ''}`} />
              <span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{t('uiVocab.coverManagerMenu.reenqueue_missing')}</span>
                <span className="block text-[11px] text-slate-400">{t('uiVocab.coverManagerMenu.reenqueue_missing_hint')}</span>
              </span>
            </button>
          </div>
        </Portal>
      )}

      <ConfirmModal
        isOpen={confirmRegenAll}
        onClose={() => { if (busy !== ACTION_REGEN_ALL) setConfirmRegenAll(false); }}
        onConfirm={regenerateAll}
        title={t('uiVocab.coverManagerMenu.regenerate_all')}
        message={t('uiVocab.coverManagerMenu.regenerate_all_confirm')}
        confirmText={t('uiVocab.coverManagerMenu.regenerate_all_confirm_text')}
        cancelText={t('common.cancel')}
        variant="danger"
        loading={busy === ACTION_REGEN_ALL}
      />
    </>
  );
};

export default VocabularyCoverManagerMenu;
