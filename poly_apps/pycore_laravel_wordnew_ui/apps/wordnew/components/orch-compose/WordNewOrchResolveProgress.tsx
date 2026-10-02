/**
 * Loading a composition's resources: the phases, total progress with a bar per
 * source (device, pycore, Laravel, missing), the live storage widget, the APIs
 * the run actually talks to (switchable in place) and - when expanded - every
 * item with its source and transfer progress.
 */
import React, { useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronDown, CircleCheck, CircleDashed, Database, Download, List, ListTree, Loader2, Ruler, type LucideIcon } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import type { OrchComposePhase, OrchComposeSession, OrchInputsProgress } from '../../../../shared/orchestration/orchComposer';
import type { OrchClipEntry, OrchClipState } from '../../../../shared/orchestration/orchClipTable';
import type { OrchComposeResource } from '../../../../shared/orchestration/orchTypes';
import { WfNewStorageBadge } from '../device-storage/WfNewStorageBadge';
import { WordNewOrchApiEndpoints } from './WordNewOrchApiEndpoints';
import { WfNewTransferBadge } from '../transfer/WfNewTransferLimits';
import { WordNewOrchChainBadge } from './WordNewOrchChainBadge';
import { WordNewOrchAssistPanel } from './WordNewOrchAssistPanel';
import { formatBytes } from '../../../../core/utils/formatBytes';
import { useWordNewPycoreNodes, type WordNewPycoreNodesSnapshot } from '../../services/WordNewPycoreNodes';
import { floorOrchCounts } from '../../services/orchestration/WordNewOrchCountsFloor';

interface Props {
  session: OrchComposeSession | null;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onOpenStorage?: () => void;
}

const PHASES: Array<Exclude<OrchComposePhase, 'failed'>> = ['inputs', 'plan', 'resolve', 'measure', 'ready'];
const PHASE_ICON: Record<Exclude<OrchComposePhase, 'failed'>, LucideIcon> = {
  inputs: Database,
  plan: ListTree,
  resolve: Download,
  measure: Ruler,
  ready: CircleCheck,
};
const ORIGINS = ['device', 'pycore', 'laravel', 'missing'] as const;
const BAR_CLASS: Record<(typeof ORIGINS)[number], string> = {
  device: 'bg-emerald-400',
  pycore: 'bg-indigo-400',
  laravel: 'bg-sky-400',
  missing: 'bg-rose-400',
};
const TEXT_CLASS: Record<(typeof ORIGINS)[number], string> = {
  device: 'text-emerald-600 dark:text-emerald-300',
  pycore: 'text-indigo-600 dark:text-indigo-300',
  laravel: 'text-sky-600 dark:text-sky-300',
  missing: 'text-rose-600 dark:text-rose-300',
};
const MAX_ITEM_ROWS = 80;

/** One shown row: a plan index mapped to its resource and its table entry (nothing copied per item). */
interface RowView extends OrchClipEntry {
  index: number;
  resource: OrchComposeResource;
  loaded: number;
  total: number;
}

/** Rows in display order (loading, missing, done, then queued while resolving), at most `limit`. */
function rowsOf(session: OrchComposeSession | null, withQueued: boolean, limit: number): RowView[] {
  const table = session?.table;
  const resources = session?.plan?.resources;
  if (!table || !resources || resources.length !== table.size) return [];
  const order: OrchClipState[] = withQueued ? ['loading', 'missing', 'done', 'queued'] : ['loading', 'missing', 'done'];
  const rows: RowView[] = [];
  for (const state of order) {
    for (const index of table.indicesIn(state, limit - rows.length)) {
      const [loaded, total] = table.loading.get(index) ?? [0, 0];
      rows.push({ index, resource: resources[index], ...table.entry(index), loaded, total });
    }
    if (rows.length >= limit) break;
  }
  return rows;
}

