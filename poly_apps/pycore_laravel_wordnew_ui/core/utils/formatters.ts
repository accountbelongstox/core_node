/** Shared display formatters (bytes, timestamps, numbers, clocks, durations). */

export { formatBytes } from './formatBytes';

const MS_PER_SECOND = 1000;
const UNIX_MS_THRESHOLD = 1e12;

/** Epoch milliseconds of a unix seconds/ms number or an ISO string; 0 when unparseable. */
export function toEpochMs(value?: number | string | null): number {
  if (typeof value === 'number') return value < UNIX_MS_THRESHOLD ? value * MS_PER_SECOND : value;
  if (typeof value === 'string' && value) {
    if (/^\d+$/.test(value)) return toEpochMs(Number(value));
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/** Absolute local time label from a unix timestamp (seconds/ms) or ISO string. */
export function formatTimestamp(value?: number | string | null, emptyLabel = '—'): string {
  if (value == null || value === '') return emptyLabel;
  if (typeof value === 'string' && !/^\d+$/.test(value) && Number.isNaN(Date.parse(value))) return value;
  const ms = toEpochMs(value);
  if (!ms) return emptyLabel;
  return new Date(ms).toLocaleString(undefined, { hour12: false });
}

/** Fixed-decimal grouped number (default 2 decimals). */
export function formatNumber(value: number, fractionDigits = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Compact large-number label (341723254 -> "341.72M"). */
export function formatBigNumber(n?: number | null, emptyLabel = '—'): string {
  if (n == null || !isFinite(n)) return emptyLabel;
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(2);
}

/** Megabyte label ("12.3 MB"). */
export function formatMegabytes(bytes?: number | null, emptyLabel = '-'): string {
  if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) return emptyLabel;
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/** Clock label from seconds ("05:03"; "1:02:03" past one hour). */
export function formatClock(seconds?: number | null, options?: { padMinutes?: boolean }): string {
  if (typeof seconds !== 'number' || !isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const minutes = options?.padMinutes === false ? String(m) : String(m).padStart(2, '0');
  return `${minutes}:${String(s).padStart(2, '0')}`;
}

/** Verbose duration label ("8s", "3m 05s", "1h 05m"). */
export function formatDurationHms(seconds?: number | null, emptyLabel = '-'): string {
  if (typeof seconds !== 'number' || !isFinite(seconds) || seconds < 0) return emptyLabel;
  const s = Math.round(seconds);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${String(rem).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}
