import type { WordNewApiServiceState } from '../../api/center/WordNewApiCenter';

export const API_STATE_DOT: Record<WordNewApiServiceState, string> = {
  checking: 'bg-amber-400 animate-pulse',
  online: 'bg-emerald-400',
  offline: 'bg-rose-400',
};

export const API_STATE_CHIP: Record<WordNewApiServiceState, string> = {
  checking: 'bg-zinc-400/10 text-zinc-400',
  online: 'bg-emerald-500/10 text-emerald-500',
  offline: 'bg-rose-500/10 text-rose-500',
};
