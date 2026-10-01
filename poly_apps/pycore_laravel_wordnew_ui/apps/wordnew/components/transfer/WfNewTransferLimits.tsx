/**
 * Parallel transfers per backend (core/network/TransferLimiter): live
 * active / limit / queued of the pycore and Laravel lanes, and the limit of
 * each lane (device setting, applied at once, default from the contract).
 *   WfNewTransferBadge        mini widget (icons, opens a small editor)
 *   WfNewTransferLimitsPanel  the same rows on the Settings page
 */
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Gauge, Minus, Plus, RotateCcw, Server, Waypoints } from 'lucide-react';
import { AUDIO_ORCH_TRANSFER } from '../../../../core/contracts/AudioOrchestrationContract';
import {
  TRANSFER_LANES,
  transferLimiter,
  type TransferLane,
  type TransferLaneState,
} from '../../../../core/network/TransferLimiter';
import type { ElementTheme } from '../../WfNewThemes';

type Trans = (key: string, replacements?: Record<string, string | number>) => string;

const LANE_ICON: Record<TransferLane, typeof Server> = { pycore: Waypoints, laravel: Server };
const LANE_TONE: Record<TransferLane, string> = {
  pycore: 'text-indigo-600 dark:text-indigo-300',
  laravel: 'text-sky-600 dark:text-sky-300',
};

function useTransferSnapshot() {
  return useSyncExternalStore(transferLimiter.subscribe, transferLimiter.getSnapshot, transferLimiter.getSnapshot);
}

/** One lane: icon, live slots, limit stepper. */
const LaneRow: React.FC<{ lane: TransferLane; state: TransferLaneState; trans: Trans }> = ({ lane, state, trans }) => {
  const Icon = LANE_ICON[lane];
  const name = trans(`transfer.lane.${lane}`);
  const step = (delta: number): void => transferLimiter.setLimit(lane, state.limit + delta);
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${LANE_TONE[lane]}`} aria-hidden />
      <span className="w-14 shrink-0 font-bold text-zinc-700 dark:text-zinc-200">{name}</span>
      <span className="min-w-0 flex-1 font-mono text-zinc-500 dark:text-zinc-400" aria-live="polite">
        {trans('transfer.live', { active: state.active, limit: state.limit, queued: state.queued })}
      </span>
      <div className="flex shrink-0 items-center gap-1" role="group" aria-label={trans('transfer.limitOf', { lane: name })}>
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={state.limit <= 1}
          className="rounded-md border border-slate-200 dark:border-white/10 p-1 hover:bg-slate-500/10 disabled:opacity-40"
          aria-label={trans('transfer.decrease', { lane: name })}
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="w-6 text-center font-mono font-bold" title={trans('transfer.defaultIs', { value: state.defaultLimit })}>{state.limit}</span>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={state.limit >= AUDIO_ORCH_TRANSFER.parallelMax}
          className="rounded-md border border-slate-200 dark:border-white/10 p-1 hover:bg-slate-500/10 disabled:opacity-40"
          aria-label={trans('transfer.increase', { lane: name })}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

const LaneRows: React.FC<{ trans: Trans }> = ({ trans }) => {
  const snapshot = useTransferSnapshot();
  const isDefault = TRANSFER_LANES.every((lane) => snapshot[lane].limit === snapshot[lane].defaultLimit);
  return (
    <div className="space-y-2">
      {TRANSFER_LANES.map((lane) => <LaneRow key={lane} lane={lane} state={snapshot[lane]} trans={trans} />)}
      <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
        <span>{trans('transfer.hint', { max: AUDIO_ORCH_TRANSFER.parallelMax })}</span>
        <button
          type="button"
          onClick={() => transferLimiter.resetLimits()}
          disabled={isDefault}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-40"
        >
          <RotateCcw className="h-3 w-3" />
          {trans('transfer.reset')}
        </button>
      </div>
    </div>
  );
};

/** Mini widget: per lane icon + active/limit (+queued); a click opens the limit editor. */
export const WfNewTransferBadge: React.FC<{ theme: ElementTheme; trans: Trans }> = ({ theme, trans }) => {
  const snapshot = useTransferSnapshot();
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
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={trans('transfer.title')}
        title={trans('transfer.title')}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-1.5 py-1 font-mono text-[10px] leading-none text-zinc-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/10"
      >
        <Gauge className="h-3 w-3 text-zinc-400" aria-hidden />
        {TRANSFER_LANES.map((lane) => {
          const Icon = LANE_ICON[lane];
          const state = snapshot[lane];
          return (
            <span key={lane} className="inline-flex items-center gap-0.5">
              <Icon className={`h-3 w-3 ${LANE_TONE[lane]}`} aria-hidden />
              {state.active}/{state.limit}
              {state.queued > 0 && <span className="text-amber-600 dark:text-amber-300">+{state.queued}</span>}
            </span>
          );
        })}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={trans('transfer.title')}
          className={`absolute right-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 dark:border-white/10 p-3 shadow-lg ${theme.cardClass}`}
        >
          <p className="mb-2 text-xs font-extrabold">{trans('transfer.title')}</p>
          <LaneRows trans={trans} />
        </div>
      )}
    </div>
  );
};

/** Settings page section: the same rows, always open. */
export const WfNewTransferLimitsPanel: React.FC<{ activeTheme: ElementTheme; trans: Trans }> = ({ activeTheme, trans }) => (
  <section className={`p-6 rounded-3xl ${activeTheme.cardClass} shadow-sm space-y-3`} aria-label={trans('transfer.title')}>
    <div className="flex items-center gap-3">
      <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500 shrink-0">
        <Gauge className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-extrabold">{trans('transfer.title')}</h3>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{trans('transfer.description')}</p>
      </div>
    </div>
    <LaneRows trans={trans} />
  </section>
);
