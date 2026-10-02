import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Sparkles, Star, Volume2 } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';

export interface SubtitleLookupWord {
  text: string;
  translation: string;
  phonetic: string;
}

interface WfNewSubtitleLookupCardProps {
  word: SubtitleLookupWord | null;
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onSpeak: (text: string) => void;
  onAddFavorite: () => void;
}

export const WfNewSubtitleLookupCard: React.FC<WfNewSubtitleLookupCardProps> = ({ word, activeTheme, trans, onSpeak, onAddFavorite }) => (
<div className={`p-4 rounded-3xl ${activeTheme.cardClass} border border-white/5 space-y-3`}>
  <div className="flex justify-between items-center border-b border-white/5 pb-2">
    <h3 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
      <Sparkles className="w-4 h-4 text-fuchsia-400" />
      {trans('subtitles.lookupTitle')}
    </h3>
  </div>
  <AnimatePresence mode="wait">
    {word ? (
      <motion.div
        key={word.text}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="space-y-3"
      >
        <div className="space-y-1 bg-white/5 p-3 rounded-2xl border border-white/5">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <h4 className="text-xl font-black text-indigo-300 tracking-tight truncate">{word.text}</h4>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">{word.phonetic}</p>
            </div>
            <button
              onClick={() => onSpeak(word.text)}
              className="p-2 bg-indigo-500/10 rounded-full hover:bg-indigo-500/20 text-indigo-400 cursor-pointer shrink-0"
              title={trans('subtitles.pronounceTitle')}
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-mono text-zinc-500 block">{trans('subtitles.translation')}</span>
          <p className="text-sm font-bold text-slate-100">{word.translation}</p>
        </div>
        <button
          onClick={onAddFavorite}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 cursor-pointer"
        >
          <Star className="w-3.5 h-3.5 fill-white" /> {trans('subtitles.addFav')}
        </button>
      </motion.div>
    ) : (
      <div className="text-center py-10 px-4 space-y-3">
        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mx-auto text-zinc-500">
          <Info className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-200">{trans('subtitles.awaiting')}</h4>
          <p className="text-[11px] text-zinc-500 max-w-[200px] mx-auto leading-normal">{trans('subtitles.awaitingSub')}</p>
        </div>
      </div>
    )}
  </AnimatePresence>
</div>
);
