import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Volume2, Star, X, Layers, RefreshCw, Cpu } from 'lucide-react';
import { Word, ElementTheme } from '../WfNewTypes';

interface WfNewSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: Word[];
  searching: boolean;
  favorites: Word[];
  onToggleFavorite: (word: Word) => void;
  onSelectWord: (word: Word) => void;
  onPlayAudio: (word: Word) => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  activeTheme: ElementTheme;
  dark?: boolean;
}

export const WfNewSearchOverlay: React.FC<WfNewSearchOverlayProps> = ({
  isOpen,
  onClose,
  searchQuery,
  setSearchQuery,
  searchResults,
  searching,
  favorites,
  onToggleFavorite,
  onSelectWord,
  onPlayAudio,
  trans,
  activeTheme,
  dark = true
}) => {
  const [selectedLangCode, setSelectedLangCode] = React.useState<'all' | 'en' | 'fr' | 'de' | 'es'>('all');

  const finalFilteredWords = React.useMemo(() => {
    if (selectedLangCode === 'all') return searchResults;
    return searchResults.filter(word => {
      const lowerTags = (word.tags || []).map(t => t.toLowerCase());
      // Match language-specific terms or simulated tags
      if (selectedLangCode === 'en') {
        return !lowerTags.includes('fr') && !lowerTags.includes('de') && !lowerTags.includes('es');
      }
      return lowerTags.includes(selectedLangCode);
    });
  }, [searchResults, selectedLangCode]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-center p-4 sm:p-6 md:p-20">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Search Panel Card with Slide down and Pulse Breathing outline glow effect */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -100 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              boxShadow: [
                '0 20px 40px -15px rgba(99,102,241,0.2)',
                '0 20px 40px -15px rgba(245,158,11,0.3)',
                '0 20px 40px -15px rgba(236,72,153,0.35)',
                '0 20px 40px -15px rgba(99,102,241,0.2)'
              ],
              borderColor: [
                'rgba(255,255,255,0.08)',
                'rgba(168,85,247,0.35)',
                'rgba(244,63,94,0.3)',
                'rgba(255,255,255,0.08)'
              ]
            }}
            exit={{ opacity: 0, scale: 0.97, y: -100 }}
            transition={{ 
              y: { type: 'spring', damping: 25, stiffness: 220 },
              boxShadow: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
              borderColor: { duration: 6, repeat: Infinity, ease: 'easeInOut' }
            }}
            className={`w-full max-w-2xl h-fit max-h-[80vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden relative z-10 p-5 ${
              dark 
                ? 'bg-slate-900 border-white/10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)]' 
                : 'bg-white border-zinc-250 text-slate-950 shadow-[0_20px_50px_rgba(0,0,0,0.12)]'
            }`}
          >
            {/* Header / Search input */}
            <div className="relative flex items-center mb-3">
              <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`} />
              <input
                type="text"
                autoFocus
                placeholder={trans('search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-12 pr-12 py-3.5 rounded-2xl text-sm font-mono outline-none transition-all ${
                  dark 
                    ? 'bg-slate-950 border border-white/5 text-white focus:border-indigo-500' 
                    : 'bg-zinc-100 border border-zinc-300/85 text-slate-950 focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100'
                }`}
              />
              <button
                onClick={onClose}
                className={`absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${
                  dark ? 'text-zinc-400 hover:text-white hover:bg-white/10' : 'text-zinc-500 hover:text-slate-900 hover:bg-zinc-200'
                }`}
                title={trans('search.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Language filter ribbon wrapper */}
            <div className={`flex gap-2 mb-4 items-center overflow-x-auto pb-2 select-none no-scrollbar border-b ${dark ? 'border-white/5' : 'border-zinc-200'}`}>
              <span className={`text-[10px] font-mono font-bold tracking-wider uppercase whitespace-nowrap ${dark ? 'text-zinc-500' : 'text-zinc-500'}`}>{trans('search.filterLang')}:</span>
              <div className="flex gap-1.5 pl-1">
                {[
                  { code: 'all', label: `${trans('search.langAll')} 🌐` },
                  { code: 'en', label: `${trans('lang.name.en')} 🇺🇸` },
                  { code: 'fr', label: `${trans('lang.name.fr')} 🇫🇷` },
                  { code: 'de', label: `${trans('lang.name.de')} 🇩🇪` },
                  { code: 'es', label: `${trans('lang.name.es')} 🇪🇸` }
                ].map((langItem) => {
                  const isSelected = selectedLangCode === langItem.code;
                  return (
                    <button
                      key={langItem.code}
                      onClick={() => setSelectedLangCode(langItem.code as any)}
                      className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap border ${
                        isSelected 
                          ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-500 dark:text-indigo-300 shadow-sm' 
                          : dark
                            ? 'bg-white/5 border-white/5 text-zinc-400 hover:text-zinc-200'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-650 hover:text-slate-900 hover:bg-zinc-150'
                      }`}
                    >
                      {langItem.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Scrolling Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar py-1 max-h-[45vh] pr-1">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  {searchQuery ? trans('search.recent') : trans('search.favorites')}
                </span>
                
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono"
                  >
                    Clear Input
                  </button>
                )}
              </div>

              {searching && (
                <div className="flex justify-center items-center py-12 gap-2.5 text-zinc-400 text-xs font-mono">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  Quantum query matching...
                </div>
              )}

              {!searching && searchQuery && finalFilteredWords.length === 0 && (
                <div className="text-zinc-500 text-center py-12 text-xs font-mono">
                  {trans('search.noresults')} {trans('search.noMatchSuffix', { code: selectedLangCode })}
                </div>
              )}

              <div className="space-y-2">
                {/* Search query matching rows */}
                {searchQuery && finalFilteredWords.map(word => {
                  const isFav = favorites.some(f => f.id === word.id);
                  return (
                    <div
                      key={word.id}
                      onClick={() => onSelectWord(word)}
                      className={`flex justify-between items-center p-3 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-indigo-500/20 group ${
                        dark ? 'bg-white/5 hover:bg-indigo-500/10' : 'bg-slate-100/60 border-slate-200 hover:bg-indigo-50/50'
                      }`}
                    >
                      <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <p className={`font-extrabold text-sm transition-colors ${dark ? 'text-indigo-300 group-hover:text-indigo-400' : 'text-indigo-650 group-hover:text-indigo-800'}`}>{word.text}</p>
                          <span className={`text-[11px] font-mono ${dark ? 'text-zinc-500' : 'text-zinc-650'}`}>{word.phonetic}</span>
                        </div>
                        <p className={`text-xs mt-1 truncate ${dark ? 'text-zinc-400' : 'text-zinc-650'}`}>{word.translation}</p>
                      </div>

                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onPlayAudio(word)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${
                            dark ? 'bg-white/5 hover:bg-white/10 text-zinc-300' : 'bg-white hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
                          }`}
                          title={trans('tip.speak')}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onToggleFavorite(word)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${
                            dark ? 'bg-white/5 hover:bg-white/10' : 'bg-white hover:bg-zinc-200 border border-zinc-200'
                          }`}
                          title={trans('search.saveBookmark')}
                        >
                          <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : dark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Favorite cards when search input empty */}
                {!searchQuery && favorites.map(word => (
                  <div
                    key={word.id}
                    onClick={() => onSelectWord(word)}
                    className={`flex justify-between items-center p-3 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-indigo-500/20 group ${
                      dark ? 'bg-white/5 hover:bg-indigo-500/10' : 'bg-slate-100/60 border-slate-200 hover:bg-indigo-50/50'
                    }`}
                  >
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <p className={`font-extrabold text-sm transition-colors ${dark ? 'text-indigo-300 group-hover:text-indigo-400' : 'text-indigo-650 group-hover:text-indigo-800'}`}>{word.text}</p>
                        <span className={`text-[11px] font-mono ${dark ? 'text-zinc-500' : 'text-zinc-600'}`}>{word.phonetic}</span>
                      </div>
                      <p className={`text-xs mt-1 truncate ${dark ? 'text-zinc-400' : 'text-zinc-650'}`}>{word.translation}</p>
                    </div>

                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onPlayAudio(word)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center ${
                          dark ? 'bg-white/5 hover:bg-white/10 text-zinc-300' : 'bg-white hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
                        }`}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onToggleFavorite(word)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center ${
                          dark ? 'bg-white/5 hover:bg-white/10' : 'bg-white hover:bg-zinc-200 border border-zinc-200'
                        }`}
                      >
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      </button>
                    </div>
                  </div>
                ))}

                {!searchQuery && favorites.length === 0 && (
                  <div className="text-zinc-500 text-center py-16 text-xs font-mono">
                    Your favorites cabinet is empty. Keep stars checked in practice modes!
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
