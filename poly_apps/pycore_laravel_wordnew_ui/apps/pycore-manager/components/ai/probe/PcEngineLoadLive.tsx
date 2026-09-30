/**
 * PcEngineLoadLive — live model-load view of one engine while a test runs: a
 * state badge (loading / loaded / error), the load timer and the streaming log tail.
 */
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import type { EngineLoadStatusEntry } from '@/apps/pycore-manager/api';
import { PcStatusPill, type PcTone } from '../PcStatusPill';

const MS_PER_SECOND = 1000;

const STATE_TONE: Record<string, PcTone> = { loading: 'warn', loaded: 'ok', error: 'bad' };
const STATE_ICON: Record<string, React.FC<{ className?: string }>> = {
  loading: Loader2,
  loaded: Check,
  error: AlertTriangle,
};

export const PcEngineLoadLive: React.FC<{ entry: EngineLoadStatusEntry }> = ({ entry }) => {
  const { t } = useTranslation('pc');
  const logRef = useRef<HTMLPreElement | null>(null);
  const lines = entry.log_tail ?? [];
  const state = STATE_TONE[entry.state] ? entry.state : 'loading';

  useEffect(() => {
    const element = logRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lines.length]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <PcStatusPill
          tone={STATE_TONE[state]}
          Icon={STATE_ICON[state]}
          busy={state === 'loading'}
          label={t(`engineLoad.${state}`)}
        />
        <span className="font-mono text-slate-400">
          {t('engineLoad.elapsed')} {Math.max(0, entry.elapsed_ms / MS_PER_SECOND).toFixed(1)}s
        </span>
        {entry.device && <span className="font-mono text-slate-400 opacity-70">{entry.device}</span>}
        {entry.message && <span className="text-slate-500 truncate min-w-0">{entry.message}</span>}
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{t('engineLoad.liveLog')}</div>
        <pre
          ref={logRef}
          className="whitespace-pre-wrap break-words font-mono text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-950 rounded-lg p-2 max-h-44 overflow-auto">
          {lines.length ? lines.join('\n') : <span className="text-slate-400 italic">{t('engineLoad.waitingOutput')}</span>}
        </pre>
      </div>
    </div>
  );
};
