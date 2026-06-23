/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Button, BackButton, ProgressBar, LoadingState } from '../../components/UI';
import { Trophy } from 'lucide-react';
import { api } from '../../services/api';
import { QuizQuestion } from '../../types';
import { LearningProgressTracker } from '../../services/LearningProgressTracker';

const QuizRunPage = () => {
  // [i18n] Added `t` function for multi-language support
  const { navigate, t, currentParams, user } = useContext(AppContext);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('login');
      return;
    }

    api.getQuizSession().then(data => {
      setQuestions(Array.isArray(data) ? data : []);

      // [Learning Progress] Start learning session
      LearningProgressTracker.startSession(
        currentParams?.groupId,
        currentParams?.language || 'en'
      );
    }).catch(err => {
      console.error('[Quiz] Failed to load quiz session:', err);
    });

    // [Learning Progress] End session on unmount
    return () => {
      LearningProgressTracker.endSession();
    };
  }, []);

  useEffect(() => {
    if (selectedOption || gameOver) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
           handleTimeOut();
           return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedOption, currentIndex, gameOver]);

  const handleTimeOut = () => {
    const currentQ = questions[currentIndex];

    // [Learning Progress] Record timeout as incorrect
    if (currentQ?.wordId) {
      LearningProgressTracker.recordWordReview(
        currentQ.wordId,
        currentQ.question,
        false, // timeout = incorrect
        currentParams?.groupId,
        currentParams?.language || 'en'
      );
    }

    setIsCorrect(false);
    setSelectedOption('timeout');
    setTimeout(nextQuestion, 1500);
  };

  const handleSelect = (optionId: string, correct: boolean) => {
    if (selectedOption) return;

    const currentQ = questions[currentIndex];

    // [Learning Progress] Record answer result
    if (currentQ?.wordId) {
      LearningProgressTracker.recordWordReview(
        currentQ.wordId,
        currentQ.question,
        correct,
        currentParams?.groupId,
        currentParams?.language || 'en'
      );
    }

    setSelectedOption(optionId);
    setIsCorrect(correct);
    if (correct) setScore(s => s + 10);
    setTimeout(nextQuestion, 1200);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(p => p + 1);
      setSelectedOption(null);
      setIsCorrect(null);
      setTimeLeft(15);
    } else {
      // [Learning Progress] End session before game over
      LearningProgressTracker.endSession().then(() => {
        setGameOver(true);
      });
    }
  };

  // [i18n] Replaced hardcoded "Loading Quiz..." with t()
  if (questions.length === 0) return (
    <div className="ds-page h-full flex items-center justify-center">
      <LoadingState label={t('quiz.loadingQuiz')} />
    </div>
  );

  if (gameOver) return (
    <div className="ds-page h-full flex flex-col items-center justify-center p-8 animate-fade-in text-center">
       <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-8 text-[var(--klein-on)]"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
       >
          <Trophy className="w-12 h-12" />
       </div>
       {/* [i18n] Replaced hardcoded "Quiz Complete!" with t() */}
       <h2 className="text-3xl font-black tracking-tight text-[var(--color-text-primary)] mb-2">{t('quiz.quizComplete')}</h2>
       {/* [i18n] Replaced hardcoded "Score:" with t() */}
       <p className="text-[var(--color-text-secondary)] mb-8 text-xl">{t('quiz.score')} <span className="font-bold text-[var(--klein-blue)]">{score}</span></p>
       {/* [i18n] Replaced hardcoded "Back Home" with t() */}
       <Button variant="grad" className="!w-auto px-10" onClick={() => navigate('home')}>{t('quiz.backHome')}</Button>
    </div>
  );

  const currentQ = questions[currentIndex];

  // [Learning Progress] Start tracking current word when index changes
  useEffect(() => {
    if (currentQ?.wordId) {
      LearningProgressTracker.startWordTracking(currentQ.wordId);
    }
  }, [currentIndex, currentQ]);

  return (
    <div className="ds-page h-full flex flex-col p-6 pt-safe pb-32 relative overflow-hidden">
       {/* Top Bar */}
       <div className="flex items-center justify-between gap-4 mb-8 z-10">
          <BackButton onClick={() => navigate('home')} />
          <ProgressBar value={currentIndex} max={questions.length} className="flex-1 !h-2" />
          <div className="font-mono font-bold text-[var(--klein-blue)]">{score}</div>
       </div>

       {/* Timer */}
       <div className="flex justify-center mb-8">
           <div
             className={`w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-xl transition-colors ${timeLeft < 5 ? 'border-red-500 text-red-500 animate-pulse' : 'text-[var(--klein-blue)]'}`}
             style={timeLeft < 5 ? undefined : { borderColor: 'var(--klein-blue)' }}
           >
              {timeLeft}
           </div>
       </div>

       {/* Question */}
       <div className="flex-1 flex flex-col items-center justify-center z-10 mb-8">
           <div className="ds-card p-8 rounded-[var(--radius-card)] w-full text-center">
               {/* [i18n] Replaced hardcoded "Question" with t() */}
               <h3 className="text-[var(--color-text-tertiary)] uppercase text-xs font-bold mb-4 tracking-widest">{currentQ.type} {t('quiz.question')}</h3>
               <h2 className="text-2xl font-bold text-[var(--color-text-primary)] leading-relaxed">{currentQ.question}</h2>
           </div>
       </div>

       {/* Options */}
       <div className="grid gap-3 z-10">
          {(Array.isArray(currentQ.options) ? currentQ.options : []).map(opt => {
             let stateClass = "ds-card border border-[var(--border-highlight)] text-[var(--color-text-primary)] hover:border-[var(--klein-ring)]";
             if (selectedOption) {
                if (opt.isCorrect) stateClass = "bg-emerald-500 text-white border border-emerald-600 shadow-[0_8px_24px_rgba(16,185,129,0.3)]";
                else if (selectedOption === opt.id) stateClass = "bg-red-500 text-white border border-red-600 shadow-[0_8px_24px_rgba(239,68,68,0.3)]";
                else stateClass = "ds-card border border-[var(--border-highlight)] text-[var(--color-text-primary)] opacity-40";
             }

             return (
               <button
                 key={opt.id}
                 onClick={() => handleSelect(opt.id, opt.isCorrect)}
                 className={`ds-touch-target min-h-[56px] p-5 rounded-[var(--radius-button)] font-bold text-lg transition-all duration-300 transform active:scale-[0.98] ${stateClass}`}
               >
                 {opt.text}
               </button>
             );
          })}
       </div>
    </div>
  );
};

export default QuizRunPage;
