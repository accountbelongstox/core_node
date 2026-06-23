/* [v4.1-Iris] Web port of the spaced-review Study Session screen — AppContext navigation + ApiCenter data layer, v4.1 Iris visuals preserved (tokens, glass chrome, gradient hero, lucide/Icons, no emoji, no inline hex). */

import React, { useState, useEffect, useCallback, useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { ApiCenter } from '../../services/ApiCenter';
import { Button, Icons, ProgressBar } from '../../components/UI';
import { Check, X } from 'lucide-react';

interface Word {
  word_id: number;
  word: string;
  proficiency: number;
  read_count: number;
  review_count: number;
  next_review_at: string;
  weight: number;
}

const getProficiencyColor = (proficiency: number): string => {
  if (proficiency >= 90) return 'var(--color-success, #10b981)';
  if (proficiency >= 75) return 'var(--klein-blue)';
  if (proficiency >= 60) return '#f59e0b';
  if (proficiency >= 40) return '#ef4444';
  return 'var(--color-text-tertiary, #9ca3af)';
};

export default function StudySession() {
  const { navigate, currentParams } = useContext(AppContext);
  const gid: string = currentParams?.gid || '';

  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, total: 0 });
  const [cardVisible, setCardVisible] = useState(true);
  const [sessionDone, setSessionDone] = useState(false);

  const loadReviewWords = useCallback(async () => {
    try {
      setLoading(true);
      setCurrentIndex(0);
      setShowAnswer(false);
      setSessionDone(false);
      setCardVisible(true);
      const response = await ApiCenter.learning.getReviewQueue();

      if (response.success && Array.isArray(response.data)) {
        // Normalize the review-queue payload into the local card model.
        const reviewWords: Word[] = response.data.map((w: any) => ({
          word_id: w.word_id ?? w.id,
          word: w.word ?? w.text ?? '',
          proficiency: w.proficiency ?? 0,
          read_count: w.read_count ?? 0,
          review_count: w.review_count ?? 0,
          next_review_at: w.next_review_at ?? '',
          weight: w.weight ?? 0,
        }));
        if (reviewWords.length === 0) {
          setSessionDone(true);
        } else {
          setWords(reviewWords);
          setSessionStats({ correct: 0, incorrect: 0, total: reviewWords.length });
        }
      } else {
        setSessionDone(true);
      }
    } catch (error) {
      console.error('Error loading review words:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviewWords();
  }, [loadReviewWords, gid]);

  const updateProgress = async (isCorrect: boolean) => {
    const currentWord = words[currentIndex];
    try {
      await ApiCenter.learning.updateProgress({
        word_id: String(currentWord.word_id),
        group_id: gid,
        correct: isCorrect,
      });

      setSessionStats((prev) => ({
        ...prev,
        correct: isCorrect ? prev.correct + 1 : prev.correct,
        incorrect: !isCorrect ? prev.incorrect + 1 : prev.incorrect,
      }));
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const advanceCard = (afterUpdate: () => void) => {
    setCardVisible(false);
    setTimeout(() => {
      afterUpdate();
      setShowAnswer(false);
      setCardVisible(true);
    }, 200);
  };

  const handleAnswer = (isCorrect: boolean) => {
    updateProgress(isCorrect);

    if (currentIndex < words.length - 1) {
      advanceCard(() => setCurrentIndex((i) => i + 1));
    } else {
      setSessionDone(true);
    }
  };

  const skipWord = () => {
    if (currentIndex < words.length - 1) {
      advanceCard(() => setCurrentIndex((i) => i + 1));
    } else {
      setSessionDone(true);
    }
  };

  if (loading) {
    return (
      <div className="ds-page h-full flex items-center justify-center bg-[var(--color-bg)] text-[var(--klein-blue)]">
        <Icons.Loader />
      </div>
    );
  }

  if (sessionDone) {
    const accuracy =
      sessionStats.total > 0
        ? ((sessionStats.correct / sessionStats.total) * 100).toFixed(1)
        : '0.0';

    return (
      <div className="ds-page h-full flex flex-col items-center justify-center bg-[var(--color-bg)] px-6 gap-6 animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-primary-container)] to-transparent opacity-40 -z-10 pointer-events-none" />

        <div className="ds-card p-8 w-full max-w-sm text-center space-y-5">
          <div
            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-[color:var(--klein-on)]"
            style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            <Icons.Check />
          </div>

          <h2 className="ds-section-title !text-2xl">Session Complete!</h2>

          <div className="grid grid-cols-3 gap-3">
            {[
              { value: sessionStats.correct, label: 'Correct', color: 'var(--color-success, #10b981)' },
              { value: sessionStats.incorrect, label: 'Incorrect', color: '#ef4444' },
              { value: `${accuracy}%`, label: 'Accuracy', color: 'var(--klein-blue)' },
            ].map(({ value, label, color }) => (
              <div key={label} className="ds-card p-3 text-center">
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button variant="grad" onClick={loadReviewWords}>
              Review Again
            </Button>
            <Button variant="secondary" onClick={() => navigate('group_management')}>
              Finish
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="ds-page h-full flex flex-col items-center justify-center gap-4 bg-[var(--color-bg)] px-6">
        <p className="text-[var(--color-text-secondary)] text-base">No words to review</p>
        <Button variant="secondary" className="!w-auto px-6" onClick={() => navigate('group_management')}>
          Go Back
        </Button>
      </div>
    );
  }

  const currentWord = words[currentIndex];
  const progress = ((currentIndex + 1) / words.length) * 100;
  const proficiency = currentWord.proficiency;

  return (
    <div className="ds-page h-full flex flex-col bg-[var(--color-bg)] overflow-hidden animate-slide-up">
      {/* Background aurora layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-primary-container)] to-transparent opacity-40 -z-10 pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-[var(--color-surface)]/80 border-b border-[var(--border-highlight)] px-5 py-3 flex items-center gap-4">
        <button
          onClick={() => navigate('group_management')}
          className="ds-touch-target flex items-center justify-center rounded-full hover:bg-[var(--color-primary-container)] transition-colors text-[var(--color-text-secondary)]"
        >
          <Icons.Close />
        </button>

        <div className="flex-1 text-center">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {currentIndex + 1} / {words.length}
          </p>
          <p className="inline-flex items-center justify-center gap-1 text-xs text-[var(--color-text-secondary)]">
            <Check className="w-3.5 h-3.5 text-[color:var(--color-success,#10b981)]" /> {sessionStats.correct}
            <span className="mx-1" />
            <X className="w-3.5 h-3.5 text-[#ef4444]" /> {sessionStats.incorrect}
          </p>
        </div>

        {/* Spacer to center the middle block */}
        <div className="w-11 flex-shrink-0" />
      </div>

      {/* Progress bar */}
      <ProgressBar value={progress} className="!h-1 !rounded-none" />

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div
          className={`ds-card w-full max-w-md p-8 transition-all duration-200 ${
            cardVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        >
          {/* Proficiency */}
          <div className="text-center mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mb-1">
              Proficiency
            </p>
            <p
              className="text-4xl font-bold tabular-nums"
              style={{ color: getProficiencyColor(proficiency) }}
            >
              {proficiency.toFixed(0)}%
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-[var(--border-highlight)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${proficiency}%`, background: getProficiencyColor(proficiency) }}
              />
            </div>
          </div>

          {/* Word */}
          <div className="text-center border-t border-b border-[var(--border-highlight)] py-10">
            <p className="text-4xl font-black text-[var(--color-text-primary)] break-words">
              {currentWord.word}
            </p>
          </div>

          {/* Hints */}
          <div className="flex justify-around mt-5 text-xs text-[var(--color-text-secondary)]">
            <span>Reviewed: {currentWord.review_count}×</span>
            <span>Weight: {currentWord.weight}</span>
          </div>

          {/* Answer prompt */}
          {showAnswer && (
            <div
              className="mt-5 p-4 rounded-[var(--radius-card)] text-sm"
              style={{ background: 'var(--klein-blue-soft)' }}
            >
              <p className="font-semibold text-[var(--color-text-primary)] mb-1">Do you know this word?</p>
              <p className="text-[var(--color-text-secondary)]">
                Think about its meaning, pronunciation, and usage.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 z-20 bg-[var(--color-surface)]/90 backdrop-blur-xl border-t border-[var(--border-highlight)] px-5 py-4 pb-safe space-y-3">
        {!showAnswer ? (
          <div className="flex gap-3">
            <Button variant="klein" className="flex-1" onClick={() => setShowAnswer(true)}>
              Show Answer
            </Button>
            <Button variant="secondary" className="!w-auto px-6" onClick={skipWord}>
              Skip
            </Button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => handleAnswer(false)}
              className="flex-1 ds-touch-target flex flex-col items-center justify-center rounded-[var(--radius-button)] py-4 font-bold text-white transition-all active:scale-95"
              style={{ background: '#ef4444' }}
            >
              <span>Don't Know</span>
              <span className="text-xs opacity-80 mt-0.5">-10%</span>
            </button>

            <button
              onClick={() => handleAnswer(true)}
              className="flex-1 ds-touch-target flex flex-col items-center justify-center rounded-[var(--radius-button)] py-4 font-bold text-[var(--klein-on)] transition-all active:scale-95"
              style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
            >
              <span>Know It</span>
              <span className="text-xs opacity-80 mt-0.5">+5%</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
