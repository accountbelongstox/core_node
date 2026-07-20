/**
 * WfNewFlashcard — a single reveal/flip study card (Cards mode) for the shelf
 * deep-dive. Ports the legacy client's "have-read" word box + project-mode
 * oversized typography: front = word + phonetic + speaker; tap to flip to the
 * gloss/definition/example; Known / Forgot mark buttons drive spaced review.
 *
 * Flip state is internal and resets per word because the panel remounts this
 * with `key={word.id}`. Pure presentation — the panel owns advancing + marking.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Check, RotateCcw } from 'lucide-react';
import type { Word, ElementTheme } from '../../WfNewTypes';
import { studyT } from './WfNewStudyLocales';
import { WfNewAudioWave } from './WfNewAudioWave';
import { WfNewNoTranslation } from './WfNewNoTranslation';

interface WfNewFlashcardProps {
  word: Word;
  theme: ElementTheme;
  lang: string;
  index: number;
  total: number;
  onSpeak: () => void;
  onKnown: () => void;
  onForgot: () => void;
}

export const WfNewFlashcard: React.FC<WfNewFlashcardProps> = ({
  word,
  theme,
  lang,
  index,
  total,
  onSpeak,
  onKnown,
  onForgot,
}) => {
  const [flipped, setFlipped] = useState(false);
  const nordic = theme.id === 'nordic';

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <span className="text-[10px] font-mono text-zinc-500">
        {studyT(lang, 'study.recite.of', { i: index + 1, n: total })}
      </span>

      <div
        onClick={() => setFlipped((f) => !f)}
        className="w-full max-w-md h-72 cursor-pointer perspective"
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="w-full h-full relative transform-style-3d shadow-2xl rounded-3xl"
        >
          {/* Front */}
          <div
            className={`absolute inset-0 backface-hidden flex flex-col justify-between p-8 rounded-3xl border border-indigo-500/20 text-center ${
              nordic ? 'bg-white text-slate-800' : 'bg-slate-900/80'
            }`}
          >
            <div className="self-end flex items-center gap-2">
              {/* Audio 音波 + count near the speaker (self-pulses on tap). */}
              <WfNewAudioWave
                lang={lang}
                audioUrl={word.audioUrl}
                audioFiles={word.audioFiles}
                audioCount={word.audioCount}
                onPlay={onSpeak}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSpeak();
                }}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10"
                title={studyT(lang, 'study.recite.play')}
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <h3 className="text-4xl font-black tracking-tight">{word.text}</h3>
              <p className="text-sm font-mono text-zinc-400">{word.phonetic}</p>
            </div>
            <p className="text-[10px] uppercase font-mono text-zinc-600">
              {studyT(lang, 'study.reveal')}
            </p>
          </div>

          {/* Back */}
          <div
            className={`absolute inset-0 backface-hidden rotate-y-180 flex flex-col justify-between p-8 rounded-3xl border border-indigo-500/20 text-center ${
              nordic ? 'bg-slate-50 text-slate-900' : 'bg-indigo-950/90'
            }`}
          >
            <span className="text-[10px] font-mono font-bold text-zinc-500">
              {studyT(lang, 'study.definition')}
            </span>
            <div className="space-y-3 overflow-y-auto no-scrollbar">
              {word.translation ? (
                <p className="text-xl font-bold text-indigo-400">{word.translation}</p>
              ) : (
                <div className="flex justify-center">
                  <WfNewNoTranslation lang={lang} />
                </div>
              )}
              {word.definition && (
                <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                  {word.definition}
                </p>
              )}
              {word.example && (
                <p className="text-[11px] italic font-mono text-zinc-500">
                  &ldquo;{word.example}&rdquo;
                </p>
              )}
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              {studyT(lang, 'study.stats.mastered')}: {word.masteryLevel ?? 0}%
            </div>
          </div>
        </motion.div>
      </div>

      {/* Mark controls */}
      <div className="flex gap-4 w-full max-w-md">
        <button
          onClick={onForgot}
          className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-amber-300 rounded-2xl text-xs font-mono font-bold border border-white/5 flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          {studyT(lang, 'study.markForgot')}
        </button>
        <button
          onClick={onKnown}
          className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-mono font-bold flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          {studyT(lang, 'study.markKnown')}
        </button>
      </div>
    </div>
  );
};
