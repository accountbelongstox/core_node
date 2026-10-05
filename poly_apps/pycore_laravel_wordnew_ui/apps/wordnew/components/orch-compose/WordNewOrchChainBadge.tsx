/**
 * The clip schedule of a run, as a mini widget: every stage of the chain
 * (shared/orchestration/orchClipScheduler) with what it delivered / was asked
 * to generate this run, dimmed while the stage cannot run (its channel is not
 * usable now - the shared `wordNewChannels`, the same answer the scheduler gates on).
 * A click lists the stages with their state.
 */
import React, { useMemo, useSyncExternalStore } from 'react';
import { Sparkles } from 'lucide-react';
import { TONE_TEXT } from '@/shared/ui/statusTone';
import type { OrchComposeSession } from '../../../../shared/orchestration/orchComposer';
import type { ElementTheme } from '../../WfNewThemes';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { wordNewChannels } from '../../services/compute/WordNewCompute';
import { ORCH_BACKEND_VIEW, type OrchBackendId } from './orchBackends';
import { StatPopover } from './StatPopover';

interface ChannelView {
  pycore: boolean;
  relay: boolean;
  laravel: boolean;
}

/** Stable snapshot of the shared channel availability (a new object only when a channel changes). */
let channelView: ChannelView = { pycore: false, relay: false, laravel: false };
function readChannels(): ChannelView {
  const next = { pycore: wordNewChannels.direct(), relay: wordNewChannels.relay(), laravel: wordNewChannels.laravel() };
  if (next.pycore !== channelView.pycore || next.relay !== channelView.relay || next.laravel !== channelView.laravel) channelView = next;
  return channelView;
}

type Trans = (key: string, replacements?: Record<string, string | number>) => string;

type StageId = 'device' | 'pycore' | 'laravel' | 'pycoreGenerate' | 'relay' | 'relayGenerate' | 'laravelGenerate' | 'missing';

interface StageView {
  id: StageId;
  generate: boolean;
  count: number;
  /** The stage can run now. */
  active: boolean;
}

const STAGE_BACKEND: Record<StageId, OrchBackendId> = {
  device: 'device',
  pycore: 'pycore',
  laravel: 'laravel',
  pycoreGenerate: 'pycore',
  relay: 'relay',
  relayGenerate: 'relay',
  laravelGenerate: 'laravel',
  missing: 'missing',
};

/** Scheduler stage id of each widget stage (its batch progress in `session.stages`). */
const SCHEDULE_STAGE: Record<StageId, string | null> = {
  device: 'device',
  pycore: 'transfer:pycore',
  laravel: 'transfer:laravel',
  pycoreGenerate: 'generate:pycore',
  relay: 'transfer:relay',
  relayGenerate: 'generate:relay',
  laravelGenerate: 'generate:laravel',
  missing: null,
};

/** Counts from the run's state table (all plan resources; not the kept row sample). */
function stageCounts(session: OrchComposeSession | null): Record<StageId, number> {
  const table = session?.table?.counts();
  const counts = session?.counts;
  return {
    device: table?.device ?? counts?.device ?? 0,
    pycore: table ? table.pycore - table.relay : counts?.pycore ?? 0,
    laravel: table?.laravel ?? counts?.laravel ?? 0,
    pycoreGenerate: table?.generatingBy.pycore ?? 0,
    relay: table?.relay ?? 0,
    relayGenerate: table?.generatingBy.relay ?? 0,
    laravelGenerate: table?.generatingBy.laravel ?? 0,
    missing: table ? table.missing - table.generating : Math.max(0, (counts?.missing ?? 0) - (counts?.generating ?? 0)),
  };
}

