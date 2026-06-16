/* [v4.1-Iris] Study Session (immersive / fullscreen) — ported from
 * qy_capacitor/pages/Learning/StudySession.tsx. Self-contained spaced-review
 * runner: prefers wordflowApi.getReviewQueue(), falls back to
 * getWordsForGroup(gid) when a gid is supplied and the queue is empty, and
 * reports each answer through updateLearningProgress(). No bottom chrome —
 * fullscreen route; back/finish navigate via wfPath(). Faithful Iris look. */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Lock, X } from 'lucide-react';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { Button, EmptyState, Icons, LoadingState, ProgressBar } from '../WfUI';

interface StudyWord {
  word_id: number | string;
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

const normalizeWords = (list: any[]): StudyWord[] =>
  list.map((w: any) => ({
    word_id: w.word_id ?? w.id,
    word: w.word ?? w.text ?? '',
    proficiency: w.proficiency ?? w.masteryLevel ?? 0,
    read_count: w.read_count ?? 0,
    review_count: w.review_count ?? 0,
    next_review_at: w.next_review_at ?? '',
    weight: w.weight ?? 0,
  }));

const WfLearningStudySessionPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, t } = useWfApp();
  const [searchParams] = useSearchParams();
  const gid = searchParams.get('gid') || '';

  const [words, setWords] = useState<StudyWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, total: 0 });
  const [cardVisible, setCardVisible] = useState(true);
  const [sessionDone, setSessionDone] = useState(false);

  const exit = () => navigate(wfPath('group_management'));

  const loadReviewWords = useCallback(async () => {
    setLoading(true);
    setCurrentIndex(0);
    setShowAnswer(false);
    setSessionDone(false);
    setCardVisible(true);
    try {
      // Review queue first; fall back to the group's words when a gid is
      // supplied and the queue is empty.
      let list: any[] = [];
      const queue = await wordflowApi.getReviewQueue();
      if (Array.isArray(queue) && queue.length > 0) {
        list = queue;
      } else if (gid) {
        try {
          const groupWords = await wordflowApi.getWordsForGroup(gid);
          if (Array.isArray(groupWords)) list = groupWords;
        } catch (error) {
          console.error('[WfStudySession] Failed to load group words:', error);
        }
      }

      const reviewWords = normalizeWords(list);
      if (reviewWords.length === 0) {
        setWords([]);
        setSessionDone(true);
      } else {
        setWords(reviewWords);
        setSessionStats({ correct: 0, incorrect: 0, total: reviewWords.length });
      }
    } catch (error) {
      console.error('[WfStudySession] Failed to load review words:', error);
      setWords([]);
      setSessionDone(true);
    } finally {
      setLoading(false);
    }
  }, [gid]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    loadReviewWords();
  }, [isAuthenticated, loadReviewWords]);

  const updateProgress = async (isCorrect: boolean) => {
    const currentWord = words[currentIndex];
    if (!currentWord) return;
    try {
      await wordflowApi.updateLearningProgress({
        word_id: String(currentWord.word_id),
        group_id: gid || undefined,
        correct: isCorrect,
      });
    } catch (error) {
      console.error('[WfStudySession] Failed to update progress:', error);
    }
    setSessionStats((prev) => ({
      ...prev,
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      incorrect: !isCorrect ? prev.incorrect + 1 : prev.incorrect,
    }));
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

  if (!isAuthenticated) {
    return (
      <div className="ds-page h-full flex flex-col items-center justify-center p-8">
        <EmptyState
          icon={<Lock strokeWidth={1.5} />}
          title={t('settings.loginRequired') || 'Login Required'}
          description={t('home.syncProgressDescription') || 'Login to review your words.'}
          action={
            <Button variant="grad" className="!w-auto px-8" onClick={() => navigate(wfPath('auth/login'))}>
              {t('auth.login') || 'Login'}
            </Button>
          }
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ds-page h-full flex items-center justify-center">
        <LoadingState label={t('common.loading') || 'Loading…'} />
      </div>
    );
  }

  if (sessionDone) {
    const accuracy =
      sessionStats.total > 0
        ? ((sessionStats.correct / sessionStats.total) * 100).toFixed(1)
        : '0.0';

    return (
      <div className="ds-page h-full flex flex-col items-center justify-center px-6 gap-6 animate-fade-in">
        <div className="ds-card rounded-[var(--radius-card)] p-8 w-full max-w-sm text-center space-y-5">
          <div
            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-[color:var(--klein-on)]"
            style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            <Icons.Check />
          </div>

          <h2 className="ds-section-title !text-2xl">
            {t('flashcards.sessionComplete') || 'Session Complete!'}
          </h2>

          <div className="grid grid-cols-3 gap-3">
            {[
              { value: sessionStats.correct, label: t('learning.correct') || 'Correct', color: 'var(--color-success, #10b981)' },
              { value: sessionStats.incorrect, label: t('learning.incorrect') || 'Incorrect', color: '#ef4444' },
              { value: `${accuracy}%`, label: t('stats.accuracy') || 'Accuracy', color: 'var(--klein-blue)' },
            ].map(({ value, label, color }) => (
              <div key={label} className="ds-card rounded-[var(--radius-card)] p-3 text-center">
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button variant="grad" onClick={loadReviewWords}>
              {t('learning.reviewAgain') || 'Review Again'}
            </Button>
            <Button variant="secondary" onClick={exit}>
              {t('learning.finish') || 'Finish'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="ds-page h-full flex flex-col items-center justify-center gap-4 px-6">
        <EmptyState
          icon={<Icons.Sparkles />}
          title={t('learning.noWordsToReview') || 'No words to review'}
        />
        <Button variant="secondary" className="!w-auto px-6" onClick={exit}>
          {t('common.back') || 'Back'}
        </Button>
      </div>
    );
  }

  const currentWord = words[currentIndex];
  const progress = ((currentIndex + 1) / words.length) * 100;
  const proficiency = currentWord.proficiency;

  return (
    <div className="ds-page h-full flex flex-col overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="sticky top-0 ds-z-sticky backdrop-blur-md bg-[var(--color-surface)]/80 border-b border-[var(--border-highlight)] px-5 py-3 flex items-center gap-4">
        <button
          type="button"
          onClick={exit}
          className="ds-touch-target flex items-center justify-center rounded-full hover:bg-[var(--color-primary-container)] transition-colors text-[var(--color-text-secondary)]"
          aria-label={t('common.close') || 'Close'}
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
          className={`ds-card rounded-[var(--radius-card)] w-full max-w-md p-8 transition-all duration-200 ${
            cardVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        >
          {/* Proficiency */}
          <div className="text-center mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mb-1">
              {t('learning.proficiency') || 'Proficiency'}
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
            <span>{t('learning.reviewed') || 'Reviewed'}: {currentWord.review_count}×</span>
            <span>{t('learning.weight') || 'Weight'}: {currentWord.weight}</span>
          </div>

          {/* Answer prompt */}
          {showAnswer && (
            <div
              className="mt-5 p-4 rounded-[var(--radius-card)] text-sm"
              style={{ background: 'var(--klein-blue-soft)' }}
            >
              <p className="font-semibold text-[var(--color-text-primary)] mb-1">
                {t('learning.doYouKnow') || 'Do you know this word?'}
              </p>
              <p className="text-[var(--color-text-secondary)]">
                {t('learning.doYouKnowHint') || 'Think about its meaning, pronunciation, and usage.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 ds-z-sticky bg-[var(--color-surface)]/90 backdrop-blur-xl border-t border-[var(--border-highlight)] px-5 py-4 pb-safe space-y-3">
        {!showAnswer ? (
          <div className="flex gap-3">
            <Button variant="klein" className="flex-1" onClick={() => setShowAnswer(true)}>
              {t('learning.showAnswer') || 'Show Answer'}
            </Button>
            <Button variant="secondary" className="!w-auto px-6" onClick={skipWord}>
              {t('learning.skip') || 'Skip'}
            </Button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleAnswer(false)}
              className="flex-1 ds-touch-target flex flex-col items-center justify-center rounded-[var(--radius-button)] py-4 font-bold text-white transition-all active:scale-95"
              style={{ background: '#ef4444' }}
            >
              <span>{t('flashcards.dontKnow') || "Don't Know"}</span>
              <span className="text-xs opacity-80 mt-0.5">-10%</span>
            </button>

            <button
              type="button"
              onClick={() => handleAnswer(true)}
              className="flex-1 ds-touch-target flex flex-col items-center justify-center rounded-[var(--radius-button)] py-4 font-bold text-[var(--klein-on)] transition-all active:scale-95"
              style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
            >
              <span>{t('flashcards.knowIt') || 'Know It'}</span>
              <span className="text-xs opacity-80 mt-0.5">+5%</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WfLearningStudySessionPage;
