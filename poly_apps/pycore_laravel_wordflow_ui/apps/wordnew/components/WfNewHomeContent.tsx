/**
 * WfNewHomeContent — the home "content hub", presented as a MOBILE-FIRST
 * DASHBOARD: a responsive KPI strip (one stat tile per category, tap to scroll)
 * on top of five horizontally-scrolling content rails (word groups / books /
 * subtitles / libraries / documents) read live from the backend through one
 * normalized shape (WfNewContentGroup).
 *
 * It composes the new WfNewContentGroupCard (itself combined from the existing
 * CourseBlockCard + bento card — both kept as reference). Mobile polish: the KPI
 * grid is 2-col on phones → 3 → 5 on desktop; rails use scroll-snap with
 * edge-friendly card widths; loading shows skeletons; empty categories show an
 * honest empty state (no silent gaps).
 *
 * Pure presentation: all data + navigation come from props, so WfNewApp owns the
 * fetch (wfNewApi.getHomeContent) and the click routing.
 */
import React from 'react';
import { Layers, BookOpen, Clapperboard, Library, FileText } from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import type { WfNewContentGroup, WfNewContentKind, WfNewHomeContent as WfNewHomeContentData } from '../api';
import { WfNewContentGroupCard, WFNEW_KIND_STYLES } from './WfNewContentGroupCard';

interface WfNewHomeContentProps {
  content: WfNewHomeContentData;
  loading: boolean;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** Open a group (routing decided by WfNewApp per kind). */
  onOpen: (group: WfNewContentGroup) => void;
}

/** One section per category, in display order. `key` indexes the content object. */
const SECTIONS: Array<{
  kind: WfNewContentKind;
  key: keyof WfNewHomeContentData;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { kind: 'word', key: 'words', Icon: Layers },
  { kind: 'book', key: 'books', Icon: BookOpen },
  { kind: 'subtitle', key: 'subtitles', Icon: Clapperboard },
  { kind: 'library', key: 'libraries', Icon: Library },
  { kind: 'document', key: 'documents', Icon: FileText },
];

/** Stable DOM id for a section, so a KPI tile can scroll to it. */
const sectionId = (kind: WfNewContentKind) => `wfnew-sec-${kind}`;

export const WfNewHomeContent: React.FC<WfNewHomeContentProps> = ({
  content,
  loading,
  theme,
  trans,
  onOpen,
}) => {
  const scrollToSection = (kind: WfNewContentKind) => {
    if (typeof document === 'undefined') return;
    document.getElementById(sectionId(kind))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-5 pt-4">
      {/* Hub header */}
      <div className="px-1">
        <h3 className="text-sm font-black font-mono uppercase tracking-widest text-zinc-400">
          {trans('home.hubTitle')}
        </h3>
        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{trans('home.hubDesc')}</p>
      </div>

      {/* ── Dashboard KPI strip — responsive: 2-col (phone) → 3 → 5 (desktop) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {SECTIONS.map(({ kind, key, Icon }) => {
          const style = WFNEW_KIND_STYLES[kind];
          const count = content[key].length;
          return (
            <button
              key={kind}
              onClick={() => scrollToSection(kind)}
              className={`text-left p-3 sm:p-3.5 rounded-2xl transition-all active:scale-[0.98] hover:-translate-y-0.5 ${theme.cardClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`p-1.5 rounded-lg ${style.chip}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                {loading ? (
                  <span className="inline-block w-6 h-5 rounded bg-white/10 animate-pulse" />
                ) : (
                  <span className={`text-lg sm:text-xl font-black font-mono leading-none ${style.accent}`}>{count}</span>
                )}
              </div>
              <p className="mt-2 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 truncate">
                {trans(`content.section.${kind}`)}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Content rails, one per category ── */}
      {SECTIONS.map(({ kind, key, Icon }) => {
        const groups = content[key];
        const style = WFNEW_KIND_STYLES[kind];
        return (
          <section key={kind} id={sectionId(kind)} className="space-y-3 scroll-mt-4">
            {/* Section header: kind icon + label + live count */}
            <div className="flex items-center gap-2 px-1">
              <span className={`p-1.5 rounded-lg border ${style.chip}`}>
                <Icon className="w-3.5 h-3.5" />
              </span>
              <h4 className="text-xs font-black font-mono uppercase tracking-wider text-slate-200 dark:text-slate-300">
                {trans(`content.section.${kind}`)}
              </h4>
              {!loading && (
                <span className="text-[10px] font-mono text-zinc-500">({groups.length})</span>
              )}
            </div>

            {/* Body: loading skeletons → cards → empty state. Scroll-snap rail. */}
            {loading ? (
              <div className="flex gap-3 sm:gap-4 overflow-hidden px-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`w-56 sm:w-60 h-52 shrink-0 rounded-3xl animate-pulse ${theme.cardClass} opacity-50`} />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="mx-1 p-4 rounded-2xl border border-dashed border-white/10 bg-white/2 text-center">
                <p className="text-[11px] font-mono text-zinc-500">{trans('content.empty')}</p>
              </div>
            ) : (
              <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory px-1 pb-2 -mx-1">
                {groups.map((g) => (
                  <div key={`${g.kind}-${g.id}`} className="snap-start">
                    <WfNewContentGroupCard group={g} theme={theme} trans={trans} onClick={() => onOpen(g)} />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
