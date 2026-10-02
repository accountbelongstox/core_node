/**
 * Server counters of a book composition's audio plan (WordNewBookAudioPlan): what Laravel
 * reports for the whole book - ready / generating / queued / failed and which node generates
 * how many - live, independent of this device's resolve run.
 */
import React, { useCallback, useSyncExternalStore } from 'react';
import { Server } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { wordNewBookAudioPlan } from '../../services/orchestration/WordNewBookAudioPlan';

interface Props {
  taskId: string;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const SEGMENTS = [
  { key: 'ready', bar: 'bg-emerald-400', text: 'text-emerald-600 dark:text-emerald-300' },
  { key: 'generating', bar: 'bg-violet-400', text: 'text-violet-600 dark:text-violet-300' },
  { key: 'queued', bar: 'bg-slate-300 dark:bg-white/20', text: 'text-zinc-500 dark:text-zinc-400' },
  { key: 'failed', bar: 'bg-rose-400', text: 'text-rose-600 dark:text-rose-300' },
] as const;

export const WordNewOrchBookPlanProgress: React.FC<Props> = ({ taskId, theme, trans }) => {
  const subscribe = useCallback((listener: () => void) => wordNewBookAudioPlan.subscribe(taskId, listener), [taskId]);
  const read = useCallback(() => wordNewBookAudioPlan.snapshot(taskId), [taskId]);
  const plan = useSyncExternalStore(subscribe, read, read);
  const status = plan?.status;
  if (!status) return null;
  const { total } = status;
  const percent = total > 0 ? Math.round((status.ready / total) * 100) : 0;

  return (
    <section className={`space-y-2 rounded-2xl border border-slate-200 dark:border-white/5 p-3 ${theme.cardClass}`} aria-live="polite" aria-label={trans('orchCompose.plan.title')}>
      <div className="flex items-center gap-2">
        <Server className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
          {trans(status.state === 'building' ? 'orchCompose.plan.building' : 'orchCompose.plan.title')}
        </span>
        {total > 0 && <span className="shrink-0 font-mono text-xs font-bold text-zinc-700 dark:text-zinc-200">{percent}%</span>}
      </div>
      {total > 0 && (
        <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={status.ready} aria-label={trans('orchCompose.plan.ready', { count: status.ready, total })}>
          {SEGMENTS.map(({ key, bar }) => (
            <div key={key} className={`${bar} transition-[width] duration-300`} style={{ width: `${(status[key] / total) * 100}%` }} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]">
        <span className="text-zinc-600 dark:text-zinc-300">{trans('orchCompose.plan.ready', { count: status.ready, total })}</span>
        {SEGMENTS.filter(({ key }) => key !== 'ready').map(({ key, text }) => (
          <span key={key} className={text}>{trans(`orchCompose.plan.${key}`, { count: status[key] })}</span>
        ))}
        {plan && plan.undelivered > 0 && <span className="text-sky-600 dark:text-sky-300">{trans('orchCompose.plan.undelivered', { count: plan.undelivered })}</span>}
      </div>
      {status.nodes.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={trans('orchCompose.plan.nodes')}>
          {status.nodes.map((node) => (
            <li key={node.sid} className="rounded-full border border-slate-200 dark:border-white/10 px-2 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-300">
              {trans('orchCompose.plan.node', {
                node: node.label || node.sid,
                kind: node.platform ? `${node.platform}/${node.computeClass}` : node.computeClass,
                count: node.count,
              })}
            </li>
          ))}
        </ul>
      )}
      {status.fastPass && (
        <p className="text-[10px] text-zinc-500">{trans('orchCompose.plan.fastPass', { done: status.upgrade.done, total: status.upgrade.total })}</p>
      )}
    </section>
  );
};
