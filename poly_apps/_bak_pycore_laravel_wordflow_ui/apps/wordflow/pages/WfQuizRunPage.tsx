/* [v4.1-Iris] Quiz Run (immersive / fullscreen) — ported from
 * qy_capacitor/pages/Quiz/Run.tsx. Self-contained: loads a quiz session via
 * wordflowApi.getQuizSession(), runs a 15s-per-question timed multiple-choice
 * round with score + progress, then a trophy game-over screen. No bottom chrome
 * — fullscreen runner. Closes back to the learn home via wfPath(). API call is
 * try/caught with a LoadingState fallback; never crashes. Faithful Iris look. */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { Button, BackButton, ProgressBar, LoadingState, EmptyState, Icons } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfApp, useWfT } from '../WfAppContext';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { wfQuizHistoryCenter } from '../services/WfQuizHistoryCenter';
import type { QuizQuestion } from '../../../core/api-libs/wordflow/wordflowTypes';

const QUESTION_SECONDS = 15;

const WfQuizRunPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfT();
  const { isAuthenticated } = useWfApp();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('groupId') || undefined;

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [gameOver, setGameOver] = useState(false);

  const exit = () => navigate(wfPath('learn/home'));

  // Load the quiz session once on mount (after an auth guard, as the original did).
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(wfPath('auth/login'));
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await wordflowApi.getQuizSession();
        if (!cancelled) setQuestions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('[WfQuizRun] Failed to load quiz session:', err);
        if (!cancelled) setQuestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextQuestion = () => {
    setCurrentIndex((prev) => {
      if (prev < questions.length - 1) {
        setSelectedOption(null);
        setTimeLeft(QUESTION_SECONDS);
        return prev + 1;
      }
      setGameOver(true);
      return prev;
    });
  };

  const handleSelect = (optionId: string, correct: boolean) => {
    if (selectedOption) return;
    setSelectedOption(optionId);
    if (correct) setScore((s) => s + 10);
    setTimeout(nextQuestion, 1200);
  };

  const handleTimeOut = () => {
    if (selectedOption) return;
    setSelectedOption('timeout');
    setTimeout(nextQuestion, 1500);
  };

  // Per-question countdown timer.
  useEffect(() => {
    if (loading || gameOver || selectedOption || questions.length === 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, gameOver, selectedOption, currentIndex, questions]);

  // Record the finished round to quiz history — fire-and-forget, failures only log.
  useEffect(() => {
    if (!gameOver || questions.length === 0) return;
    const total = questions.length;
    const correct = Math.round(score / 10); // +10 per correct answer
    const accuracy = total > 0 ? (correct / total) * 100 : 0; // percent, center convention
    wfQuizHistoryCenter
      .add({ score, total, accuracy, groupId, mode: 'quiz' })
      .catch((e) => console.error('[WfQuizRun] Failed to record quiz history:', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  if (loading) {
    return (
      <div className="ds-page h-full flex items-center justify-center">
        <LoadingState label={t('quiz.loadingQuiz') || 'Loading quiz…'} />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="ds-page h-full flex flex-col items-center justify-center p-8">
        <EmptyState
          icon={<Icons.Book />}
          title={t('quiz.empty') || 'No quiz available'}
          description={t('quiz.emptyHint') || 'There are no quiz questions to play right now. Try again later.'}
          action={
            <Button variant="grad" className="!w-auto px-8" onClick={exit}>
              {t('quiz.backHome') || 'Back Home'}
            </Button>
          }
        />
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="ds-page h-full flex flex-col items-center justify-center p-8 animate-fade-in text-center">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-8 text-[var(--klein-on)]"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <Trophy className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-[var(--color-text-primary)] mb-2">
          {t('quiz.quizComplete') || 'Quiz Complete!'}
        </h2>
        <p className="text-[var(--color-text-secondary)] mb-8 text-xl">
          {t('quiz.score') || 'Score:'} <span className="font-bold text-[var(--klein-blue)]">{score}</span>
        </p>
        <Button variant="grad" className="!w-auto px-10" onClick={exit}>
          {t('quiz.backHome') || 'Back Home'}
        </Button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const options = Array.isArray(currentQ.options) ? currentQ.options : [];

  return (
    <div className="ds-page h-full flex flex-col p-6 pt-safe pb-32 relative overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 mb-8 z-10">
        <BackButton onClick={exit} />
        <ProgressBar value={currentIndex} max={questions.length} className="flex-1 !h-2" />
        <div className="font-mono font-bold text-[var(--klein-blue)]">{score}</div>
      </div>

      {/* Timer */}
      <div className="flex justify-center mb-8">
        <div
          className={`w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-xl transition-colors ${
            timeLeft < 5 ? 'border-red-500 text-red-500 animate-pulse' : 'text-[var(--klein-blue)]'
          }`}
          style={timeLeft < 5 ? undefined : { borderColor: 'var(--klein-blue)' }}
        >
          {timeLeft}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col items-center justify-center z-10 mb-8">
        <div className="ds-card p-8 rounded-[var(--radius-card)] w-full text-center">
          <h3 className="text-[var(--color-text-tertiary)] uppercase text-xs font-bold mb-4 tracking-widest">
            {currentQ.type} {t('quiz.question') || 'Question'}
          </h3>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] leading-relaxed">
            {currentQ.question}
          </h2>
        </div>
      </div>

      {/* Options */}
      <div className="grid gap-3 z-10">
        {options.map((opt) => {
          let stateClass =
            'ds-card border border-[var(--border-highlight)] text-[var(--color-text-primary)] hover:border-[var(--klein-ring)]';
          if (selectedOption) {
            if (opt.isCorrect)
              stateClass = 'bg-emerald-500 text-white border border-emerald-600 shadow-[0_8px_24px_rgba(16,185,129,0.3)]';
            else if (selectedOption === opt.id)
              stateClass = 'bg-red-500 text-white border border-red-600 shadow-[0_8px_24px_rgba(239,68,68,0.3)]';
            else
              stateClass = 'ds-card border border-[var(--border-highlight)] text-[var(--color-text-primary)] opacity-40';
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

export default WfQuizRunPage;
