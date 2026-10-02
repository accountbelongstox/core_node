import React from 'react';
import { motion } from 'framer-motion';
import { Star, Volume2 } from 'lucide-react';
import { ModalShell } from '@/shared/ui/ModalShell';
import type { ElementTheme } from '../WfNewThemes';
import type { Word } from '../api/WfNewApiTypes';
import { translateActive } from '../WfNewLocales';
interface WfNewWordDetailModalProps {
  word: Word | null;
  activeTheme: ElementTheme;
  /** Whether the open word is currently favorited (drives the star fill). */
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (word: Word) => void;
  onPlay: (word: Word) => void;
}

export const WfNewWordDetailModal: React.FC<WfNewWordDetailModalProps> = ({
  word, activeTheme, isFavorite, onClose, onToggleFavorite, onPlay,
}) => {
  if (!word) return null;
  return (
    <ModalShell onClose={onClose} cardClassName={null}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`w-full max-w-md p-6 rounded-3xl border border-white/10 shadow-2xl relative z-10 space-y-4 ${
              activeTheme.id === 'nordic'
                ? 'bg-white text-slate-800'
                : 'bg-slate-900 text-white'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-mono uppercase bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-bold">{translateActive('wordDetail.badge')}</span>
              <button
                onClick={() => onToggleFavorite(word)}
                className="p-1 rounded hover:bg-white/10"
              >
                <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : 'text-zinc-400'}`} />
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h3 className="text-3xl font-black text-indigo-300">{word.text}</h3>
                <button
                  onClick={() => onPlay(word)}
                  className="p-2 bg-white/5 rounded-full hover:bg-white/10"
                >
                  <Volume2 className="w-4 h-4 text-zinc-300" />
                </button>
              </div>
              <p className="text-xs font-mono text-zinc-500">{word.phonetic}</p>
            </div>

            <p className="text-sm font-bold text-zinc-300 border-t border-b border-white/5 py-3">{word.translation}</p>

            {word.definition && (
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">{translateActive('wordDetail.definition')}</span>
                <p className="text-xs text-zinc-400 leading-relaxed font-sans">{word.definition}</p>
              </div>
            )}

            {word.example && (
              <div className="space-y-1 pt-1.5">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">{translateActive('wordDetail.example')}</span>
                <p className="text-xs font-mono italic text-zinc-400 leading-relaxed">&ldquo;{word.example}&rdquo;</p>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-xs font-mono text-zinc-400 rounded-xl mt-2"
            >
              {translateActive('wordDetail.close')}
            </button>
          </motion.div>
    </ModalShell>
  );
};
