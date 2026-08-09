import { useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import { Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Portal from '../../../components/shared/Portal';
import { OVERLAY_BACKDROP, OVERLAY_CONTAINER, OVERLAY_Z } from '../../../styles/overlay';
import type { WordTtsWorkerTask } from '@/apps/pycore-manager/api';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';

interface PcWordAudioQueueModalProps {
  open: boolean;
  onClose: () => void;
}

const clampProgress = (value?: number): number => Math.min(100, Math.max(0, Number(value) || 0));

const formatDuration = (seconds?: number): string => {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return `${value.toFixed(value < 10 ? 1 : 0)}s`;
  return `${Math.floor(value / 60)}m ${Math.floor(value % 60)}s`;
};

export function PcWordAudioQueueModal({ open, onClose }: PcWordAudioQueueModalProps): ReactElement | null {
  const { t } = useTranslation('pc');
  const hub = useQueueCenterHub();
  const worker = hub.voiceWord?.worker;
  const tasks = useMemo<WordTtsWorkerTask[]>(() => {
    if (Array.isArray(worker?.current_tasks)) return worker.current_tasks;
    return worker?.current_task ? [worker.current_task] : [];
  }, [worker?.current_task, worker?.current_tasks]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  const pending = hub.sectionContracts.word_audio.queue.pending;
  const leased = hub.sectionContracts.word_audio.queue.leased;

  return (
    <Portal>
      <div
        className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-audio-queue-title"
        onClick={onClose}>
        <div
          className="pc-glass w-full max-w-xl max-h-[80vh] overflow-y-auto p-5"
          onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="word-audio-queue-title" className="text-base font-bold text-slate-800 dark:text-slate-100">
                {t('queueCenter.wordAudioQueue.title')}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {t('queueCenter.wordAudioQueue.summary', { pending: pending ?? '—', leased: leased ?? '—' })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('queueCenter.wordAudioQueue.close')}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200/50 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="mt-5 rounded-xl border border-slate-200/60 bg-slate-100/50 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/5 dark:bg-white/[0.03]">
              {t('queueCenter.wordAudioQueue.idle')}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {tasks.map((task, index) => {
                const progress = clampProgress(task.progress);
                const stage = task.stage || 'processing';
                const word = task.word || task.text || task.content_id || '—';
                return (
                  <div
                    key={`${task.task_id ?? task.content_id ?? word}-${index}`}
                    className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-500" />
                      <span className="min-w-0 flex-1 truncate text-lg font-bold text-slate-800 dark:text-slate-100" title={word}>
                        {word}
                      </span>
                      {task.language && (
                        <span className="rounded bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                          {task.language}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                      <span>{t('queueCenter.wordAudioQueue.stage')}: {t(`queueCenter.sentenceQueue.stage.${stage}`, { defaultValue: stage })}</span>
                      <span>{t('queueCenter.wordAudioQueue.elapsed')}: {formatDuration(task.elapsed_seconds)}</span>
                      {task.current_provider && <span>{t('queueCenter.wordAudioQueue.engine')}: {task.current_provider}</span>}
                      {task.priority != null && <span>{t('queueCenter.wordAudioQueue.priority')}: {task.priority}</span>}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="w-9 text-right font-mono text-xs text-slate-500">{Math.round(progress)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
