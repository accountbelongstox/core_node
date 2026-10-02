/**
 * A collapsible panel section of the orchestration UI. Closed: an icon chip
 * (the title is its accessible name and tooltip) with an optional short
 * summary; open: icon + title header and the content.
 */
import React, { useId } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { OrchIconChip } from './orchPanels';

interface Props {
  icon: LucideIcon;
  title: string;
  /** One-line state shown next to the closed chip (e.g. the chosen group). */
  summary?: string;
  open: boolean;
  onToggle: () => void;
  theme: ElementTheme;
  children: React.ReactNode;
}

export const WfNewOrchSection: React.FC<Props> = ({ icon: Icon, title, summary, open, onToggle, theme, children }) => {
  const contentId = useId();
  return (
    <section className={`rounded-xl border ${theme.borderClass} ${open ? 'p-3' : 'p-1.5'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={title}
        title={title}
        className="flex w-full min-w-0 items-center gap-2 text-left"
      >
        <OrchIconChip icon={Icon} theme={theme} />
        {open
          ? <span className={`flex-1 text-xs font-bold ${theme.textPrimaryClass}`}>{title}</span>
          : <span className={`min-w-0 flex-1 truncate text-[11px] ${theme.textSecondaryClass}`}>{summary}</span>}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${theme.textSecondaryClass} ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && <div id={contentId} className="mt-3 space-y-3">{children}</div>}
    </section>
  );
};
