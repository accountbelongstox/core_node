export type StatusTone = 'emerald' | 'indigo' | 'sky' | 'violet' | 'amber' | 'rose' | 'neutral';

/** Text colour of each tone (light / dark). */
export const TONE_TEXT: Record<StatusTone, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-300',
  indigo: 'text-indigo-600 dark:text-indigo-300',
  sky: 'text-sky-600 dark:text-sky-300',
  violet: 'text-violet-600 dark:text-violet-300',
  amber: 'text-amber-600 dark:text-amber-300',
  rose: 'text-rose-600 dark:text-rose-300',
  neutral: 'text-zinc-500 dark:text-zinc-400',
};

/** Solid bar colour of each tone. */
export const TONE_BAR: Record<StatusTone, string> = {
  emerald: 'bg-emerald-400',
  indigo: 'bg-indigo-400',
  sky: 'bg-sky-400',
  violet: 'bg-violet-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  neutral: 'bg-slate-300 dark:bg-white/20',
};

/** Tinted pill background of each tone. */
export const TONE_TINT: Record<StatusTone, string> = {
  emerald: 'bg-emerald-500/10',
  indigo: 'bg-indigo-500/10',
  sky: 'bg-sky-500/10',
  violet: 'bg-violet-500/10',
  amber: 'bg-amber-500/10',
  rose: 'bg-rose-500/10',
  neutral: 'bg-zinc-400/10',
};
