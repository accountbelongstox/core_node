import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Star, Volume2, ShieldCheck, Tag } from 'lucide-react';
import { Word, WordGroup, ElementTheme } from '../WfNewTypes';
import { DEFAULT_VOCAB_GROUP_NAME } from '../api';
import { wfNewStudyProgress } from './study/WfNewStudyProgress';

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
  lang,
  trans
}) => {
  // The Default Vocabulary Group derives its % live from the study-progress
  // store (synced with the backend blob on content load); every other group
  // keeps the API-provided value (which getAllGroup never returns — stays 0).
  const isDefault = group.name === DEFAULT_VOCAB_GROUP_NAME;
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    if (!isDefault) return undefined;
    return wfNewStudyProgress.subscribe(() => setVersion((v) => v + 1));
  }, [isDefault]);
  const percentage = React.useMemo(() => {
    if (!isDefault) return Math.round(group.progress || 0);
    const lib = wfNewStudyProgress.computeLibraryStats(String(group.id), group.count);
    return lib.total > 0 ? Math.min(100, Math.round((lib.readWords / lib.total) * 100)) : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDefault, group.id, group.count, group.progress, version]);

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`p-5 rounded-3xl cursor-pointer group transition-all duration-300 ${theme.cardClass}`}
    >
      <div className="flex flex-col h-full justify-between gap-5">
        
        {/* Top Header */}
        <div className="flex justify-between items-start">
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="text-[10px] font-mono uppercase bg-white/5 border border-white/5 text-zinc-400 px-2 py-0.5 rounded">
            {group.type || trans('cards.typeStandard')}
          </span>
        </div>

        {/* Info */}
        <div className="space-y-1.5">
          <h4 className="font-extrabold text-base leading-snug text-slate-100 group-hover:text-indigo-400 dark:text-inherit dark:group-hover:text-indigo-500 transition-colors truncate">
            {group.name}
          </h4>
          <p className="text-xs text-zinc-500 font-mono tracking-wide">{trans('cards.lexemesTotal', { n: group.count })}</p>
        </div>

        {/* Progress stats bar */}
        <div className="space-y-2 pt-2 border-t border-white/5">
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-zinc-500">{trans('cards.mastered')}</span>
            <span className="font-bold text-indigo-400">{percentage}%</span>
          </div>
          <div className="w-full bg-white/5 dark:bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-indigo-500 h-full rounded-full transition-all duration-1000"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

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
