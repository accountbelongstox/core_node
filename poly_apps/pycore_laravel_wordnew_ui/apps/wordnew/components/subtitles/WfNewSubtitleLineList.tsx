import React from 'react';
import { ListMusic } from 'lucide-react';
import type { WfNewSubtitleSentence } from '../../api';
import type { ElementTheme } from '../../WfNewThemes';
import { formatClock } from '../../../../core/utils/formatters';

/** Native/translation text of a sentence (any non-primary language). */
export const pickSubtitleTranslation = (s: WfNewSubtitleSentence): string => {
  if (!s.languages) return '';
  const primary = s.language || '';
  for (const [lang, payload] of Object.entries(s.languages)) {
    if (lang !== primary && payload?.text) return payload.text;
  }
  return '';
};

interface WfNewSubtitleLineListProps {
  sentences: WfNewSubtitleSentence[];
  activeLineIndex: number;
  showTranslation: boolean;
  loading: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onJump: (index: number) => void;
}

export const WfNewSubtitleLineList: React.FC<WfNewSubtitleLineListProps> = ({
  sentences, activeLineIndex, showTranslation, loading, listRef, activeTheme, trans, onJump,
}) => (
  <div className={`p-4 rounded-3xl ${activeTheme.cardClass} border border-white/5 space-y-3 flex flex-col h-[300px]`}>
    <h4 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
      <ListMusic className="w-4 h-4 text-indigo-400" />
      {trans('subtitles.trackList')}
    </h4>
    <div ref={listRef} className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-2">
      {sentences.length === 0 && !loading && (
        <p className="text-[11px] text-zinc-500 font-mono py-6 text-center">{trans('subtitles.noLines')}</p>
      )}
      {sentences.map((line, idx) => {
        const isCurrent = idx === activeLineIndex;
        const tr = pickSubtitleTranslation(line);
        return (
          <div
            key={`${line.grain}-${line.seq}-${idx}`}
            id={`wfsub-line-${idx}`}
            onClick={() => onJump(idx)}
            className={`p-3 rounded-2xl text-left border cursor-pointer transition-all ${
              isCurrent ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 hover:border-white/10 hover:bg-white/5 bg-slate-950/10'
            }`}
          >
            <div className="flex justify-between items-center font-mono text-[9px] text-zinc-500 mb-1">
              <span>{trans('walkman.indexLabel')} {idx + 1}</span>
              {line.startSec != null && <span>{formatClock(line.startSec)}</span>}
            </div>
            <p className={`text-xs truncate ${isCurrent ? 'text-indigo-200 font-extrabold' : 'text-slate-300'}`}>{line.text || '—'}</p>
            {showTranslation && tr && (
              <p className="text-[10px] text-zinc-500 truncate mt-0.5">{tr}</p>
            )}
          </div>
        );
      })}
    </div>
  </div>
);
