import type { StatusTone } from '@/shared/ui/statusTone';
import type { WordNewApiEntryState, WordNewApiServiceState } from '../../api/center/WordNewApiCenter';

export const API_SERVICE_TONE: Record<WordNewApiServiceState, StatusTone> = {
  checking: 'amber',
  online: 'emerald',
  reconnecting: 'amber',
  offline: 'rose',
};

export const API_ENTRY_TONE: Record<WordNewApiEntryState, StatusTone> = {
  unknown: 'neutral',
  checking: 'amber',
  online: 'emerald',
  offline: 'rose',
  refused: 'amber',
  relay: 'sky',
};

export const API_PENDING_STATES: ReadonlySet<WordNewApiServiceState> = new Set<WordNewApiServiceState>(['checking', 'reconnecting']);
