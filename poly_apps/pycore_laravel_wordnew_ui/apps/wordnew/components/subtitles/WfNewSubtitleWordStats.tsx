import React from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { ChipButton } from '@/shared/ui/ChipButton';
import type { WfNewDictWord } from '../../api';
import type { ElementTheme } from '../../WfNewThemes';

interface WfNewSubtitleWordStatsProps {
  words: WfNewDictWord[];
  total: number;
  start: number;
  pageSize: number;
  loading: boolean;
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onPage: (start: number) => void;
  onPlayWord: (word: WfNewDictWord) => void;
}

export const WfNewSubtitleWordStats: React.FC<WfNewSubtitleWordStatsProps> = ({
  words, total, start, pageSize, loading, activeTheme, trans, onPage, onPlayWord,
}) => {
  const hasPrev = start > 0;
  const hasNext = start + pageSize < total;
  return (
    <div className={`p-4 rounded-3xl ${activeTheme.cardClass} border border-white/5 space-y-3 flex flex-col h-[360px]`}>
      <div className="flex justify-between items-center border-b border-white/5 pb-2">
        <h4 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400">{trans('subtitles.wordStats')}</h4>
        <span className="text-[9px] font-mono text-zinc-500">{trans('subtitles.wordTotal', { n: total })}</span>
      </div>
      <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-2">
        {loading && <p className="text-[11px] text-zinc-500 font-mono py-4 text-center">{trans('common.loading')}</p>}
        {!loading && words.length === 0 && <p className="text-[11px] text-zinc-500 font-mono py-4 text-center">{trans('subtitles.noWords')}</p>}
        {!loading && words.map((w) => (
          <div key={w.md5} className="p-2.5 rounded-2xl border border-white/5 bg-slate-950/10 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate">{w.content}</p>
              {(w.phonetic || w.usPhonetic) && (
                <p className="text-[9px] text-zinc-500 font-mono truncate">{w.phonetic || w.usPhonetic}</p>
              )}
              {w.translation && <p className="text-[10px] text-zinc-400 truncate">{w.translation}</p>}
            </div>
            <button
              onClick={() => onPlayWord(w)}
              className="p-1.5 rounded-full bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 active:scale-95 cursor-pointer shrink-0"
              title={trans('common.play')}
            >
              <Play className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      {/* Pager */}
      <div className="flex items-center justify-between border-t border-white/5 pt-2">
        <ChipButton onClick={() => onPage(Math.max(0, start - pageSize))} disabled={!hasPrev}>
          <ChevronLeft className="w-3.5 h-3.5" /> {trans('subtitles.prev')}
        </ChipButton>
        <span className="text-[9px] font-mono text-zinc-500">
          {trans('subtitles.range', { a: total === 0 ? 0 : start + 1, b: Math.min(start + pageSize, total) })}
        </span>
        <ChipButton onClick={() => onPage(start + pageSize)} disabled={!hasNext}>
          {trans('subtitles.next')} <ChevronRight className="w-3.5 h-3.5" />
        </ChipButton>
      </div>
    </div>
  );
};
