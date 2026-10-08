/** Task Center — orchestration monitor: time helpers and tiny presentational pieces shared by its sections. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkNode } from '../../../../../core/contracts/QueueCenterTypes';

/** Mirrors `audio_orchestration_contract.client_monitor.ttl_seconds`; only a fallback when the server omits `online`. */
export const ORCH_CLIENT_TTL_SECONDS = 90;
export const ORCH_LOAD_STALE_SECONDS = 90;

let serverClockOffsetMs = 0;

/** Server timestamps (last seen, layout applied, heartbeat) are compared with the server's clock, not this browser's. */
export const syncServerClock = (serverTime: string | null | undefined): void => {
  const ms = serverTime ? Date.parse(serverTime) : NaN;
  if (Number.isFinite(ms)) serverClockOffsetMs = ms - Date.now();
};

export const nowMs = (): number => Date.now() + serverClockOffsetMs;

export const nf = (value: number | null | undefined): string => (typeof value === 'number' ? value.toLocaleString() : '—');

/** ISO string, epoch seconds or epoch milliseconds → epoch milliseconds (NaN when unusable). */
export const toMs = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  if (!value) return NaN;
  return Date.parse(value);
};

/** Seconds between `now` and a timestamp; Infinity when the timestamp is missing. */
export const ageSeconds = (value: string | number | null | undefined, now: number): number => {
  const ms = toMs(value);
  return Number.isFinite(ms) ? Math.max(0, Math.floor((now - ms) / 1000)) : Number.POSITIVE_INFINITY;
};

export const formatAge = (seconds: number, never: string): string => {
  if (!Number.isFinite(seconds)) return never;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

/** Node platform key: colab_gpu | colab_cpu | kaggle | local. */
export const nodePlatformKey = (node: WorkNode): string => {
  const platform = (node.platform ?? '').toLowerCase();
  const gpu = node.compute_class === 'gpu';
  if (platform === 'colab') return gpu ? 'colab_gpu' : 'colab_cpu';
  if (platform === 'kaggle') return 'kaggle';
  return 'local';
};

export const Dot: React.FC<{ on: boolean; title?: string }> = ({ on, title }) => (
  <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${on ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'}`} title={title} />
);

export const Chip: React.FC<{ on?: boolean; tone?: 'ok' | 'warn' | 'info' | 'off'; children: React.ReactNode; title?: string }> = ({ on, tone, children, title }) => {
  const resolved = tone ?? (on ? 'ok' : 'off');
  const cls = {
    ok: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    warn: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    info: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
    off: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
  }[resolved];
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] ${cls}`} title={title}>{children}</span>;
};

/** Percent meter: green below 70, amber below 90, red above; renders — when the value is missing. */
export const Meter: React.FC<{ value: number | null | undefined; label?: string }> = ({ value, label }) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return <span className="text-slate-400">—</span>;
  }
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-1.5 min-w-[84px]" title={label}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right font-mono text-[11px] text-slate-600 dark:text-slate-300">{Math.round(pct)}%</span>
    </div>
  );
};

export const Th: React.FC<{ children?: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th className={`px-2 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 ${right ? 'text-right' : 'text-left'}`}>{children}</th>
);

export const SectionTitle: React.FC<{ title: string; hint?: string; count?: number }> = ({ title, hint, count }) => (
  <div>
    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
      {title}
      {typeof count === 'number' && <span className="ml-2 text-xs font-normal text-slate-500">({count})</span>}
    </h3>
    {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
  </div>
);

/** Localized age text for a timestamp. */
export const useAgeText = (): ((value: string | number | null | undefined, now: number) => string) => {
  const { t: tr } = useTranslation();
  return (value, now) => formatAge(ageSeconds(value, now), tr('uiTask.shared.never'));
};
