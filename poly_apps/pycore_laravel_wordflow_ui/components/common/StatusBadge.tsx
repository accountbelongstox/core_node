import React from 'react';

export type StatusTone = 'success' | 'running' | 'warning' | 'error' | 'idle' | 'info';

const TONE: Record<StatusTone, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  running: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  error:   'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  idle:    'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
  info:    'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
};

const DOT: Record<StatusTone, string> = {
  success: 'bg-emerald-500', running: 'bg-sky-500', warning: 'bg-amber-500',
  error: 'bg-red-500', idle: 'bg-slate-400', info: 'bg-indigo-500',
};

/**
 * statusTone — maps a free-form status string to a semantic tone, replacing the
 * per-file getStatusColor/statusColorClass switch functions duplicated ~60 times.
 * Pass an explicit `tone` to override.
 */
export const statusTone = (status: string): StatusTone => {
  const s = (status || '').toLowerCase();
  if (/(run|active|online|success|done|ready|valid|complete|healthy|connected|enabled|pass)/.test(s)) return 'success';
  if (/(pending|processing|assigned|loading|queue|starting|progress|leased)/.test(s)) return 'running';
  if (/(warn|expir|degrad|partial|stale)/.test(s)) return 'warning';
  if (/(error|fail|stopped|offline|invalid|expired|denied|disconnect|disabled|dead|reject)/.test(s)) return 'error';
  return 'idle';
};

/** Colored status pill (dark-mode aware), with an optional leading dot. */
export const StatusBadge: React.FC<{
  status: string;
  tone?: StatusTone;
  withDot?: boolean;
  className?: string;
  children?: React.ReactNode;
}> = ({ status, tone, withDot = true, className = '', children }) => {
  const t = tone || statusTone(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${TONE[t]} ${className}`}>
      {withDot ? <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" /> : null}
      {children ?? status}
    </span>
  );
};

/** Bare colored status dot (the ~17 inline `w-2 h-2 rounded-full bg-*` copies). */
export const StatusDot: React.FC<{ status: string; tone?: StatusTone; className?: string }> = ({ status, tone, className = '' }) => (
  <span className={`inline-block w-2 h-2 rounded-full ${DOT[tone || statusTone(status)]} ${className}`} />
);

export default StatusBadge;
