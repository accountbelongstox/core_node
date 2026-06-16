/* [v4.1-Iris] Flashcard Run (immersive / fullscreen) — ported from
 * qy_capacitor/pages/Flashcards/Run.tsx. Self-contained: loads a deck's words via
 * wordflowApi.getWordsForGroup(), shows a 3D flip card, and rates hard/good/easy
 * to advance. Each rating is reported as a learning answer (hard = incorrect,
 * good/easy = correct) through wfLearningStatsCenter.reportAnswer() — same
 * contract as the study-session runner — and the completion screen shows the
 * correct/incorrect/accuracy breakdown. No bottom chrome — fullscreen runner;
 * the completion screen + back button navigate via wfPath(). API call is
 * try/caught with a LoadingState / EmptyState fallback. Faithful Iris look. */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PartyPopper } from 'lucide-react';
import { Icons, Button, BackButton, LoadingState, EmptyState } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfApp, useWfT } from '../WfAppContext';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { wfLearningStatsCenter } from '../services/WfLearningStatsCenter';
import type { Word } from '../../../core/api-libs/wordflow/wordflowTypes';

const WfFlashcardRunPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfT();
  const [searchParams] = useSearchParams();
  const { activeGroupId } = useWfApp();
  // No placeholder 'g1' fallback — fall back to the resolved active group; an
  // empty id means "no active group" and we must NOT call
  // getWordsForGroup('g1') (backend has no such group → error).
  const groupId = searchParams.get('groupId') || searchParams.get('library') || activeGroupId || '';

  const [words, setWords] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });

  const exit = () => navigate(wfPath('learn'));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // No active group → show the empty state, don't hit the API.
      if (!groupId) {
        if (!cancelled) {
          setWords([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const result = await wordflowApi.getWordsForGroup(groupId);
        if (!cancelled) setWords(Array.isArray(result) ? result : []);
      } catch (error) {
        console.error('[WfFlashcardRun] Failed to load words:', error);
        if (!cancelled) setWords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [groupId]);

  const handleRate = (rating: 'hard' | 'good' | 'easy') => {
    // [Learning Progress] Hard = incorrect, Good/Easy = correct — reported the
    // same way as the study-session runner (updateLearningProgress + event).
    const currentCard = words[index];
    if (currentCard) {
      const correct = rating !== 'hard';
      setSessionStats((prev) => ({
        correct: correct ? prev.correct + 1 : prev.correct,
        incorrect: !correct ? prev.incorrect + 1 : prev.incorrect,
      }));
      wfLearningStatsCenter
        .reportAnswer({
          word_id: String(currentCard.id),
          group_id: groupId || undefined,
          correct,
        })
        .catch((error) => {
          console.error('[WfFlashcardRun] Failed to report answer:', error);
        });
    }

    setFlipped(false);
    setTimeout(() => {
      if (index < words.length - 1) {
        setIndex((prev) => prev + 1);
      } else {
        setFinished(true);
      }
    }, 200);
  };

  const current = words[index];

  if (loading) {
    return (
      <div className="ds-page h-full flex items-center justify-center">
        <LoadingState label="Shuffling your deck…" />
      </div>
    );
  }

  if (!current && !finished) {
    return (
      <div className="ds-page h-full flex flex-col items-center justify-center p-8">
        <EmptyState
          icon={<Icons.Sparkles />}
          title={groupId ? 'No cards to review' : (t('library.noGroups') || 'No groups yet')}
          description={
            groupId
              ? 'This deck has no words yet. Pick another deck to begin.'
              : (t('library.noGroupsHint') || 'Import or pick a word group to start reviewing.')
          }
        />
        <button onClick={exit} className="mt-6 text-sm font-bold text-[var(--klein-blue)]">
          Back
        </button>
      </div>
    );
  }

  if (finished) {
    const rated = sessionStats.correct + sessionStats.incorrect;
    const accuracy = rated > 0 ? ((sessionStats.correct / rated) * 100).toFixed(1) : '0.0';
    return (
      <div className="ds-page h-full flex flex-col items-center justify-center p-8 animate-fade-in text-center">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-8 text-[var(--klein-on)]"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <PartyPopper className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-[var(--color-text-primary)] mb-2">
          {t('flashcards.sessionComplete') || 'Session Complete!'}
        </h2>
        <p className="text-[var(--color-text-secondary)] mb-6">
          {t('flashcards.reviewedCards', { count: words.length }) || `You reviewed ${words.length} cards.`}
        </p>

        {/* Session stats — same breakdown as the study-session runner */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm mb-8">
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

        <Button variant="grad" className="!w-auto px-10" onClick={exit}>
          {t('flashcards.backHome') || 'Back Home'}
        </Button>
      </div>
    );
  }

  return (
    <div className="ds-page h-full flex flex-col p-6 pt-safe pb-32 relative">
      {/* Progress */}
      <div className="flex items-center justify-between mb-8 z-10">
        <BackButton onClick={exit} />
        <div className="px-4 py-1.5 rounded-full ds-glass ds-glass-edge text-xs font-bold text-[var(--color-text-secondary)]">
          {index + 1} <span className="text-[var(--color-text-tertiary)] mx-1">/</span> {words.length}
        </div>
        <span className="ds-touch-target opacity-0 pointer-events-none"><Icons.Settings /></span>
      </div>

      {/* 3D card */}
      <div className="flex-1 perspective-1000 relative flex items-center justify-center z-10">
        <div
          className="w-full aspect-[3/4] max-h-[500px] relative transition-transform duration-500 cursor-pointer"
          onClick={() => setFlipped(!flipped)}
          style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 ds-card rounded-[var(--radius-card)] flex flex-col items-center justify-center p-8"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest absolute top-8">{t('flashcards.word') || 'Word'}</span>
            <h2 className="text-5xl font-black text-[var(--color-text-primary)] text-center">{current.text}</h2>
            {current.phonetic && <div className="mt-4 text-[var(--klein-blue)] font-mono">{current.phonetic}</div>}
            <div className="absolute bottom-8 text-xs text-[var(--color-text-tertiary)] animate-pulse">{t('flashcards.flipCard') || 'Tap to flip'}</div>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 ds-card rounded-[var(--radius-card)] flex flex-col items-center justify-center p-8"
            style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
          >
            <span className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest absolute top-8">{t('flashcards.meaning') || 'Meaning'}</span>
            <h3 className="text-3xl font-bold text-[var(--color-text-primary)] text-center mb-6">{current.translation}</h3>
            {current.example && (
              <div className="bg-[var(--klein-blue-soft)] p-4 rounded-2xl text-sm italic text-[var(--color-text-secondary)] text-center">
                &quot;{current.example}&quot;
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className={`mt-8 grid grid-cols-3 gap-3 transition-opacity duration-300 ${flipped ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <button
          onClick={() => handleRate('hard')}
          className="ds-touch-target min-h-[52px] rounded-[var(--radius-button)] bg-red-500/10 text-red-500 font-bold border border-red-500/30 active:scale-95 transition-transform"
        >
          {t('flashcards.hard') || 'Hard'}
        </button>
        <button
          onClick={() => handleRate('good')}
          className="ds-touch-target min-h-[52px] rounded-[var(--radius-button)] font-bold active:scale-95 transition-transform text-[var(--klein-blue)] bg-[var(--klein-blue-soft)] border border-[var(--klein-ring)]"
        >
          {t('flashcards.good') || 'Good'}
        </button>
        <button
          onClick={() => handleRate('easy')}
          className="ds-touch-target min-h-[52px] rounded-[var(--radius-button)] bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/30 active:scale-95 transition-transform"
        >
          {t('flashcards.easy') || 'Easy'}
        </button>
      </div>
    </div>
  );
};

export default WfFlashcardRunPage;