function stages(session: OrchComposeSession | null, channels: ChannelView): StageView[] {
  const counts = stageCounts(session);
  // `relay` already means: no direct pycore, Laravel up, a pycore paired.
  const relayOnly = channels.relay;
  const native = isNativeAppShell();
  const view = (id: StageId, active: boolean, generate = false): StageView => ({ id, generate, count: counts[id], active });
  const transfers = [view('pycore', channels.pycore), view('laravel', channels.laravel)];
  return [
    ...(native ? [view('device', true)] : []),
    ...(native ? transfers : transfers.reverse()),
    view('pycoreGenerate', channels.pycore, true),
    view('relay', relayOnly),
    view('relayGenerate', relayOnly, true),
    view('laravelGenerate', !channels.pycore && !channels.relay && channels.laravel, true),
    view('missing', true),
  ];
}

/** Plan indices of the phrase clips (they ride the same stages as every clip; this only tells how far they are). */
function phraseIndices(session: OrchComposeSession | null): number[] {
  const resources = session?.plan?.resources;
  if (!resources || resources.length !== session?.table?.size) return [];
  return resources.flatMap((resource, index) => (resource.kind === 'phrase' ? [index] : []));
}

export const WordNewOrchChainBadge: React.FC<{ session: OrchComposeSession | null; theme: ElementTheme; trans: Trans }> = ({ session, theme, trans }) => {
  const channels = useSyncExternalStore(wordNewChannels.subscribe, readChannels, readChannels);
  const tableVersion = session?.table?.version ?? -1;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the table version and counts, not the session object
  const views = useMemo(() => stages(session, channels), [tableVersion, session?.counts, channels]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the plan's resources and the table, not the session object
  const phrases = useMemo(() => phraseIndices(session), [session?.plan?.resources, session?.table]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the table version
  const phrasesDone = useMemo(() => phrases.filter((index) => session?.table?.state(index) === 'done').length, [phrases, tableVersion]);

  return (
    <StatPopover
      theme={theme}
      title={trans('orchChain.title')}
      fluid
      panelClassName="w-80 space-y-1.5"
      chip={(
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {views.map((stage) => {
            const { icon: Icon, tone } = ORCH_BACKEND_VIEW[STAGE_BACKEND[stage.id]];
            return (
              <span key={stage.id} className={`inline-flex items-center gap-0.5 ${TONE_TEXT[tone]} ${stage.active ? '' : 'opacity-35'}`}>
                {stage.generate && <Sparkles className="h-2.5 w-2.5" aria-hidden />}
                <Icon className="h-3 w-3" aria-hidden />
                {stage.count}
              </span>
            );
          })}
        </span>
      )}
    >
      <p className="text-xs font-extrabold">{trans('orchChain.title')}</p>
      {phrases.length > 0 && <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{trans('orchChain.phrases', { done: phrasesDone, total: phrases.length })}</p>}
      <ol className="space-y-1">
        {views.map((stage, index) => {
          const { icon: Icon, tone } = ORCH_BACKEND_VIEW[STAGE_BACKEND[stage.id]];
          const scheduleStage = SCHEDULE_STAGE[stage.id];
          const work = scheduleStage ? session?.stages[scheduleStage] : undefined;
          return (
            <li key={stage.id} className={`flex items-start gap-2 text-[11px] ${stage.active ? '' : 'opacity-50'}`}>
              <span className="w-4 shrink-0 text-right font-mono text-zinc-400">{index + 1}</span>
              <span className={`inline-flex shrink-0 items-center ${TONE_TEXT[tone]}`}>
                {stage.generate && <Sparkles className="h-3 w-3" aria-hidden />}
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{trans(`orchChain.stage.${stage.id}`)} · <span className="font-mono">{stage.count}</span></span>
                {work && (
                  <span className="block font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                    {trans(`orchChain.work.${work.state}`, {
                      done: work.batchesDone, batches: work.batches, asked: work.asked, known: work.known, found: work.found, reason: work.reason ?? '',
                    })}
                  </span>
                )}
                <span className="block text-[10px] text-zinc-500 dark:text-zinc-400">
                  {trans(stage.active ? `orchChain.hint.${stage.id}` : 'orchChain.inactive')}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </StatPopover>
  );
};
