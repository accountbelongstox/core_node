import React from 'react';
import { Film, Play } from 'lucide-react';
import type { WfNewContentGroup } from '../../api';
import type { ElementTheme } from '../../WfNewThemes';

interface WfNewSubtitleSourcesProps {
  groups: WfNewContentGroup[];
  activeSource: string;
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onSelect: (sourceKey: string) => void;
  onPlay: (sourceKey: string) => void;
}

export const WfNewSubtitleSources: React.FC<WfNewSubtitleSourcesProps> = ({ groups, activeSource, activeTheme, trans, onSelect, onPlay }) => (
  <aside className="lg:col-span-3 space-y-3">
    <div className={`p-4 rounded-3xl ${activeTheme.cardClass} border border-white/5 flex flex-col h-[360px] lg:h-[640px]`}>
      <h3 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-1.5 border-b border-white/5 pb-2 mb-2">
        <Film className="w-4 h-4 text-indigo-400" />
        {trans('subtitles.allSources')}
      </h3>
      <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-2">
        {groups.length === 0 && (
          <p className="text-[11px] text-zinc-500 font-mono py-6 text-center">{trans('subtitles.noSources')}</p>
        )}
        {groups.map((g) => {
          const isActive = g.sourceKey === activeSource;
          return (
            <div
              key={g.id}
              className={`p-3 rounded-2xl border transition-all ${
                isActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 hover:border-white/10 hover:bg-white/5 bg-slate-950/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => g.sourceKey && onSelect(g.sourceKey)}
                  className="text-left flex-1 min-w-0 cursor-pointer"
                >
                  <p className={`text-xs font-bold truncate ${isActive ? 'text-indigo-200' : 'text-slate-200'}`}>{g.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] font-mono text-zinc-500">{trans('subtitles.lineCount', { n: g.count })}</span>
                    {g.language && (
                      <span className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/10 text-zinc-400">
                        {g.language}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => g.sourceKey && onPlay(g.sourceKey)}
                  className="p-1.5 rounded-full bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 active:scale-95 cursor-pointer shrink-0"
                  title={trans('common.play')}
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </aside>
);
