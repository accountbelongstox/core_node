import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Star, Volume2, ShieldCheck, Tag } from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';
import type { Word, WordGroup } from '../api/WfNewApiTypes';
import { useWordGroupProgress } from './study/useWordGroupProgress';
import { TickBar } from '@/shared/ui/ProgressBar';
import { homeArt } from './WfNewHomeArt';

const GROUP_ART = 'mode-reading';

interface CourseBlockCardProps {
  group: WordGroup;
  theme: ElementTheme;
  onClick: () => void;
  lang: string;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const CourseBlockCard: React.FC<CourseBlockCardProps> = ({
  group,
  theme,
  onClick,
  trans
}) => {
  const progress = useWordGroupProgress(group);
  const art = homeArt(GROUP_ART);

  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`cursor-pointer select-none rounded-2xl p-3 transition-colors ${theme.cardClass}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <span className={`inline-block rounded-full bg-indigo-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${theme.accentText}`}>
            {group.type || trans('cards.typeStandard')}
          </span>
          <h4 className={`mt-1 line-clamp-2 text-sm font-bold leading-snug ${theme.textPrimaryClass}`}>{group.name}</h4>
          <p className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${theme.textSecondaryClass}`}>
            <span>{trans('cards.lexemesTotal', { n: progress.total })}</span>
            <span aria-hidden className="h-0.5 w-0.5 rounded-full bg-current" />
            <span>{progress.percent}%</span>
            {progress.due > 0 && (
              <>
                <span aria-hidden className="h-0.5 w-0.5 rounded-full bg-current" />
                <span className="text-amber-500">{trans('cards.dueCount', { n: progress.due })}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-fuchsia-100 dark:from-sky-500/20 dark:to-fuchsia-500/15">
          {art
            ? <img src={art} alt="" aria-hidden loading="lazy" decoding="async" draggable={false} className="h-12 w-12 object-contain drop-shadow-[0_6px_8px_rgba(15,23,42,0.2)]" />
            : <BookOpen className="h-6 w-6 text-indigo-400" />}
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2 rounded-full bg-black/[0.04] p-1 pr-3 dark:bg-white/[0.04]">
        <TickBar done={progress.read} total={progress.total} className="h-3.5" label={trans('cards.mastered')} />
        <span className={`shrink-0 text-[10px] font-medium ${theme.textSecondaryClass}`}>{trans('cards.wordsLeft', { n: progress.left })}</span>
      </div>
    </motion.div>
  );
};

interface WordRowItemProps {
  word: Word;
  isFav: boolean;
  onToggleFav: () => void;
  onPlayAudio: () => void;
  onClick: () => void;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WordRowItem: React.FC<WordRowItemProps> = ({
  word,
  isFav,
  onToggleFav,
  onPlayAudio,
  onClick,
  theme,
  trans
}) => {
  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-2xl hover:bg-white/5 bg-slate-900/35 dark:bg-slate-900/35 border border-white/5 hover:border-indigo-500/10 flex justify-between items-center group cursor-pointer transition-all ${
        theme.id === 'nordic' ? 'hover:bg-slate-100/50' : ''
      }`}
    >
      <div className="min-w-0 pr-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <p className="font-black text-sm text-slate-200 group-hover:text-indigo-400 dark:text-slate-800 dark:group-hover:text-indigo-600 transition-colors">
            {word.text}
          </p>
          <span className="text-[10px] font-mono text-zinc-500">{word.phonetic}</span>

          {word.tags && word.tags.map(tag => (
            <span key={tag} className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.2 rounded font-mono font-medium">
              {tag}
            </span>
          ))}
        </div>
        <p className="text-xs text-zinc-400 dark:text-slate-500 mt-1 truncate">{word.translation}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Play Icon */}
        <button
          onClick={onPlayAudio}
          className="w-9 h-9 rounded-full bg-white/5 dark:bg-slate-200/50 hover:bg-white/10 dark:hover:bg-slate-200 flex items-center justify-center text-zinc-300 dark:text-slate-700 transition-transform active:scale-95"
          title={trans('tip.speak')}
        >
          <Volume2 className="w-4 h-4" />
        </button>

        {/* Favorite Star flag */}
        <button
          onClick={onToggleFav}
          className="w-9 h-9 rounded-full bg-white/5 dark:bg-slate-200/50 hover:bg-white/10 dark:hover:bg-slate-200 flex items-center justify-center transition-transform active:scale-95"
          title={trans('cards.favTitle')}
        >
          <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-zinc-500 dark:text-slate-400'}`} />
        </button>
      </div>
    </motion.div>
  );
};
