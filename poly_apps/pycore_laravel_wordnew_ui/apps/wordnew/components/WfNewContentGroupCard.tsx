/**
 * WfNewContentGroupCard — a single home "content group" card, used by the
 * multi-category home hub (words / books / subtitles / documents).
 *
 * This is a NEW widget COMBINED from two existing, kept-as-reference components:
 *   - components/WfNewCards.tsx → CourseBlockCard  (the rounded card frame,
 *     icon chip, count line and the bottom meta row), and
 *   - WfNewApp.tsx → the "Bento" grid card           (the cover-image backdrop,
 *     the badge pills and the gradient fallback).
 * Those originals are intentionally left UNCHANGED so this card can evolve for
 * the multi-source home without touching the shelf/bento UIs. See ./README in
 * apps/wordnew and api/README.md for the "copy-into-a-widget, keep the source as
 * reference" convention.
 *
 * It renders the normalized WfNewContentGroup shape, so the SAME card draws a
 * word group, a book, a subtitle source or a document/library — only the accent
 * colour + icon differ per `kind`.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Clapperboard, FileText, Layers, Library, Globe, Plus } from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import type { WfNewContentGroup, WfNewContentKind } from '../api';
import { WfNewRotatingCover } from './WfNewRotatingCover';

/** Per-kind visual identity: icon + accent classes + gradient fallback. */
interface KindStyle {
  Icon: React.ComponentType<{ className?: string }>;
  /** Text/icon accent (e.g. 'text-indigo-400'). */
  accent: string;
  /** Chip background (e.g. 'bg-indigo-500/10 border-indigo-500/20'). */
  chip: string;
  /** Cover gradient drawn when the group has no image. */
  gradient: string;
}

export const WFNEW_KIND_STYLES: Record<WfNewContentKind, KindStyle> = {
  word: { Icon: Layers, accent: 'text-indigo-400', chip: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400', gradient: 'from-indigo-500/30 via-violet-500/15 to-slate-900/0' },
  book: { Icon: BookOpen, accent: 'text-amber-400', chip: 'bg-amber-500/10 border-amber-500/20 text-amber-400', gradient: 'from-amber-500/30 via-orange-500/15 to-slate-900/0' },
  subtitle: { Icon: Clapperboard, accent: 'text-rose-400', chip: 'bg-rose-500/10 border-rose-500/20 text-rose-400', gradient: 'from-rose-500/30 via-pink-500/15 to-slate-900/0' },
  library: { Icon: Library, accent: 'text-cyan-400', chip: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400', gradient: 'from-cyan-500/30 via-sky-500/15 to-slate-900/0' },
  document: { Icon: FileText, accent: 'text-emerald-400', chip: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', gradient: 'from-emerald-500/30 via-teal-500/15 to-slate-900/0' },
};

interface WfNewContentGroupCardProps {
  group: WfNewContentGroup;
  theme: ElementTheme;
  onClick: () => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** Grid mode: fill the cell width instead of the fixed rail width (w-56/60). */
  fullWidth?: boolean;
  /** When provided, renders a compact "add all words to Default Vocabulary Group"
   *  button pinned to the cover image's bottom-right corner (library cards). */
  onAddToStudy?: () => void;
}

export const WfNewContentGroupCard: React.FC<WfNewContentGroupCardProps> = ({
  group,
  theme,
  onClick,
  trans,
  fullWidth = false,
  onAddToStudy,
}) => {
  const style = WFNEW_KIND_STYLES[group.kind];
  const { Icon } = style;
  // Translate the count unit ('words' | 'sentences' | 'subtitles'); fall back to
  // the raw unit string if a locale key is missing.
  const unitLabel = trans(`content.unit.${group.countUnit}`);

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`${fullWidth ? 'w-full' : 'w-56 sm:w-60 shrink-0'} rounded-3xl cursor-pointer group overflow-hidden transition-all duration-300 ${theme.cardClass}`}
    >
      {/* Cover: real poster when present, else a kind-coloured gradient + icon. */}
      <div className="relative h-28 w-full overflow-hidden">
        <WfNewRotatingCover
          imageUrl={group.imageUrl}
          imageUrls={group.imageUrls}
          alt={group.title}
          showBadge={!onAddToStudy}
        />
        <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient}`} />
        {/* Kind chip (top-left) + count badge (top-right). */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <span className={`flex items-center gap-1 text-[9px] font-black font-mono uppercase tracking-wider px-2 py-1 rounded-full border ${style.chip}`}>
            <Icon className="w-3 h-3" />
            {trans(`content.kind.${group.kind}`)}
          </span>
          <span className="text-[9px] font-mono font-bold text-white/90 bg-black/35 backdrop-blur px-2 py-1 rounded-full">
            {group.count} {unitLabel}
          </span>
        </div>
        {/* Quick add: copy ALL of this library's words into the user's Default
            Vocabulary Group, pinned to the cover's bottom-right (library cards). */}
        {onAddToStudy && (
          <button
            type="button"
            title={trans('library.addToStudy')}
            aria-label={trans('library.addToStudy')}
            onClick={(e) => { e.stopPropagation(); onAddToStudy(); }}
            className="absolute bottom-2 right-2 flex items-center justify-center w-8 h-8 rounded-full bg-cyan-600/90 hover:bg-cyan-500 text-white shadow-lg shadow-black/30 ring-1 ring-white/20 backdrop-blur transition"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
          </button>
        )}
      </div>

      {/* Body: title + language/category meta. */}
      <div className="p-4 space-y-2">
        <h4 className={`font-extrabold text-sm leading-snug text-slate-100 dark:text-inherit truncate transition-colors group-hover:${style.accent}`}>
          {group.title}
        </h4>
        <div className="flex items-center gap-1.5 flex-wrap">
          {group.language && (
            <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider bg-white/5 border border-white/5 text-zinc-400 px-1.5 py-0.5 rounded">
              <Globe className="w-2.5 h-2.5" /> {group.language}
            </span>
          )}
          {group.category && (
            <span className="text-[9px] font-mono uppercase tracking-wider bg-white/5 border border-white/5 text-zinc-400 px-1.5 py-0.5 rounded truncate max-w-[7rem]">
              {group.category}
            </span>
          )}
        </div>
        {group.description && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-snug">{group.description}</p>
        )}
      </div>
    </motion.div>
  );
};
