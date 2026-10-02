import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';

export type WfNewHomeLabAccent = 'indigo' | 'fuchsia' | 'amber' | 'emerald' | 'cyan' | 'rose' | 'blue';

interface AccentClasses {
  /** Gradient icon tile with its coloured glow. */
  tile: string;
  /** Card tint, border and hover border. */
  card: string;
  glow: string;
  title: string;
}

const ACCENT_CLASSES: Record<WfNewHomeLabAccent, AccentClasses> = {
  indigo: { tile: 'from-indigo-400 to-violet-600 shadow-indigo-500/40', card: 'from-indigo-500/12 border-indigo-500/15 hover:border-indigo-400/45', glow: 'bg-indigo-500/25', title: 'group-hover:text-indigo-500 dark:group-hover:text-indigo-300' },
  fuchsia: { tile: 'from-fuchsia-400 to-purple-600 shadow-fuchsia-500/40', card: 'from-fuchsia-500/12 border-fuchsia-500/15 hover:border-fuchsia-400/45', glow: 'bg-fuchsia-500/25', title: 'group-hover:text-fuchsia-500 dark:group-hover:text-fuchsia-300' },
  amber: { tile: 'from-amber-300 to-orange-500 shadow-amber-500/40', card: 'from-amber-500/12 border-amber-500/15 hover:border-amber-400/45', glow: 'bg-amber-500/25', title: 'group-hover:text-amber-500 dark:group-hover:text-amber-300' },
  emerald: { tile: 'from-emerald-300 to-teal-600 shadow-emerald-500/40', card: 'from-emerald-500/12 border-emerald-500/15 hover:border-emerald-400/45', glow: 'bg-emerald-500/25', title: 'group-hover:text-emerald-500 dark:group-hover:text-emerald-300' },
  cyan: { tile: 'from-cyan-300 to-sky-600 shadow-cyan-500/40', card: 'from-cyan-500/12 border-cyan-500/15 hover:border-cyan-400/45', glow: 'bg-cyan-500/25', title: 'group-hover:text-cyan-500 dark:group-hover:text-cyan-300' },
  rose: { tile: 'from-rose-400 to-pink-600 shadow-rose-500/40', card: 'from-rose-500/12 border-rose-500/15 hover:border-rose-400/45', glow: 'bg-rose-500/25', title: 'group-hover:text-rose-500 dark:group-hover:text-rose-300' },
  blue: { tile: 'from-sky-400 to-blue-600 shadow-blue-500/40', card: 'from-blue-500/12 border-blue-500/15 hover:border-blue-400/45', glow: 'bg-blue-500/25', title: 'group-hover:text-blue-500 dark:group-hover:text-blue-300' },
};

interface WfNewHomeLabCardProps {
  theme: ElementTheme;
  accent: WfNewHomeLabAccent;
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description: string;
  onOpen: () => void;
  /** `tile`: icon on top, label below (labs); `row`: icon beside the label (practice modes). */
  layout?: 'tile' | 'row';
}

/** Home entry card: an accent-tinted glass card with a glossy gradient icon tile.
 * Mobile shows the label only; sm+ adds the description. */
export const WfNewHomeLabCard: React.FC<WfNewHomeLabCardProps> = ({
  theme, accent, icon: Icon, iconClassName, title, description, onOpen, layout = 'tile',
}) => {
  const classes = ACCENT_CLASSES[accent];
  const row = layout === 'row';
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } }}
      className={`group relative min-w-0 overflow-hidden rounded-[1.6rem] border bg-gradient-to-br to-transparent ${classes.card} ${theme.cardClass} cursor-pointer select-none transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97] ${
        row ? 'flex items-center gap-3 p-3 sm:items-start sm:p-4' : 'flex flex-col items-center p-3 pt-4 text-center sm:items-start sm:p-5 sm:text-left'
      }`}
    >
      <span aria-hidden className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-60 transition-opacity duration-300 group-hover:opacity-100 ${classes.glow}`} />
      <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105 ${classes.tile} ${
        row ? 'h-10 w-10' : 'mb-2.5 h-12 w-12 sm:mb-4'
      }`}>
        <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />
        <Icon className={`relative ${row ? 'h-5 w-5' : 'h-6 w-6'} drop-shadow-sm ${iconClassName ?? ''}`} />
      </span>
      <span className={`relative min-w-0 ${row ? 'flex-1' : 'w-full'}`}>
        <span className={`block font-extrabold leading-tight text-slate-800 dark:text-slate-100 transition-colors ${classes.title} ${
          row ? 'truncate text-xs sm:text-sm' : 'line-clamp-2 break-words text-[11px] sm:text-sm'
        }`}>
          {title}
        </span>
        <span className="mt-1.5 hidden text-xs font-mono leading-relaxed text-zinc-500 sm:block">
          {description}
        </span>
      </span>
    </div>
  );
};
