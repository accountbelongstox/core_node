import type { AppSettings } from '../types';

export type AccentColor = AppSettings['accentColor'];

export interface AccentStyle {
  primary: string;
  text: string;
  border: string;
  bg: string;
}

export const ACCENTS: Record<AccentColor, AccentStyle> = {
  indigo:  { primary: 'from-indigo-500 to-indigo-600',  text: 'text-indigo-400',  border: 'border-indigo-500/30',  bg: 'bg-indigo-500/10' },
  rose:    { primary: 'from-rose-500 to-rose-600',      text: 'text-rose-400',    border: 'border-rose-500/30',    bg: 'bg-rose-500/10' },
  emerald: { primary: 'from-emerald-500 to-emerald-600',text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  amber:   { primary: 'from-amber-500 to-amber-600',    text: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10' },
  cyan:    { primary: 'from-cyan-500 to-cyan-600',      text: 'text-cyan-400',    border: 'border-cyan-500/30',    bg: 'bg-cyan-500/10' },
  purple:  { primary: 'from-purple-500 to-purple-600',  text: 'text-purple-400',  border: 'border-purple-500/30',  bg: 'bg-purple-500/10' },
};

export const ACCENT_LIST: AccentColor[] = ['indigo', 'rose', 'emerald', 'amber', 'cyan', 'purple'];

/** Radial-gradient backdrop tint for the dynamic blur nodes. */
export function accentBackdrop(accent: AccentColor): string {
  const map: Record<AccentColor, string> = {
    indigo:  'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)',
    rose:    'radial-gradient(circle, rgba(244,63,94,0.2) 0%, transparent 70%)',
    emerald: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)',
    amber:   'radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)',
    cyan:    'radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 70%)',
    purple:  'radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%)',
  };
  return map[accent];
}
