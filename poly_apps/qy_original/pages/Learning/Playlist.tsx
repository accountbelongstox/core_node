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
  const [scrollY, setScrollY] = useState(0);
  const [activeTab, setActiveTab] = useState<'page' | 'learning'>('page');
  
  // Player State
  const [localIndex, setLocalIndex] = useState(0); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  
  const playerStateRef = useRef({ localIndex: 0, isPlaying: false });
  const listRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    playerStateRef.current.localIndex = localIndex;
    playerStateRef.current.isPlaying = isPlaying;
  }, [localIndex, isPlaying]);

  useEffect(() => {
    api.getWordsForGroup('g1').then(data => {
      const expanded = [...data, ...data, ...data, ...data, ...data];
      setAllWords(expanded);
    });
  }, []);

  useEffect(() => {
    const start = currentPageIndex * playlistSettings.wordsPerPage;
    const end = start + playlistSettings.wordsPerPage;
    setPageWords(allWords.slice(start, end));
    setLocalIndex(0);
    setIsReviewMode(false);
  }, [allWords, currentPageIndex, playlistSettings.wordsPerPage]);

  // Scroll handler for header transparency
  useEffect(() => {
    const handleScroll = () => {
      if (listRef.current) {
        setScrollY(listRef.current.scrollTop);
      }
    };

    const scrollElement = listRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, []);

  useEffect(() => {
    let timer: any;
    const tick = () => {
      const state = playerStateRef.current;
      if (!state.isPlaying || pageWords.length === 0) return;

      let nextIndex = state.localIndex + 1;
      if (nextIndex >= pageWords.length) {
          if ((currentPageIndex + 1) * playlistSettings.wordsPerPage < allWords.length) {
              setCurrentPageIndex(p => p + 1);
          } else {
              setIsPlaying(false);
          }
          return;
      }
      setLocalIndex(nextIndex);
      scrollToItem(nextIndex);
    };

    if (isPlaying && pageWords.length > 0) {
       const intervalMs = (playlistSettings.playInterval * 1000) / playlistSettings.playbackSpeed;
       timer = setInterval(tick, intervalMs);
    }
    return () => clearInterval(timer);
  }, [isPlaying, pageWords, playlistSettings, currentPageIndex]);

  const scrollToItem = (index: number) => {
    if (listRef.current) {
      const item = listRef.current.children[index] as HTMLElement;
      if (item) {
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleManualClick = (index: number) => {
    setLocalIndex(index);
    scrollToItem(index);
    setIsPlaying(false);
  };

  const currentWordIndex = currentPageIndex * playlistSettings.wordsPerPage + localIndex + 1;
  const totalWords = allWords.length;
  const currentPageWords = pageWords.length;
  
  // Calculate header opacity based on scroll
  const headerOpacity = Math.min(0.98, 0.7 + (scrollY / 150) * 0.28);
  const headerBlur = Math.min(30, 15 + (scrollY / 150) * 15);

  return (
    <div className="playlist-wrapper-standard animate-slide-up">
      {/* Top Header with Progress */}
      <div 
        ref={headerRef}
        className="playlist-header-standard"
        style={{
          background: `rgba(255, 255, 255, ${headerOpacity})`,
          backdropFilter: `blur(${headerBlur}px)`,
          WebkitBackdropFilter: `blur(${headerBlur}px)`,
        }}
      >
         <div className="playlist-header-row">
             <button onClick={() => navigate('home')} className="playlist-back-btn">
                 <Icons.Back />
             </button>
             <div className="playlist-progress-info">
                 <div className="playlist-progress-text">
                     {currentWordIndex} / {totalWords} ({currentPageWords} total)
                 </div>
                 <div className="playlist-progress-bar">
                     <div 
                         className="playlist-progress-fill-standard" 
                         style={{ width: `${(currentWordIndex / totalWords) * 100}%` }}
                     ></div>
                 </div>
             </div>
             <button onClick={() => navigate('playlist_config')} className="playlist-settings-btn">
                 <Icons.Settings />
             </button>
         </div>
         
         {/* Tabs and Speed */}
         <div className="playlist-tabs-row">
             <div className="playlist-tabs">
                 <button 
                     className={`playlist-tab ${activeTab === 'page' ? 'active' : ''}`}
                     onClick={() => setActiveTab('page')}
                 >
                     PAGE {currentPageIndex + 1}
                 </button>
                 <button 
                     className={`playlist-tab ${activeTab === 'learning' ? 'active' : ''}`}
                     onClick={() => setActiveTab('learning')}
                 >
                     LEARNING MODE
                 </button>
             </div>
             <div className="playlist-speed-display">
                 {playlistSettings.playbackSpeed}X • {playlistSettings.playInterval}S
             </div>
         </div>
      </div>

      {/* Scrollable Word List */}
      <div ref={listRef} className="playlist-scroll-area-standard">
         {pageWords.map((word, i) => {
           const isActive = i === localIndex;
           return (
             <div 
               key={`${word.id}-${i}`}
               onClick={() => handleManualClick(i)}
               className={`playlist-word-card-standard ${isActive ? 'active' : ''}`}
             >
                <div className="playlist-word-content">
                   <div className="playlist-word-left">
                      <h3 className={`playlist-word-title ${isActive ? 'active' : ''}`}>
                        {word.text}
                      </h3>
                      <p className={`playlist-word-phonetic-standard ${isActive ? 'active' : ''}`}>
                          {word.phonetic}
                      </p>
                      {isActive && word.example && (
                          <p className="playlist-word-example-standard">
                              {word.example}
                          </p>
                      )}
                   </div>
                   <div className={`playlist-word-translation-standard ${isActive ? 'active' : ''}`}>
                      {word.translation}
                   </div>
                </div>
             </div>
           );
         })}
      </div>

      {/* Bottom Playback Controls */}
      <div className="playlist-bottom-controls">
         <button 
             onClick={() => {
                 const newIndex = Math.max(0, localIndex - 5);
                 setLocalIndex(newIndex);
                 scrollToItem(newIndex);
             }}
             className="playlist-control-btn-bottom"
         >
             <Icons.Rewind />
         </button>
         <button 
             onClick={() => {
                 const newIndex = Math.max(0, localIndex - 1);
                 setLocalIndex(newIndex);
                 scrollToItem(newIndex);
             }}
             className="playlist-control-btn-bottom"
             disabled={localIndex === 0}
         >
             <Icons.Back />
         </button>
         <button 
             onClick={() => setIsPlaying(!isPlaying)} 
             className="playlist-play-btn-bottom"
         >
             {isPlaying ? <Icons.Pause /> : <Icons.Play />}
         </button>
         <button 
             onClick={() => {
                 const newIndex = Math.min(pageWords.length - 1, localIndex + 1);
                 setLocalIndex(newIndex);
                 scrollToItem(newIndex);
             }}
             className="playlist-control-btn-bottom"
             disabled={localIndex >= pageWords.length - 1}
         >
             <Icons.ChevronRight />
         </button>
         <button 
             onClick={() => {
                 const newIndex = Math.min(pageWords.length - 1, localIndex + 5);
                 setLocalIndex(newIndex);
                 scrollToItem(newIndex);
             }}
             className="playlist-control-btn-bottom playlist-fast-forward"
         >
             <Icons.ChevronRight />
             <Icons.ChevronRight style={{ marginLeft: '-0.5rem' }} />
         </button>
      </div>
    </div>
  );
};

export default PlaylistPage;
