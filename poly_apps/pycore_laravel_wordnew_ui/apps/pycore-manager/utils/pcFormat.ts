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

/** Compact elapsed duration label ("8.2s", "3m 5s", "1h 2m"). */
export function formatElapsed(seconds?: number | null): string {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return `${value.toFixed(value < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(value / 60);
  if (minutes < 60) return `${minutes}m ${Math.floor(value % 60)}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Seconds between two unix timestamps (seconds); an open end counts to now. */
export function spanSeconds(start?: number | null, end?: number | null): number | null {
  if (!start) return null;
  return Math.max(0, (end || Date.now() / 1000) - start);
}
