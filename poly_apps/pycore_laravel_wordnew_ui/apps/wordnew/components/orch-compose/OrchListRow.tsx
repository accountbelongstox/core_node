import React from 'react';
import { Clock, Layers, type LucideIcon } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { formatClockTime } from '../../utils/WordNewTimeFormat';
import { OrchPanel } from './orchPanels';

type Trans = (key: string, replacements?: Record<string, string | number>) => string;

interface RowProps {
  theme: ElementTheme;
  icon: LucideIcon;
  title: string;
  /** Badges next to the title (source, status). */
  badges?: React.ReactNode;
  subtitle?: string;
  meta: React.ReactNode;
  onOpen: () => void;
  /** Action kept outside the opening button (play). */
  trailing?: React.ReactNode;
}

/** One row of an orchestration list: icon, title + badges, subtitle and a meta line; opens on click. */
export const OrchListRow: React.FC<RowProps> = ({ theme, icon: Icon, title, badges, subtitle, meta, onOpen, trailing }) => (
  <OrchPanel as="li" theme={theme} className="group flex items-center gap-2 transition-all hover:border-indigo-500/30">
    <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left">
      <span className="mt-0.5 shrink-0 rounded-xl bg-indigo-500/10 p-2.5 text-indigo-600 dark:text-indigo-300 group-hover:bg-indigo-500/20">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</span>
          {badges}
        </span>
        {subtitle && <span className="line-clamp-2 block text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</span>}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-zinc-500">{meta}</span>
      </span>
    </button>
    {trailing}
  </OrchPanel>
);

/** Icon + value in a meta line. */
export const OrchMetaItem: React.FC<{ icon: LucideIcon; children: React.ReactNode }> = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1">
    <Icon className="h-3 w-3" />{children}
  </span>
);

/** Segment count and (when known) the playing time of a composition. */
export const OrchSegmentMeta: React.FC<{ segmentCount: number; durationSec: number | null | undefined; trans: Trans }> = ({ segmentCount, durationSec, trans }) => (
  <>
    <OrchMetaItem icon={Layers}>{trans('orchAudio.segmentCount', { count: segmentCount })}</OrchMetaItem>
    {durationSec != null && durationSec > 0 && <OrchMetaItem icon={Clock}>{formatClockTime(durationSec)}</OrchMetaItem>}
  </>
);
