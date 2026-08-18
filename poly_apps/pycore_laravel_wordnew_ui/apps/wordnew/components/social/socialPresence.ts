/** socialPresence - shared social helpers (relative time, presence dot,
 * message-list row data) extracted from WfNewSocial so the page + its sub-view
 * components each stay under the 800-line modular limit. */
import type { WfNewPresenceStatus, WfNewMessage } from '../../api';

const RTF = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
  ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  : null;

export function relativeTime(value?: string | null): string {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return String(value);
  const diffMs = then - Date.now();
  const abs = Math.abs(diffMs);
  if (!RTF) return new Date(then).toLocaleString();
  const min = 60_000, hr = 3_600_000, day = 86_400_000;
  if (abs < min) return RTF.format(Math.round(diffMs / 1000), 'second');
  if (abs < hr) return RTF.format(Math.round(diffMs / min), 'minute');
  if (abs < day) return RTF.format(Math.round(diffMs / hr), 'hour');
  if (abs < day * 30) return RTF.format(Math.round(diffMs / day), 'day');
  return new Date(then).toLocaleDateString();
}

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
