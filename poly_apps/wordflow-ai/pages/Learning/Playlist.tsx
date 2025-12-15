
import React, { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons } from '../../components/UI';
import { api } from '../../services/api';
import { Word } from '../../types';

const PlaylistPage = () => {
  const { navigate, playlistSettings, user } = useContext(AppContext);
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageWords, setPageWords] = useState<Word[]>([]);
  
  // Player State
  const [localIndex, setLocalIndex] = useState(0); // Index within the current page
  const [isPlaying, setIsPlaying] = useState(true);
  const [isReviewMode, setIsReviewMode] = useState(false);
  
  // Refs for logic to avoid stale closures in interval
  const playerStateRef = useRef({
    localIndex: 0,
    isPlaying: true,
    repeatCounter: 0,
    isReviewing: false,
    irStack: [] as number[], // For Instant Review logic if needed complex
  });

  const listRef = useRef<HTMLDivElement>(null);

  // Sync refs
  useEffect(() => {
    playerStateRef.current.localIndex = localIndex;
    playerStateRef.current.isPlaying = isPlaying;
    playerStateRef.current.isReviewing = isReviewMode;
  }, [localIndex, isPlaying, isReviewMode]);

  // Load Data
  useEffect(() => {
    api.getWordsForGroup('g1').then(data => {
      // Mock large dataset for testing pagination
      const expanded = [...data, ...data, ...data, ...data, ...data]; // ~40 words
      setAllWords(expanded);
    });
  }, []);

  // Handle Paging
  useEffect(() => {
    const start = currentPageIndex * playlistSettings.wordsPerPage;
    const end = start + playlistSettings.wordsPerPage;
    setPageWords(allWords.slice(start, end));
    setLocalIndex(0);
    setIsReviewMode(false);
  }, [allWords, currentPageIndex, playlistSettings.wordsPerPage]);

  // Player Engine
  useEffect(() => {
    let timer: any;
    
    const tick = () => {
      const state = playerStateRef.current;
      if (!state.isPlaying || pageWords.length === 0) return;

      let nextIndex = state.localIndex + 1;

      // Check IR logic
      if (playlistSettings.instantReviewEnabled && !state.isReviewing && (!playlistSettings.reviewModeEnabled || !playlistSettings.disableIRInReview)) {
          if (state.localIndex > 0 && state.localIndex % playlistSettings.instantReviewInterval === 0) {
             // IR Logic simplified for demo
          }
      }

      if (nextIndex >= pageWords.length) {
         // Page Finished
         if (playlistSettings.reviewModeEnabled && !state.isReviewing) {
            // Enter Review Mode: Restart Page
            setIsReviewMode(true);
            setLocalIndex(0);
            scrollToItem(0);
            return; // Wait for next tick
         } else {
             // Next Page or Stop
             if ((currentPageIndex + 1) * playlistSettings.wordsPerPage < allWords.length) {
                 setCurrentPageIndex(p => p + 1);
                 setIsReviewMode(false);
             } else {
                 setIsPlaying(false); // End of all words
             }
             return;
         }
      }

      setLocalIndex(nextIndex);
      scrollToItem(nextIndex);
    };

    if (isPlaying && pageWords.length > 0) {
       const intervalMs = (playlistSettings.playInterval * 1000) / playlistSettings.playbackSpeed;
       timer = setInterval(tick, intervalMs);
    }

    return () => clearInterval(timer);
  }, [isPlaying, pageWords, playlistSettings, currentPageIndex, allWords.length]);


  const scrollToItem = (index: number) => {
    if (listRef.current && playlistSettings.autoScroll) {
      const item = listRef.current.children[index] as HTMLElement;
      if (item) {
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleManualClick = (index: number) => {
    setLocalIndex(index);
    scrollToItem(index);
    setIsPlaying(true);
  };

  const nextPage = () => {
      if ((currentPageIndex + 1) * playlistSettings.wordsPerPage < allWords.length) {
          setCurrentPageIndex(p => p + 1);
      }
  };

  const prevPage = () => {
      if (currentPageIndex > 0) setCurrentPageIndex(p => p - 1);
  };

  const progressPercent = Math.min(100, Math.round((user?.dailyProgress || 0) / playlistSettings.dailyGoal * 100));

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] dark:bg-slate-950 animate-slide-up relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:to-slate-800 -z-10"></div>
      
      {/* Header with Stats and Settings */}
      <div className="px-5 py-3 flex justify-between items-center z-20 backdrop-blur-md bg-white/70 dark:bg-slate-900/80 sticky top-0 border-b border-slate-200 dark:border-slate-800 shadow-sm">
         <button onClick={() => navigate('home')} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><Icons.Back /></button>
         
         <div className="flex flex-col items-center">
            <h1 className="text-sm font-bold dark:text-white flex items-center gap-2">
                {user?.dailyProgress} / {playlistSettings.dailyGoal} 
                <span className="text-slate-400 text-[10px] font-normal">({allWords.length} total)</span>
            </h1>
            <div className="w-32 h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
            </div>
         </div>
         
         <button onClick={() => navigate('playlist_config')} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300">
             <Icons.Settings />
         </button>
      </div>

      {/* Info Bar */}
      <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900/50 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
          <span>Page {currentPageIndex + 1}</span>
          <span>{isReviewMode ? 'Review Mode' : 'Learning Mode'}</span>
          <span>{playlistSettings.playbackSpeed}x • {playlistSettings.playInterval}s</span>
      </div>

      {/* List */}
      <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 pb-48 space-y-3">
         {pageWords.map((word, i) => {
           const isActive = i === localIndex;
           const isDetailed = playlistSettings.displayMode === 'detailed';
           const largeFont = playlistSettings.largeFont;
           const animate = playlistSettings.showAnimation;
           
           return (
             <div 
               key={`${word.id}-${i}`}
               onClick={() => handleManualClick(i)}
               className={`
                 relative p-4 rounded-2xl transition-all duration-300 cursor-pointer border
                 ${isActive 
                    ? `z-10 scale-[1.02] shadow-xl border-blue-400 ${
                        animate 
                          ? 'bg-white dark:bg-blue-900/40 animate-pulse-slow' 
                          : 'bg-blue-50 dark:bg-blue-900/60 ring-2 ring-blue-500 dark:ring-blue-400'
                      }` 
                    : 'bg-white/60 dark:bg-slate-800/40 border-transparent hover:bg-white/80'}
               `}
             >
                <div className="flex justify-between items-start">
                   <div className="flex-1">
                      <h3 className={`font-bold transition-all ${isActive ? 'text-blue-600 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'} ${largeFont ? 'text-2xl' : 'text-lg'}`}>
                        {word.text}
                      </h3>
                      {playlistSettings.displayMode === 'detailed' && (
                          <p className={`font-mono text-xs mt-1 ${isActive ? 'text-blue-400' : 'text-slate-400'}`}>{word.phonetic}</p>
                      )}
                   </div>
                   
                   {(isDetailed || isActive) && (
                       <div className={`text-right max-w-[50%] transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                          <p className={`font-bold leading-tight ${largeFont ? 'text-lg' : 'text-sm'} dark:text-white`}>{word.translation}</p>
                       </div>
                   )}
                </div>

                {(isActive && isDetailed) && (
                   <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                      <p className="text-slate-500 text-xs italic">"{word.example}"</p>
                   </div>
                )}
             </div>
           );
         })}
         
         <div className="h-10 text-center text-xs text-slate-300 uppercase font-bold tracking-widest pt-4">End of Page {currentPageIndex + 1}</div>
      </div>

      {/* Fixed Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 pb-safe">
         {/* Progress Slider (Visual only for now) */}
         <div className="w-full bg-slate-200 h-1">
             <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${((localIndex + 1) / pageWords.length) * 100}%` }}></div>
         </div>
         
         <div className="flex items-center justify-between px-6 py-4">
             {/* Prev Page */}
             <button onClick={prevPage} disabled={currentPageIndex === 0} className="text-slate-400 hover:text-blue-500 disabled:opacity-30">
                <Icons.Rewind />
             </button>

             {/* Prev Word */}
             <button onClick={() => setLocalIndex(i => Math.max(0, i - 1))} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
                 <span className="text-xl transform rotate-180 inline-block">▶</span>
             </button>

             {/* Play/Pause */}
             <button 
               onClick={() => setIsPlaying(!isPlaying)} 
               className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40 active:scale-95 transition-transform"
             >
                {isPlaying ? <Icons.Pause /> : <Icons.Play />}
             </button>

             {/* Next Word */}
             <button onClick={() => setLocalIndex(i => Math.min(pageWords.length - 1, i + 1))} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
                 <span className="text-xl">▶</span>
             </button>

             {/* Next Page */}
             <button onClick={nextPage} className="text-slate-400 hover:text-blue-500">
                <Icons.ChevronRight />
             </button>
         </div>
      </div>
    </div>
  );
};

export default PlaylistPage;
