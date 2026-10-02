/**
 * The clip schedule of a run, as a mini widget: every stage of the chain
 * (shared/orchestration/orchClipScheduler) with what it delivered / was asked
 * to generate this run, dimmed while the stage cannot run (its channel is not
 * usable now - the shared `wordNewChannels`, the same answer the scheduler gates on).
 * A click lists the stages with their state.
 */
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AlertCircle, Route, Server, Smartphone, Sparkles, Waypoints } from 'lucide-react';
import type { OrchComposeSession } from '../../../../shared/orchestration/orchComposer';
import type { ElementTheme } from '../../WfNewThemes';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { wordNewChannels } from '../../services/compute/WordNewCompute';

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
  icon: typeof Server;
  generate: boolean;
  count: number;
  /** The stage can run now. */
  active: boolean;
}

const TONE: Record<StageId, string> = {
  device: 'text-emerald-600 dark:text-emerald-300',
  pycore: 'text-indigo-600 dark:text-indigo-300',
  laravel: 'text-sky-600 dark:text-sky-300',
  pycoreGenerate: 'text-indigo-600 dark:text-indigo-300',
  relay: 'text-violet-600 dark:text-violet-300',
  relayGenerate: 'text-violet-600 dark:text-violet-300',
  laravelGenerate: 'text-sky-600 dark:text-sky-300',
  missing: 'text-rose-600 dark:text-rose-300',
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
  const view = (id: StageId, icon: typeof Server, active: boolean, generate = false): StageView => ({ id, icon, generate, count: counts[id], active });
  const transfers = [view('pycore', Waypoints, channels.pycore), view('laravel', Server, channels.laravel)];
  return [
    ...(native ? [view('device', Smartphone, true)] : []),
    ...(native ? transfers : transfers.reverse()),
    view('pycoreGenerate', Waypoints, channels.pycore, true),
    view('relay', Route, relayOnly),
    view('relayGenerate', Route, relayOnly, true),
    view('laravelGenerate', Server, !channels.pycore && !channels.relay && channels.laravel, true),
    view('missing', AlertCircle, true),
  ];
}

export const WordNewOrchChainBadge: React.FC<{ session: OrchComposeSession | null; theme: ElementTheme; trans: Trans }> = ({ session, theme, trans }) => {
  const channels = useSyncExternalStore(wordNewChannels.subscribe, readChannels, readChannels);
  const tableVersion = session?.table?.version ?? -1;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the table version and counts, not the session object
  const views = useMemo(() => stages(session, channels), [tableVersion, session?.counts, channels]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-full">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={trans('orchChain.title')}
        title={trans('orchChain.title')}
        className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-1.5 py-1 font-mono text-[10px] leading-none hover:bg-slate-200/70 dark:hover:bg-white/10"
      >
        {views.map((stage) => {
          const Icon = stage.icon;
          return (
            <span key={stage.id} className={`inline-flex items-center gap-0.5 ${TONE[stage.id]} ${stage.active ? '' : 'opacity-35'}`}>
              {stage.generate && <Sparkles className="h-2.5 w-2.5" aria-hidden />}
              <Icon className="h-3 w-3" aria-hidden />
              {stage.count}
            </span>
          );
        })}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={trans('orchChain.title')}
          className={`absolute right-0 z-30 mt-1 w-80 max-w-[calc(100vw-2rem)] space-y-1.5 rounded-xl border border-slate-200 dark:border-white/10 p-3 shadow-lg ${theme.cardClass}`}
        >
          <p className="text-xs font-extrabold">{trans('orchChain.title')}</p>
          <ol className="space-y-1">
            {views.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <li key={stage.id} className={`flex items-start gap-2 text-[11px] ${stage.active ? '' : 'opacity-50'}`}>
                  <span className="w-4 shrink-0 text-right font-mono text-zinc-400">{index + 1}</span>
                  <span className={`inline-flex shrink-0 items-center ${TONE[stage.id]}`}>
                    {stage.generate && <Sparkles className="h-3 w-3" aria-hidden />}
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{trans(`orchChain.stage.${stage.id}`)} · <span className="font-mono">{stage.count}</span></span>
                    {(() => {
                      const work = SCHEDULE_STAGE[stage.id] ? session?.stages[SCHEDULE_STAGE[stage.id] as string] : undefined;
                      return work ? (
                        <span className="block font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                          {trans(`orchChain.work.${work.state}`, {
                            done: work.batchesDone, batches: work.batches, asked: work.asked, known: work.known, found: work.found, reason: work.reason ?? '',
                          })}
                        </span>
                      ) : null;
                    })()}
                    <span className="block text-[10px] text-zinc-500 dark:text-zinc-400">
                      {trans(stage.active ? `orchChain.hint.${stage.id}` : 'orchChain.inactive')}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
};
