import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';

export type WfNewHomeLabAccent = 'indigo' | 'fuchsia' | 'amber' | 'emerald' | 'cyan';

const ACCENT_CLASSES: Record<WfNewHomeLabAccent, { card: string; icon: string; title: string }> = {
  indigo: { card: 'hover:border-indigo-500/25', icon: 'bg-indigo-500/10 text-indigo-400', title: 'group-hover:text-indigo-400' },
  fuchsia: { card: 'hover:border-fuchsia-500/25', icon: 'bg-fuchsia-500/10 text-fuchsia-400', title: 'group-hover:text-fuchsia-400' },
  amber: { card: 'hover:border-amber-500/25', icon: 'bg-amber-500/10 text-amber-400', title: 'group-hover:text-amber-400' },
  emerald: { card: 'hover:border-emerald-500/25', icon: 'bg-emerald-500/10 text-emerald-400', title: 'group-hover:text-emerald-400' },
  cyan: { card: 'hover:border-cyan-500/25', icon: 'bg-cyan-500/10 text-cyan-400', title: 'group-hover:text-cyan-400' },
};

interface WfNewHomeLabCardProps {
  theme: ElementTheme;
  accent: WfNewHomeLabAccent;
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description: string;
  onOpen: () => void;
}

/** Home "labs" entry card. Mobile: compact icon-on-top / label-below tile;
 * sm+: the richer card with description. */
export const WfNewHomeLabCard: React.FC<WfNewHomeLabCardProps> = ({
  theme, accent, icon: Icon, iconClassName, title, description, onOpen,
}) => {
  const classes = ACCENT_CLASSES[accent];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } }}
      className={`p-6 rounded-3xl ${theme.cardClass} ${classes.card} border border-white/5 cursor-pointer hover:scale-[1.01] transition-all duration-300 group flex flex-col items-center text-center sm:items-start sm:text-left`}
    >
      <div className={`p-3 ${classes.icon} rounded-xl sm:rounded-2xl w-fit mb-2.5 sm:mb-4`}>
        <Icon className={`w-5.5 h-5.5 ${iconClassName ?? ''}`} />
      </div>
      <h4 className={`font-extrabold text-[11px] leading-tight sm:text-sm text-slate-100 ${classes.title} transition-colors`}>
        {title}
      </h4>
      <p className="hidden sm:block text-xs text-zinc-500 mt-2 font-mono leading-relaxed">
        {description}
      </p>
    </div>
  );
};
