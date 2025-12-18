
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Button } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';
import { Word } from '../../types';
import { LearningProgressTracker } from '../../services/LearningProgressTracker';

const FlashcardRunPage = () => {
  const { navigate, settings, currentParams } = useContext(AppContext);
  const [words, setWords] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    // Use groupId from params or hardcoded for demo
    const groupId = currentParams?.groupId || 'g1';
    const language = currentParams?.language || 'en';

    // Use real API
    ApiCenter.learning.getWordCards({
      group_id: groupId,
      language: language,
      limit: 50 // Flashcards typically use smaller sets
    }).then(response => {
      if (response.success && response.data) {
        setWords(response.data);
      } else {
        console.error('[Flashcard] Failed to load words:', response.error);
        setWords([]);
      }

      // [Learning Progress] Start learning session
      LearningProgressTracker.startSession(groupId, language);
    }).catch(err => {
      console.error('[Flashcard] Error loading words:', err);
    });

    // [Learning Progress] End session on unmount
    return () => {
      LearningProgressTracker.endSession();
    };
  }, [currentParams?.groupId, currentParams?.language]);

  const handleRate = (rating: 'hard' | 'good' | 'easy') => {
    const current = words[index];

    // [Learning Progress] Record word review based on rating
    // Hard = incorrect, Good/Easy = correct
    if (current) {
      const correct = rating !== 'hard';
      LearningProgressTracker.recordWordReview(
        current.id,
        current.text,
        correct,
        currentParams?.groupId || 'g1',
        currentParams?.language || 'en'
      );
    }

    setFlipped(false);
    setTimeout(() => {
      if (index < words.length - 1) {
        setIndex(prev => prev + 1);
      } else {
        // [Learning Progress] End session before finishing
        LearningProgressTracker.endSession().then(() => {
          setFinished(true);
        });
      }
    }, 200);
  };

  const current = words[index];

  // [Learning Progress] Start tracking current word when index changes
  useEffect(() => {
    if (current) {
      LearningProgressTracker.startWordTracking(current.id);
    }
  }, [index, current]);

  if (!current) return <div className="p-10 text-center">Loading...</div>;

  if (finished) return (
    <div className="h-full flex flex-col items-center justify-center p-8 animate-fade-in text-center">
       <div className="text-6xl mb-6">🎉</div>
       <h2 className="text-3xl font-bold dark:text-white mb-2">Session Complete!</h2>
       <p className="text-slate-500 mb-8">You reviewed {words.length} cards.</p>
       <Button onClick={() => navigate('home')}>Back Home</Button>
    </div>
  );

  return (
    <div className="h-full flex flex-col p-6 pt-safe pb-safe relative">
       {/* Progress */}
       <div className="flex items-center justify-between mb-8 z-10">
          <button onClick={() => navigate('home')}><Icons.Back /></button>
          <div className="text-sm font-bold text-slate-500">{index + 1} / {words.length}</div>
          <button className="opacity-0"><Icons.Settings /></button>
       </div>

       {/* 3D Card Container */}
       <div className="flex-1 perspective-1000 relative flex items-center justify-center z-10">
          <div 
             className={`
               w-full aspect-[3/4] max-h-[500px] relative transition-transform duration-500 transform-style-3d cursor-pointer
               ${flipped ? 'rotate-y-180' : ''}
             `}
             onClick={() => setFlipped(!flipped)}
             style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
          >
             {/* Front */}
             <div className="absolute inset-0 backface-hidden holo-card rounded-[2.5rem] flex flex-col items-center justify-center p-8 shadow-2xl border-white/50">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest absolute top-8">Word</span>
                <h2 className="text-5xl font-black text-slate-800 dark:text-white text-center">{current.text}</h2>
                <div className="mt-4 text-blue-500 font-mono">{current.phonetic}</div>
                <div className="absolute bottom-8 text-xs text-slate-400 animate-pulse">Tap to flip</div>
             </div>

             {/* Back */}
             <div className="absolute inset-0 backface-hidden holo-card rounded-[2.5rem] flex flex-col items-center justify-center p-8 shadow-2xl border-white/50 rotate-y-180" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest absolute top-8">Meaning</span>
                <h3 className="text-3xl font-bold text-slate-700 dark:text-slate-200 text-center mb-6">{current.translation}</h3>
                <div className="bg-white/40 dark:bg-black/20 p-4 rounded-xl text-sm italic text-slate-600 dark:text-slate-400 text-center">
                  "{current.example}"
                </div>
             </div>
          </div>
       </div>

       {/* Controls */}
       <div className={`mt-8 grid grid-cols-3 gap-4 transition-opacity duration-300 ${flipped ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <button onClick={() => handleRate('hard')} className="p-4 rounded-2xl bg-red-100 text-red-600 font-bold border border-red-200 shadow-sm active:scale-95">Hard</button>
          <button onClick={() => handleRate('good')} className="p-4 rounded-2xl bg-blue-100 text-blue-600 font-bold border border-blue-200 shadow-sm active:scale-95">Good</button>
          <button onClick={() => handleRate('easy')} className="p-4 rounded-2xl bg-green-100 text-green-600 font-bold border border-green-200 shadow-sm active:scale-95">Easy</button>
       </div>
    </div>
  );
};

export default FlashcardRunPage;
