/**
 * Server counters of a book composition's audio plan (WordNewBookAudioPlan): what Laravel
 * reports for the whole book - ready / generating / queued / failed and which node generates
 * how many - live, independent of this device's resolve run.
 */
import React, { useCallback, useSyncExternalStore } from 'react';
import { Server } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import { SegmentedBar } from '@/shared/ui/ProgressBar';
import type { StatusTone } from '@/shared/ui/statusTone';
import type { ElementTheme } from '../../WfNewThemes';
import { AUDIO_ORCH_BOOK_PLAN } from '../../../../core/contracts/AudioOrchestrationContract';
import { wordNewBookAudioPlan } from '../../services/orchestration/WordNewBookAudioPlan';
import { useWordNewPycoreNodes, workNodeLabel } from '../../services/WordNewPycoreNodes';
import { OrchToneLegend } from './OrchToneLegend';
import { OrchPanel } from './orchPanels';
import { orchShare } from './orchRunProgress';

interface Props {
  taskId: string;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const SEGMENTS: ReadonlyArray<{ key: 'ready' | 'generating' | 'queued' | 'failed'; tone: StatusTone }> = [
  { key: 'ready', tone: 'emerald' },
  { key: 'generating', tone: 'violet' },
  { key: 'queued', tone: 'neutral' },
  { key: 'failed', tone: 'rose' },
];

export const WordNewOrchBookPlanProgress: React.FC<Props> = ({ taskId, theme, trans }) => {
  const subscribe = useCallback((listener: () => void) => wordNewBookAudioPlan.subscribe(taskId, listener), [taskId]);
  const read = useCallback(() => wordNewBookAudioPlan.snapshot(taskId), [taskId]);
  const plan = useSyncExternalStore(subscribe, read, read);
  const roster = useWordNewPycoreNodes();
  const status = plan?.status;
  if (!status) return null;
  const { total } = status;
  // A status from an older server (or mid-deploy) may lack nodes/assignments: never crash the page.
  const nodes = status.nodes ?? [];
  const windows = status.assignments?.windows ?? [];
  const appAssigned = status.assignments?.fresh === true;
  const percent = orchShare(status.ready, total);
  const legend = SEGMENTS.map(({ key, tone }) => ({
    key,
    tone,
    text: trans(`orchCompose.plan.${key}`, key === 'ready' ? { count: status.ready, total } : { count: status[key] }),
  }));

  return (
    <OrchPanel theme={theme} live label={trans('orchCompose.plan.title')} className="space-y-2">
      <div className="flex items-center gap-2">
        <Server className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
          {trans(status.state === 'building' ? 'orchCompose.plan.building' : 'orchCompose.plan.title')}
        </span>
        {total > 0 && <span className="shrink-0 font-mono text-xs font-bold text-zinc-700 dark:text-zinc-200">{percent}%</span>}
      </div>
      {total > 0 && (
        <SegmentedBar
          segments={SEGMENTS.map(({ key, tone }) => ({ key, value: status[key], tone }))}
          total={total}
          label={trans('orchCompose.plan.ready', { count: status.ready, total })}
        />
      )}
      <OrchToneLegend
        dots
        items={plan && plan.undelivered > 0
          ? [...legend, { key: 'undelivered', tone: 'sky', text: trans('orchCompose.plan.undelivered', { count: plan.undelivered }) }]
          : legend}
      />
      {nodes.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={trans('orchCompose.plan.nodes')}>
          {nodes.map((node) => (
            <li key={node.sid}>
              <Pill>
                {trans('orchCompose.plan.node', {
                  node: node.label || node.sid,
                  kind: node.platform ? `${node.platform}/${node.computeClass}` : node.computeClass,
                  count: node.count,
                })}
              </Pill>
            </li>
          ))}
        </ul>
      )}
      {windows.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
            {trans(appAssigned ? 'orchCompose.plan.assign.app' : 'orchCompose.plan.assign.server')}
          </p>
          <ul className="space-y-0.5 font-mono text-[10px] text-zinc-600 dark:text-zinc-300" aria-label={trans('orchCompose.plan.assign.title')}>
            {windows.map((window) => {
              const node = window.sid === AUDIO_ORCH_BOOK_PLAN.directSid
                ? trans('orchCompose.plan.assign.direct')
                : roster.nodes.filter((entry) => entry.sid === window.sid).map(workNodeLabel)[0] ?? window.sid;
              return (
                <li key={`${window.sid}|${window.lane}`}>
                  {trans('orchCompose.plan.assign.row', {
                    node,
                    lane: trans(`orchAssist.lane.${window.lane}`),
                    assigned: window.assigned,
                    generating: window.generating,
                    done: window.done,
                  })}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {status.fastPass && (
        <p className="text-[10px] text-zinc-500">{trans('orchCompose.plan.fastPass', { done: status.upgrade.done, total: status.upgrade.total })}</p>
      )}
    </OrchPanel>
  );
};
