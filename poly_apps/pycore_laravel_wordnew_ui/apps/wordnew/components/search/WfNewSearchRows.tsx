import React from 'react';
import { ArrowUpRight, Star, Volume2 } from 'lucide-react';
import { splitSearchMatch, type WordNewSearchHit } from '../../services/WordNewGlobalSearch';

type Trans = (key: string, replacements?: Record<string, string | number>) => string;

export const WfNewSearchHighlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const [before, match, after] = splitSearchMatch(text, query);
  if (!match) return <>{text}</>;
  return <>{before}<mark className="bg-indigo-500/20 text-inherit rounded px-0.5">{match}</mark>{after}</>;
};

interface WfNewSearchRowProps {
  hit: WordNewSearchHit;
  query: string;
  active: boolean;
  favorite: boolean;
  trans: Trans;
  onOpen: () => void;
  onHover: () => void;
  onPlay: () => void;
  onToggleFavorite: () => void;
}

const ROW = 'w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors cursor-pointer';
const ICON_BOX = 'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center';
const ACTION = 'shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-slate-900/10 dark:hover:bg-white/10 cursor-pointer';

export const WfNewSearchRow: React.FC<WfNewSearchRowProps> = ({
  hit, query, active, favorite, trans, onOpen, onHover, onPlay, onToggleFavorite,
}) => {
  const tone = active ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'hover:bg-slate-900/5 dark:hover:bg-white/5';

  if (hit.kind === 'word') {
    const { word } = hit;
    return (
      <div
        role="option"
        aria-selected={active}
        data-search-key={hit.key}
        onMouseEnter={onHover}
        onClick={onOpen}
        className={`${ROW} ${tone}`}
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2 min-w-0">
            <span className="truncate font-extrabold text-sm text-indigo-600 dark:text-indigo-300">
              <WfNewSearchHighlight text={word.text} query={query} />
            </span>
            {word.phonetic && <span className="shrink-0 max-w-[40%] truncate text-[11px] font-mono text-zinc-500">{word.phonetic}</span>}
          </p>
          <p className="truncate text-xs text-slate-600 dark:text-zinc-400">
            <WfNewSearchHighlight text={word.translation || word.definition || ''} query={query} />
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className={`${ACTION} text-slate-500 dark:text-zinc-300`}
          title={trans('tip.speak')}
          aria-label={trans('tip.speak')}
        >
          <Volume2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className={ACTION}
          title={trans('search.saveBookmark')}
          aria-label={trans('search.saveBookmark')}
          aria-pressed={favorite}
        >
          <Star className={`w-4 h-4 ${favorite ? 'fill-amber-400 text-amber-400' : 'text-zinc-400'}`} />
        </button>
      </div>
    );
  }

  const Icon = hit.icon;
  const title = hit.kind === 'page' ? hit.title : hit.group.title;
  const subtitle = hit.kind === 'page'
    ? hit.subtitle
    : [trans(`content.section.${hit.group.kind}`), hit.group.count ? `${hit.group.count}` : '', hit.group.language?.toUpperCase()].filter(Boolean).join(' · ');
  const iconTone = hit.kind === 'page'
    ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-300'
    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      data-search-key={hit.key}
      onMouseEnter={onHover}
      onClick={onOpen}
      className={`${ROW} ${tone}`}
    >
      <span className={`${ICON_BOX} ${iconTone}`}><Icon className="w-4 h-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-slate-900 dark:text-slate-100">
          <WfNewSearchHighlight text={title} query={query} />
        </span>
        {subtitle && <span className="block truncate text-[11px] text-slate-500 dark:text-zinc-500">{subtitle}</span>}
      </span>
      <ArrowUpRight className={`w-4 h-4 shrink-0 ${active ? 'text-indigo-500' : 'text-zinc-400'}`} />
    </button>
  );
};
