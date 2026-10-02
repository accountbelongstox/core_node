import React from 'react';
import type { Word } from '../../api/WfNewApiTypes';
import { WfNewNoTranslation } from './WfNewNoTranslation';

interface WfNewStudyNowPlayingProps {
  word: Word;
  lang: string;
  largeFont: boolean;
  playing: boolean;
  playingLabel: string;
  caption?: React.ReactNode;
  wave?: React.ReactNode;
}

/** The now-playing word card of the recite loop (word, phonetic, translation; grows with large-font). */
export const WfNewStudyNowPlaying: React.FC<WfNewStudyNowPlayingProps> = ({ word, lang, largeFont, playing, playingLabel, caption, wave }) => (
  <div className="p-6 rounded-3xl bg-slate-900/40 border border-indigo-500/20 flex flex-col items-center text-center gap-2">
    {caption && <span className="text-[10px] font-mono text-zinc-500">{caption}</span>}
    <h3 className={`font-black tracking-tight ${largeFont ? 'text-5xl md:text-6xl' : 'text-3xl'}`}>{word.text}</h3>
    <p className="text-xs font-mono text-indigo-400">{word.phonetic}</p>
    {wave}
    {word.translation ? (
      <p className={`text-zinc-400 pt-1 ${largeFont ? 'text-xl' : 'text-sm'}`}>{word.translation}</p>
    ) : (
      <span className="pt-1">
        <WfNewNoTranslation lang={lang} />
      </span>
    )}
    {playing && <p className="text-[10px] text-emerald-400 font-mono animate-pulse pt-1">{playingLabel}</p>}
  </div>
);
