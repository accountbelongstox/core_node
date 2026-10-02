/**
 * Parallel transfers per backend (core/network/TransferLimiter): live
 * active / limit / queued of the pycore and Laravel lanes, and the limit of
 * each lane (device setting, applied at once, default from the contract).
 *   WfNewTransferBadge        mini widget (icons, opens a small editor)
 *   WfNewTransferLimitsPanel  the same rows on the Settings page
 */
import React, { useSyncExternalStore } from 'react';
import { Gauge, Minus, Plus, RotateCcw } from 'lucide-react';
import { TONE_TEXT } from '@/shared/ui/statusTone';
import { AUDIO_ORCH_TRANSFER } from '../../../../core/contracts/AudioOrchestrationContract';
import {
  TRANSFER_LANES,
  transferLimiter,
  type TransferLane,
  type TransferLaneState,
} from '../../../../core/network/TransferLimiter';
import type { ElementTheme } from '../../WfNewThemes';
import { WfNewIconCardSection } from '../api-center/WfNewIconCardSection';
import { ORCH_BACKEND_VIEW } from '../orch-compose/orchBackends';
import { StatPopover } from '../orch-compose/StatPopover';

type Trans = (key: string, replacements?: Record<string, string | number>) => string;


function useTransferSnapshot() {
  return useSyncExternalStore(transferLimiter.subscribe, transferLimiter.getSnapshot, transferLimiter.getSnapshot);
}

/** One lane: icon, live slots, limit stepper. */
const LaneRow: React.FC<{ lane: TransferLane; state: TransferLaneState; trans: Trans }> = ({ lane, state, trans }) => {
  const { icon: Icon, tone } = ORCH_BACKEND_VIEW[lane];
  const name = trans(`transfer.lane.${lane}`);
  const step = (delta: number): void => transferLimiter.setLimit(lane, state.limit + delta);
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${TONE_TEXT[tone]}`} aria-hidden />
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
          className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-bold ${TONE_TEXT.indigo} hover:bg-indigo-500/10 disabled:opacity-40`}
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
  return (
    <StatPopover
      theme={theme}
      title={trans('transfer.title')}
      panelClassName="w-72"
      chip={(
        <>
          <Gauge className="h-3 w-3 text-zinc-400" aria-hidden />
          {TRANSFER_LANES.map((lane) => {
            const { icon: Icon, tone } = ORCH_BACKEND_VIEW[lane];
            const state = snapshot[lane];
            return (
              <span key={lane} className="inline-flex items-center gap-0.5">
                <Icon className={`h-3 w-3 ${TONE_TEXT[tone]}`} aria-hidden />
                {state.active}/{state.limit}
                {state.queued > 0 && <span className={TONE_TEXT.amber}>+{state.queued}</span>}
              </span>
            );
          })}
        </>
      )}
    >
      <p className="mb-2 text-xs font-extrabold">{trans('transfer.title')}</p>
      <LaneRows trans={trans} />
    </StatPopover>
  );
};

/** Settings page section: the same rows, always open. */
export const WfNewTransferLimitsPanel: React.FC<{ activeTheme: ElementTheme; trans: Trans }> = ({ activeTheme, trans }) => (
  <WfNewIconCardSection icon={Gauge} title={trans('transfer.title')} description={trans('transfer.description')} theme={activeTheme} label={trans('transfer.title')}>
    <LaneRows trans={trans} />
  </WfNewIconCardSection>
);
