import React, { useCallback } from 'react';
import { CircleAlert, Clock3, Loader2, ScanSearch, Wand2 } from 'lucide-react';
import { useTranslation } from '@/apps/laravel-manager/i18n';
import type { LibraryCoverHandler, LibraryCoverMode } from '@/apps/laravel-manager/api';
import { libraryCoverTaskModel, type LibraryCoverPhase } from '@/apps/laravel-manager/models';
import { logError, logInfo, logSuccess } from '@/core/logstore/logStore';
import { useToast } from '../admin';

const BADGE_CLS = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium max-w-full';
const ICON_BUTTON_CLS = 'p-1 rounded text-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

/** Enqueue cover tasks through the shared model and report the outcome (toast + log). */
export function useLibraryCoverEnqueue(): (ids: Array<number | string>, mode: LibraryCoverMode) => Promise<void> {
  const { t } = useTranslation();
  const toast = useToast();

  return useCallback(async (ids, mode) => {
    logInfo('covers', `Queueing ${mode} cover task(s) for ${ids.length} library(ies)...`);
    try {
      const result = await libraryCoverTaskModel.enqueue(ids, mode);
      const count = result.tasks.length || ids.length - result.skipped.length;
      toast.success(result.skipped.length > 0
        ? t('libraryCover.enqueued_skipped', { count, skipped: result.skipped.length })
        : t('libraryCover.enqueued', { count }));
      logSuccess('covers', `Queued ${count} ${mode} cover task(s), skipped ${result.skipped.length}`);
    } catch (error: any) {
      toast.error(error?.message || t('libraryCover.enqueue_failed'));
      logError('covers', `Cover task enqueue (${mode}) failed: ${error?.message || error}`);
    }
  }, [t, toast]);
}

interface LibraryCoverTaskBadgeProps {
  phase: LibraryCoverPhase | null;
  handler: LibraryCoverHandler | null;
  error?: string | null;
  className?: string;
}

/** queued / processing (· Chrome | · Laravel AI) / failed; nothing when idle or settled OK. */
export const LibraryCoverTaskBadge: React.FC<LibraryCoverTaskBadgeProps> = ({ phase, handler, error, className = '' }) => {
  const { t } = useTranslation();

  if (phase === 'queued') {
    return (
      <span className={`${BADGE_CLS} bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ${className}`}>
        <Clock3 className="w-3 h-3 shrink-0" />
        {t('libraryCover.status.queued')}
      </span>
    );
  }
  if (phase === 'processing') {
    return (
      <span className={`${BADGE_CLS} bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ${className}`}>
        <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
        {handler
          ? t('libraryCover.status.processing_by', { handler: t(`libraryCover.handler.${handler}`) })
          : t('libraryCover.status.processing')}
      </span>
    );
  }
  if (phase === 'failed') {
    return (
      <span
        className={`${BADGE_CLS} bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 ${className}`}
        title={error ?? undefined}
      >
        <CircleAlert className="w-3 h-3 shrink-0" />
        <span className="truncate">
          {t('libraryCover.status.failed')}{error ? ` · ${error}` : ''}
        </span>
      </span>
    );
  }
  return null;
};

interface LibraryCoverTaskButtonsProps {
  active: boolean;
  onEnqueue: (mode: LibraryCoverMode) => void;
}

/** Regenerate (AI generate, chrome first / Laravel AI fallback) and Re-search icon actions. */
export const LibraryCoverTaskButtons: React.FC<LibraryCoverTaskButtonsProps> = ({ active, onEnqueue }) => {
  const { t } = useTranslation();

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEnqueue('generate');
        }}
        disabled={active}
        className={`${ICON_BUTTON_CLS} hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20`}
        title={t('libraryCover.regenerate_hint')}
        aria-label={t('libraryCover.regenerate')}
      >
        <Wand2 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEnqueue('search');
        }}
        disabled={active}
        className={`${ICON_BUTTON_CLS} hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20`}
        title={t('libraryCover.research_hint')}
        aria-label={t('libraryCover.research')}
      >
        <ScanSearch className="w-3.5 h-3.5" />
      </button>
    </>
  );
};
