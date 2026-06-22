/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, IconButton, LoadingState } from '../../components/UI';
import { Eye } from 'lucide-react';
import { ApiCenter } from '../../services/ApiCenter';
import { Word } from '../../types';
import { LearningProgressTracker } from '../../services/LearningProgressTracker';

const ReadingRunPage = () => {
  const { navigate, currentParams, settings, t } = useContext(AppContext);
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDetail, setShowDetail] = useState(true);
  
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    if(!currentParams.groupId) return;

    const groupId = currentParams.groupId;
    const language = currentParams.language || 'en';

    // Use real API
    ApiCenter.learning.getWordCards({
      group_id: groupId,
      language: language,
      limit: 50
    }).then(response => {
      if (response.success && Array.isArray(response.data)) {
        setWords(response.data);
        if(settings.audio.autoPlay) setIsPlaying(true);
      } else {
        console.error('[Reading] Failed to load words:', response.error);
        setWords([]);
      }

      // [Learning Progress] Start learning session
      LearningProgressTracker.startSession(groupId, language);
    }).catch(err => {
      console.error('[Reading] Error loading words:', err);
    });

    // [Learning Progress] End session on unmount
    return () => {
      LearningProgressTracker.endSession();
    };
  }, [currentParams.groupId, currentParams.language]);

  useEffect(() => {
    let interval: any;
    if (isPlaying && words.length > 0) {
      interval = setInterval(() => {
        handleNext();
      }, settings.audio.speed * 3000); 
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, words]);

  const handleNext = () => {
    // [Learning Progress] Record that user reviewed this word (assume correct for reading mode)
    const currentWord = words[currentIndex];
    if (currentWord) {
      LearningProgressTracker.recordWordReview(
        currentWord.id,
        currentWord.text,
        true, // In reading mode, we assume user reviewed the word
        currentParams.groupId,
        currentParams.language || 'en'
      );
    }

    historyRef.current.push(currentIndex);
    if (historyRef.current.length > 10) historyRef.current.shift();

    if (currentIndex < words.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
      // [Learning Progress] End session before navigating
      LearningProgressTracker.endSession().then(() => {
        navigate('home');
      });
    }
  };

  const handleInstantReview = () => {
    setIsPlaying(false);
    const prev = historyRef.current.pop();
    if (prev !== undefined) {
      setCurrentIndex(prev);
    } else if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const currentWord = words[currentIndex];

  // [Learning Progress] Start tracking current word when index changes
  useEffect(() => {
    if (currentWord) {
      LearningProgressTracker.startWordTracking(currentWord.id);
    }
  }, [currentIndex, currentWord]);

  if (!currentWord) return (
    <div className="ds-page h-full flex items-center justify-center">
      <LoadingState label={t('reading.loadingEngine')} />
    </div>
  );

  return (
    <div className="ds-page h-full flex flex-col p-6 pt-safe pb-safe relative overflow-hidden">
      {/* Top Bar */}
      <div className="relative z-10 flex justify-between items-center mb-10 gap-3">
        <div className="px-4 py-1.5 rounded-full ds-glass ds-glass-edge text-xs font-bold text-[var(--color-text-secondary)]">
           {currentIndex + 1} <span className="text-[var(--color-text-tertiary)] mx-1">/</span> {words.length}
        </div>
        <div className="flex gap-2">
           <IconButton
             icon={<Eye className="w-5 h-5" />}
             label={t('reading.review') || 'Toggle detail'}
             active={showDetail}
             onClick={() => setShowDetail(!showDetail)}
           />
           <IconButton
             icon={<Icons.Close />}
             label="Close"
             onClick={() => navigate('home')}
           />
        </div>
      </div>

      {/* Word Card */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-float">
         <div className="relative">
            <h1 className="text-6xl font-black text-[var(--color-text-primary)] tracking-tighter mb-5 transition-all duration-300">
               {currentWord.text}
            </h1>
            {settings.display.showPhonetic && (
               <div className="inline-block px-5 py-2 rounded-2xl ds-glass ds-glass-edge text-[var(--klein-blue)] font-mono text-lg">
                  {currentWord.phonetic}
               </div>
            )}
         </div>

         <div className={`transition-all duration-700 ease-out transform ${showDetail ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
            {settings.display.showTranslation && (
               <div className="text-3xl font-bold text-[var(--color-text-secondary)] mb-10 tracking-tight">
                  {currentWord.translation}
               </div>
            )}

            <div className="ds-card p-8 rounded-[var(--radius-card)] max-w-xs mx-auto">
               <p className="text-[var(--color-text-primary)] text-lg leading-relaxed italic">
                  "{currentWord.example}"
               </p>
            </div>
         </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 h-32 flex items-center justify-center gap-8 pb-4">
         <button onClick={handleInstantReview} className="flex flex-col items-center gap-3 group">
            <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-lg group-active:scale-90 transition-all hover:bg-amber-500/25">
               <Icons.Rewind />
            </div>
            <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest group-hover:text-amber-500 transition-colors">{t('reading.review')}</span>
         </button>

         <button onClick={() => setIsPlaying(!isPlaying)} className="transform transition-transform active:scale-95 group">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isPlaying ? 'ds-glass ds-glass-edge text-[var(--color-text-secondary)]' : 'text-[var(--klein-on)] hover:scale-105'}`}
              style={isPlaying ? undefined : { background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
            >
               {isPlaying ? <Icons.Pause /> : <Icons.Play />}
            </div>
         </button>

         <button onClick={handleNext} className="flex flex-col items-center gap-3 group">
            <div className="w-16 h-16 rounded-full ds-glass ds-glass-edge flex items-center justify-center text-[var(--color-text-primary)] shadow-lg group-active:scale-90 transition-all">
               <Icons.ChevronRight />
            </div>
            <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest group-hover:text-[var(--klein-blue)] transition-colors">{t('reading.next')}</span>
         </button>
      </div>
    </div>
  );
};

export default ReadingRunPage;