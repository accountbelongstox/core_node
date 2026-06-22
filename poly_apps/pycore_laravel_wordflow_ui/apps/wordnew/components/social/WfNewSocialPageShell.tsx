import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { ElementTheme } from '../../WfNewTypes';

/**
 * WfNewSocialPageShell — the common chrome for every Social Center page: a card
 * surface with a header row (back button + icon + title/subtitle + optional
 * right-side action). Each social sub-page wraps its body in this so back nav,
 * spacing and theming stay consistent (mirrors the app's card pattern).
 */
interface WfNewSocialPageShellProps {
  activeTheme: ElementTheme;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Back handler (pops the social back-stack → previous page / hub). */
  onBack: () => void;
  /** Optional right-aligned header action (e.g. a filter pill or compose button). */
  action?: React.ReactNode;
  /** When true the body area gets no top padding (full-bleed feeds). */
  flush?: boolean;
  children: React.ReactNode;
}

export const WfNewSocialPageShell: React.FC<WfNewSocialPageShellProps> = ({
  activeTheme, title, subtitle, icon, onBack, action, flush, children,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    className={`p-4 md:p-6 rounded-3xl ${activeTheme.cardClass} shadow-xl max-w-5xl mx-auto border border-white/5`}
  >
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 hover:text-zinc-100 transition-all cursor-pointer shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {icon && <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-base font-black text-slate-100 truncate">{title}</h3>
          {subtitle && <p className="text-zinc-500 text-[11px] font-mono truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>

    <div className={flush ? 'mt-4' : 'mt-6'}>{children}</div>
  </motion.div>
);
