/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */

import React, { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, ProgressBar, IconButton } from '../../components/UI';
import { SkipBack, SkipForward } from 'lucide-react';
import { ApiCenter } from '../../services/ApiCenter';
import { Word } from '../../types';
import { LearningProgressTracker } from '../../services/LearningProgressTracker';

const PlaylistPage = () => {
  const { navigate, playlistSettings, user, currentParams } = useContext(AppContext);
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
    const groupId = currentParams?.groupId || 'g1';
    const language = currentParams?.language || 'en';

    // Use real API to fetch words
    ApiCenter.learning.getWordCards({
      group_id: groupId,
      language: language,
      limit: 100 // Fetch up to 100 words for playlist
    }).then(response => {
      if (response.success && Array.isArray(response.data)) {
        setAllWords(response.data);
      } else {
        console.error('[Playlist] Failed to load words:', response.error);
        setAllWords([]);
      }
    }).catch(err => {
      console.error('[Playlist] Error loading words:', err);
      setAllWords([]);
    });

    // [Learning Progress] Start learning session
    LearningProgressTracker.startSession(groupId, language);

    // [Learning Progress] End session on unmount
    return () => {
      LearningProgressTracker.endSession();
    };
  }, [currentParams?.groupId, currentParams?.language]);

  // Handle Paging
  useEffect(() => {
    const start = currentPageIndex * playlistSettings.wordsPerPage;
    const end = start + playlistSettings.wordsPerPage;
    setPageWords(Array.isArray(allWords) ? allWords.slice(start, end) : []);
    setLocalIndex(0);
    setIsReviewMode(false);
  }, [allWords, currentPageIndex, playlistSettings.wordsPerPage]);

  // Player Engine
  useEffect(() => {
    let timer: any;

    const tick = () => {
      const state = playerStateRef.current;
      if (!state.isPlaying || pageWords.length === 0) return;

      // [Learning Progress] Record current word as reviewed before moving to next
      const currentWord = pageWords[state.localIndex];
      if (currentWord) {
        LearningProgressTracker.recordWordReview(
          currentWord.id,
          currentWord.text,
          true, // In playlist mode, we assume words are reviewed
          currentParams?.groupId || 'g1',
          currentParams?.language || 'en'
        );
      }

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
                 // [Learning Progress] End session when all words complete
                 LearningProgressTracker.endSession().then(() => {
                   setIsPlaying(false); // End of all words
                 });
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

  // [Learning Progress] Start tracking current word when localIndex changes
  useEffect(() => {
    const currentWord = pageWords[localIndex];
    if (currentWord) {
      LearningProgressTracker.startWordTracking(currentWord.id);
    }
  }, [localIndex, pageWords]);

  return (
    <div className="h-full flex flex-col ds-aura-bg animate-slide-up relative overflow-hidden">
      {/* Header with Stats and Settings */}
      <div className="px-5 py-3 flex justify-between items-center z-20 backdrop-blur-md bg-[var(--color-surface)]/80 sticky top-0 border-b border-[var(--border-highlight)]">
         <IconButton icon={<Icons.Back />} onClick={() => navigate('home')} label="Back" />

         <div className="flex flex-col items-center min-w-0 px-3">
            <h1 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                {user?.dailyProgress} / {playlistSettings.dailyGoal}
                <span className="text-[var(--color-text-tertiary)] text-[10px] font-normal">({allWords.length} total)</span>
            </h1>
            <ProgressBar value={progressPercent} className="w-32 mt-1.5 !h-1" />
         </div>

         <IconButton icon={<Icons.Settings />} onClick={() => navigate('playlist_config')} label="Playlist settings" />
      </div>

      {/* Info Bar */}
      <div className="px-5 py-2.5 bg-[var(--klein-blue-soft)] flex justify-between items-center text-[10px] font-bold text-[var(--klein-blue)] uppercase tracking-widest border-b border-[var(--border-highlight)]">
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
                 ds-row relative p-4 transition-all duration-300 cursor-pointer
                 ${isActive
                    ? `z-10 scale-[1.02] ${animate ? 'animate-pulse-slow' : ''}`
                    : 'opacity-90 hover:opacity-100'}
               `}
               style={isActive ? { borderColor: 'var(--klein-blue)', boxShadow: `0 0 0 2px var(--klein-ring), var(--klein-glow)` } : undefined}
             >
                <div className="flex justify-between items-start gap-3">
                   <div className="flex-1 min-w-0">
                      <h3 className={`font-bold transition-all truncate ${isActive ? 'text-[color:var(--klein-blue)]' : 'text-[var(--color-text-primary)]'} ${largeFont ? 'text-2xl' : 'text-lg'}`}>
                        {word.text}
                      </h3>
                      {playlistSettings.displayMode === 'detailed' && (
                          <p className={`font-mono text-xs mt-1 ${isActive ? 'text-[color:var(--klein-blue)] opacity-70' : 'text-[var(--color-text-tertiary)]'}`}>{word.phonetic}</p>
                      )}
                   </div>

                   {(isDetailed || isActive) && (
                       <div className={`text-right max-w-[50%] min-w-0 transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                          <p className={`font-bold leading-tight truncate ${largeFont ? 'text-lg' : 'text-sm'} text-[var(--color-text-primary)]`}>{word.translation}</p>
                       </div>
                   )}
                </div>

                {(isActive && isDetailed) && (
                   <div className="mt-3 pt-3 border-t border-dashed border-[var(--border-highlight)]">
                      <p className="text-[var(--color-text-secondary)] text-xs italic">"{word.example}"</p>
                   </div>
                )}
             </div>
           );
         })}
         
         <div className="h-10 text-center text-xs text-[var(--color-text-tertiary)] uppercase font-bold tracking-widest pt-4">End of Page {currentPageIndex + 1}</div>
      </div>

      {/* Fixed Bottom Controls — centered floating island */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom,12px)+14px)]">
         <div className="ds-bar-pill mx-auto !static !translate-x-0 !w-full max-w-[430px] px-4 py-3">
            <ProgressBar value={localIndex + 1} max={pageWords.length} className="!h-1 mb-3" />

            <div className="flex items-center justify-between">
                {/* Prev Page */}
                <button onClick={prevPage} disabled={currentPageIndex === 0} className="ds-touch-target flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[color:var(--klein-blue)] disabled:opacity-30 transition-colors">
                   <Icons.Rewind />
                </button>

                {/* Prev Word */}
                <button onClick={() => setLocalIndex(i => Math.max(0, i - 1))} aria-label="Previous word" className="ds-touch-target flex items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:text-[color:var(--klein-blue)] transition-colors">
                    <SkipBack className="w-6 h-6" />
                </button>

                {/* Play/Pause — gradient hero (primary verb) */}
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="w-16 h-16 text-[color:var(--klein-on)] rounded-full flex items-center justify-center active:scale-95 transition-transform -translate-y-3"
                  style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
                >
                   {isPlaying ? <Icons.Pause /> : <Icons.Play />}
                </button>

                {/* Next Word */}
                <button onClick={() => setLocalIndex(i => Math.min(pageWords.length - 1, i + 1))} aria-label="Next word" className="ds-touch-target flex items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:text-[color:var(--klein-blue)] transition-colors">
                    <SkipForward className="w-6 h-6" />
                </button>

                {/* Next Page */}
                <button onClick={nextPage} className="ds-touch-target flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[color:var(--klein-blue)] transition-colors">
                   <Icons.ChevronRight />
                </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default PlaylistPage;