function ItemRow({ row, trans, nodes }: { row: RowView; trans: Props['trans']; nodes: WordNewPycoreNodesSnapshot }): React.ReactElement {
  const item = { ...row, kind: row.resource.kind, text: row.resource.text };
  const percent = item.total > 0 ? Math.min(100, Math.round((item.loaded / item.total) * 100)) : null;
  const Icon = item.state === 'done' ? Check : item.state === 'loading' ? Loader2 : item.state === 'missing' ? AlertCircle : CircleDashed;
  const generating = item.state === 'missing' && item.generating !== null;
  const tone = item.state === 'done' ? 'text-emerald-600 dark:text-emerald-300'
    : generating ? 'text-violet-600 dark:text-violet-300'
      : item.state === 'missing' ? 'text-rose-600 dark:text-rose-300'
        : item.state === 'loading' ? 'text-amber-600 dark:text-amber-300' : 'text-zinc-500';
  // The channel it came over (relay vs direct pycore), else the backend generating it.
  const channel = item.via ?? (generating ? item.generating : null);
  // The pycore node Laravel leased it to (clip.leased delta), while it is still generating.
  const node = generating ? nodes.labelOf(item.kind, row.resource.language, item.text) : null;
  return (
    <li className="flex items-center gap-2 py-1 text-[11px]">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${tone} ${item.state === 'loading' ? 'animate-spin' : ''}`} aria-hidden />
      <span className="w-4 shrink-0 text-center font-mono text-[9px] text-zinc-500" title={trans(`orchCompose.progress.kind.${item.kind}`)}>
        {item.kind === 'word' ? 'W' : 'S'}
      </span>
      <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">{item.text}</span>
      {(channel || item.origin) && (
        <span className="shrink-0 rounded-full border border-slate-200 dark:border-white/10 px-1.5 text-[9px] text-zinc-500 dark:text-zinc-400">
          {node ? trans('orchChain.channel.node', { node }) : channel ? trans(`orchChain.channel.${channel}`) : trans(`orchCompose.progress.origin.${item.origin}`)}
        </span>
      )}
      <span className="w-20 shrink-0">
        {item.state === 'loading' && percent !== null ? (
          <span className="block h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <span className="block h-full bg-amber-400" style={{ width: `${percent}%` }} />
          </span>
        ) : (
          <span className={`block text-right text-[10px] ${tone}`}>{trans(generating ? 'orchChain.generating' : `orchCompose.progress.state.${item.state}`)}</span>
        )}
      </span>
    </li>
  );
}

interface BarRow {
  key: string;
  done: number;
  total: number;
  bar: string;
}

/** Input load: sentence pages, then word read-state batches (each with its own bar). */
function inputRows(progress: OrchInputsProgress): BarRow[] {
  return [
    { key: 'inputs.sentences', done: progress.sentences, total: progress.sentencesTotal, bar: 'bg-sky-400' },
    { key: 'inputs.words', done: progress.words, total: progress.wordsTotal, bar: 'bg-emerald-400' },
  ];
}

function ProgressBars({ rows, trans }: { rows: BarRow[]; trans: Props['trans'] }): React.ReactElement {
  return (
    <div className="space-y-1">
      {rows.map((row) => {
        const share = row.total > 0 ? Math.min(100, (row.done / row.total) * 100) : 0;
        return (
          <div key={row.key} className="flex items-center gap-2 text-[11px]">
            <span className="w-28 shrink-0 text-zinc-600 dark:text-zinc-300">{trans(`orchCompose.progress.${row.key}`, { done: row.done, total: row.total || '?' })}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={row.total} aria-valuenow={row.done}>
              <span className={`block h-full ${row.bar} transition-[width] duration-300`} style={{ width: `${share}%` }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const WordNewOrchResolveProgress: React.FC<Props> = ({ session, theme, trans, onOpenStorage }) => {
  const [expanded, setExpanded] = useState(false);
  const nodes = useWordNewPycoreNodes();
  const phase = session?.phase ?? 'inputs';
  const counts = session ? floorOrchCounts(session.planHash, session.counts) : undefined;
  const total = counts?.total ?? 0;
  const settled = total - (counts?.pending ?? 0);
  const percent = total > 0 ? Math.round((settled / total) * 100) : 0;
  const reached = PHASES.indexOf(phase === 'failed' ? 'inputs' : phase);
  const tableVersion = session?.table?.version ?? -1;
  const loadingCount = session?.table?.loading.size ?? 0;
  // Re-read on a new table version only (the table is one byte per resource; rows map indices to the plan).
  const rows = useMemo(
    () => (expanded ? rowsOf(session, phase === 'resolve', MAX_ITEM_ROWS) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the table version, not the session object
    [expanded, tableVersion, session?.plan, phase],
  );

  return (
    <section className={`space-y-2.5 rounded-2xl border border-slate-200 dark:border-white/5 p-3 ${theme.cardClass}`} aria-live="polite" aria-label={trans('orchCompose.progress.title')}>
      <div className="flex items-center gap-2">
        <ol className="flex min-w-0 flex-1 items-center gap-1" aria-label={trans('orchCompose.progress.title')}>
          {PHASES.map((step, index) => {
            const complete = phase !== 'failed' && (index < reached || (step === 'ready' && phase === 'ready'));
            const current = phase !== 'failed' && index === reached && step !== 'ready';
            const Icon = PHASE_ICON[step];
            const label = trans(`orchCompose.phase.${step}`);
            return (
              <li key={step} className={`flex items-center gap-1 ${current ? 'min-w-0' : 'shrink-0'}`} aria-current={current ? 'step' : undefined}>
                {index > 0 && <span className={`h-px w-2.5 shrink-0 ${complete || current ? 'bg-emerald-400/60' : 'bg-slate-300 dark:bg-white/10'}`} aria-hidden />}
                <span
                  title={label}
                  aria-label={label}
                  className={`inline-flex min-w-0 items-center gap-1 rounded-full text-[11px] ${
                    current ? `px-2 py-0.5 font-bold ${theme.accentBg}`
                      : complete ? 'p-1 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10'
                        : 'p-1 text-zinc-400 dark:text-zinc-500 bg-slate-500/10'
                  }`}
                >
                  {current ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> : <Icon className="h-3 w-3 shrink-0" aria-hidden />}
                  {current && <span className="truncate">{label}</span>}
                </span>
              </li>
            );
          })}
        </ol>
        {total > 0 && <span className="shrink-0 font-mono text-xs font-bold text-zinc-700 dark:text-zinc-200">{percent}%</span>}
      </div>

      {phase === 'inputs' && session?.inputsProgress && <ProgressBars rows={inputRows(session.inputsProgress)} trans={trans} />}
      {phase === 'measure' && session?.measureProgress && (
        <ProgressBars rows={[{ key: 'measure', done: session.measureProgress.done, total: session.measureProgress.total, bar: 'bg-violet-400' }]} trans={trans} />
      )}

      {total > 0 && (
        <>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={settled} aria-label={trans('orchCompose.progress.resources', { done: settled, total })}>
            {ORIGINS.map((key) => (
              <div key={key} className={`${BAR_CLASS[key]} transition-[width] duration-300`} style={{ width: `${((counts?.[key] ?? 0) / total) * 100}%` }} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
            <span className="text-zinc-600 dark:text-zinc-300">{trans('orchCompose.progress.resources', { done: settled, total })}</span>
            {loadingCount > 0 && <span className="text-amber-600 dark:text-amber-300">{trans('orchCompose.progress.loadingNow', { count: loadingCount })}</span>}
            {phase === 'resolve' && session && session.transfer.bytesPerSecond > 0 && (
              <span className="font-mono text-sky-600 dark:text-sky-300">
                {trans('orchCompose.progress.rate', { rate: formatBytes(session.transfer.bytesPerSecond), total: formatBytes(session.transfer.bytes) })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]">
              {ORIGINS.map((key) => (
                <span key={key} className={`inline-flex items-center gap-1 ${TEXT_CLASS[key]}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${BAR_CLASS[key]}`} aria-hidden />
                  {trans(`orchCompose.count.${key}`, { count: counts?.[key] ?? 0 })}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-label={trans(expanded ? 'orchCompose.progress.hideItems' : 'orchCompose.progress.showItems')}
              title={trans(expanded ? 'orchCompose.progress.hideItems' : 'orchCompose.progress.showItems')}
              className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-1.5 py-1 text-[10px] font-bold transition-colors ${
                expanded ? theme.accentBg : 'border-slate-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/10'
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden />
              {expanded && <span>{trans('orchCompose.progress.hideItems')}</span>}
              <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          </div>
          {expanded && (
            <ul className="max-h-64 divide-y divide-slate-200 dark:divide-white/5 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/5 px-2">
              {rows.map((row) => <ItemRow key={row.index} row={row} trans={trans} nodes={nodes} />)}
            </ul>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200 dark:border-white/5 pt-2.5">
        <WordNewOrchChainBadge session={session} theme={theme} trans={trans} />
        <WfNewTransferBadge theme={theme} trans={trans} />
        <WfNewStorageBadge trans={trans} onOpen={onOpenStorage} />
        <WordNewOrchApiEndpoints endpoints={session?.endpoints ?? {}} theme={theme} trans={trans} />
      </div>
      <WordNewOrchAssistPanel session={session} theme={theme} trans={trans} />
      {session && !session.inputsFresh && phase !== 'inputs' && (
        <p className="text-[11px] text-amber-600 dark:text-amber-300">{trans('orchCompose.inputsOffline')}</p>
      )}
      {phase === 'failed' && session && <p className="text-[11px] text-rose-600 dark:text-rose-300">{trans(session.error)}</p>}
      {phase === 'ready' && (counts?.missing ?? 0) > 0 && (
        <p className="text-[11px] text-zinc-500">{trans('orchCompose.missingHint')}</p>
      )}
    </section>
  );
};
