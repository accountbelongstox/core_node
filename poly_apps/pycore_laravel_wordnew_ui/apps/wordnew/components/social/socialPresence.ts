import type { WfNewPresenceStatus, WfNewMessage } from '../../api';

export const PRESENCE_DOT: Record<WfNewPresenceStatus, string> = {
  online: 'bg-emerald-500',
  studying: 'bg-indigo-500',
  away: 'bg-amber-500',
  offline: 'bg-zinc-500',
};

export function presenceClass(status?: WfNewPresenceStatus): string {
  return PRESENCE_DOT[status || 'offline'] || PRESENCE_DOT.offline;
}

export interface MessageRowData {
  messages: WfNewMessage[];
  peerId: number;
}
