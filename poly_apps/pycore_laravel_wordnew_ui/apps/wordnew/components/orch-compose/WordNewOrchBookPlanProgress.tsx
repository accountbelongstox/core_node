/**
 * Server counters of a book composition's audio plan (WordNewBookAudioPlan): what Laravel
 * reports for the whole book - ready / generating / queued / failed and which node generates
 * how many - live, independent of this device's resolve run.
 */
import React, { useCallback, useSyncExternalStore } from 'react';
import { Languages, Server } from 'lucide-react';
import { NoticeBanner } from '@/shared/ui/NoticeBanner';
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

function emptyLanguageName(lang: string, trans: Props['trans']): string {
  const key = `orchCompose.langName.${lang}`;
  const name = trans(key);
  return name && name !== key ? name : lang.toUpperCase();
}

export const WordNewOrchBookPlanProgress: React.FC<Props> = ({ taskId, theme, trans }) => {
  const subscribe = useCallback((listener: () => void) => wordNewBookAudioPlan.subscribe(taskId, listener), [taskId]);
  const read = useCallback(() => wordNewBookAudioPlan.snapshot(taskId), [taskId]);
  const plan = useSyncExternalStore(subscribe, read, read);
  const roster = useWordNewPycoreNodes();
  const status = plan?.status;
  if (!status) return null;
  const scope = plan?.scope ?? { total: status.total, ready: status.ready, generating: status.generating, queued: status.queued, failed: status.failed, outside: 0 };
  const { total } = scope;
  // A status from an older server (or mid-deploy) may lack nodes/assignments: never crash the page.
  const nodes = status.nodes ?? [];
  const emptyLanguages = status.emptyLanguages ?? [];
  const windows = status.assignments?.windows ?? [];
  const appAssigned = status.assignments?.fresh === true;
  const percent = orchShare(scope.ready, total);
  const legend = SEGMENTS.map(({ key, tone }) => ({
    key,
    tone,
    text: trans(`orchCompose.plan.${key}`, key === 'ready' ? { count: scope.ready, total } : { count: scope[key] }),
  }));

  return (
    <OrchPanel theme={theme} live label={trans('orchCompose.plan.title')} className="space-y-2">
      <div className="flex items-center gap-2">
        <Server className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
          {status.state === 'building' ? trans('orchCompose.plan.building') : trans('orchCompose.plan.titleScoped', { total, whole: status.total })}
        </span>
        {total > 0 && <span className="shrink-0 font-mono text-xs font-bold text-zinc-700 dark:text-zinc-200">{percent}%</span>}
      </div>
      {total > 0 && (
        <SegmentedBar
          segments={SEGMENTS.map(({ key, tone }) => ({ key, value: scope[key], tone }))}
          total={total}
          label={trans('orchCompose.plan.ready', { count: scope.ready, total })}
        />
      )}
      <OrchToneLegend
        dots
        items={[
          ...legend,
          ...(plan && plan.undelivered > 0 ? [{ key: 'undelivered', tone: 'sky' as const, text: trans('orchCompose.plan.undelivered', { count: plan.undelivered }) }] : []),
          ...(scope.outside > 0 ? [{ key: 'outside', tone: 'neutral' as const, text: trans('orchCompose.plan.outside', { count: scope.outside }) }] : []),
        ]}
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
      {emptyLanguages.length > 0 && (
        <NoticeBanner icon={Languages}>
          {emptyLanguages.map((lang) => (
            <p key={lang}>{trans('orchCompose.plan.emptyLanguages', { language: emptyLanguageName(lang, trans) })}</p>
          ))}
        </NoticeBanner>
      )}
      {status.fastPass && (
        <p className="text-[10px] text-zinc-500">{trans('orchCompose.plan.fastPass', { done: status.upgrade.done, total: status.upgrade.total })}</p>
      )}
    </OrchPanel>
  );
};
