/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Button, BackButton, LoadingState } from '../../components/UI';
import { PartyPopper } from 'lucide-react';
import { ApiCenter } from '../../services/ApiCenter';
import { Word } from '../../types';
import { LearningProgressTracker } from '../../services/LearningProgressTracker';

const FlashcardRunPage = () => {
  const { navigate, settings, currentParams, t } = useContext(AppContext);
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
      if (response.success && Array.isArray(response.data)) {
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

  if (!current) return (
    <div className="ds-page h-full flex items-center justify-center">
      <LoadingState label={t('flashcards.flipCard') || 'Loading'} />
    </div>
  );

  if (finished) return (
    <div className="ds-page h-full flex flex-col items-center justify-center p-8 animate-fade-in text-center">
       <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-8 text-[var(--klein-on)]"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
       >
          <PartyPopper className="w-12 h-12" />
       </div>
       <h2 className="text-3xl font-black tracking-tight text-[var(--color-text-primary)] mb-2">{t('flashcards.sessionComplete')}</h2>
       <p className="text-[var(--color-text-secondary)] mb-8">{t('flashcards.reviewedCards', { count: words.length })}</p>
       <Button variant="grad" className="!w-auto px-10" onClick={() => navigate('home')}>{t('flashcards.backHome')}</Button>
    </div>
  );

  return (
    <div className="ds-page h-full flex flex-col p-6 pt-safe pb-32 relative">
       {/* Progress */}
       <div className="flex items-center justify-between mb-8 z-10">
          <BackButton onClick={() => navigate('home')} />
          <div className="px-4 py-1.5 rounded-full ds-glass ds-glass-edge text-xs font-bold text-[var(--color-text-secondary)]">
             {index + 1} <span className="text-[var(--color-text-tertiary)] mx-1">/</span> {words.length}
          </div>
          <span className="ds-touch-target opacity-0 pointer-events-none"><Icons.Settings /></span>
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
             <div className="absolute inset-0 backface-hidden ds-card rounded-[var(--radius-card)] flex flex-col items-center justify-center p-8">
                <span className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest absolute top-8">{t('flashcards.word')}</span>
                <h2 className="text-5xl font-black text-[var(--color-text-primary)] text-center">{current.text}</h2>
                <div className="mt-4 text-[var(--klein-blue)] font-mono">{current.phonetic}</div>
                <div className="absolute bottom-8 text-xs text-[var(--color-text-tertiary)] animate-pulse">{t('flashcards.flipCard')}</div>
             </div>

             {/* Back */}
             <div className="absolute inset-0 backface-hidden ds-card rounded-[var(--radius-card)] flex flex-col items-center justify-center p-8 rotate-y-180" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}>
                <span className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest absolute top-8">{t('flashcards.meaning')}</span>
                <h3 className="text-3xl font-bold text-[var(--color-text-primary)] text-center mb-6">{current.translation}</h3>
                <div className="bg-[var(--klein-blue-soft)] p-4 rounded-2xl text-sm italic text-[var(--color-text-secondary)] text-center">
                  "{current.example}"
                </div>
             </div>
          </div>
       </div>

       {/* Controls */}
       <div className={`mt-8 grid grid-cols-3 gap-3 transition-opacity duration-300 ${flipped ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <button onClick={() => handleRate('hard')} className="ds-touch-target min-h-[52px] rounded-[var(--radius-button)] bg-red-500/10 text-red-500 font-bold border border-red-500/30 active:scale-95 transition-transform">{t('flashcards.hard')}</button>
          <button onClick={() => handleRate('good')} className="ds-touch-target min-h-[52px] rounded-[var(--radius-button)] font-bold active:scale-95 transition-transform text-[var(--klein-blue)] bg-[var(--klein-blue-soft)] border border-[var(--klein-ring)]">{t('flashcards.good')}</button>
          <button onClick={() => handleRate('easy')} className="ds-touch-target min-h-[52px] rounded-[var(--radius-button)] bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/30 active:scale-95 transition-transform">{t('flashcards.easy')}</button>
       </div>
    </div>
  );
};

export default FlashcardRunPage;
