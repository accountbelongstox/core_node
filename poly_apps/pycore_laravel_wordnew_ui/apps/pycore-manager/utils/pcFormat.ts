import type { TFunction } from 'i18next';
import { formatBytes } from '../../../core/utils/formatBytes';

const RELATIVE_JUST_NOW_SECONDS = 5;

/** Byte size label for task detail / history rows. */
export function humanBytes(n?: number | null, invalidLabel = '—'): string {
  return formatBytes(n, invalidLabel);
}

function relativeFromMs(ms: number, t: TFunction): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < RELATIVE_JUST_NOW_SECONDS) return t('common.relative.justNow');
  if (s < 60) return t('common.relative.secondsAgo', { count: s });
  const m = Math.round(s / 60);
  if (m < 60) return t('common.relative.minutesAgo', { count: m });
  const h = Math.round(m / 60);
  if (h < 24) return t('common.relative.hoursAgo', { count: h });
  return t('common.relative.daysAgo', { count: Math.round(h / 24) });
}

/** Compact relative time for recent-task table rows (`t` from the `pc` namespace). */
export function relativeTime(iso: string, t: TFunction): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return relativeFromMs(ms, t);
}

/** Compact "N ago" from a unix timestamp (seconds or ms). Empty/0 -> em dash. */
export function relativeAgo(unix: number | null | undefined, t: TFunction): string {
  if (!unix) return '—';
  return relativeFromMs(unix < 1e12 ? unix * 1000 : unix, t);
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
