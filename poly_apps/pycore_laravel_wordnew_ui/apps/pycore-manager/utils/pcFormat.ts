import { formatBytes } from '../../../core/utils/formatBytes';

/** Byte size label for task detail / history rows. */
export function humanBytes(n?: number | null, invalidLabel = '—'): string {
  return formatBytes(n, invalidLabel);
}

/** Compact relative time for recent-task table rows. */
export function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

/** Compact "N ago" from a unix timestamp (seconds or ms). Empty/0 -> em dash. */
export function relativeAgo(unix?: number | null): string {
  if (!unix) return '—';
  const ms = unix < 1e12 ? unix * 1000 : unix;
  const diff = Date.now() - ms;
  if (diff < 5000) return 'just now';
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Absolute local time label from a unix timestamp (seconds or ms). */
export function absoluteTime(unix?: number | null): string {
  if (!unix) return '—';
  const ms = unix < 1e12 ? unix * 1000 : unix;
  return new Date(ms).toLocaleString(undefined, { hour12: false });
}
