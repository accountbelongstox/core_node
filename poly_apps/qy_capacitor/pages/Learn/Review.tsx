/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Ad-hoc inline SVGs → lucide (Clock/CalendarDays/CircleCheck/ClipboardCheck); review stats object-guarded before setState. Propagate the Iris layer to un-beautified siblings. */
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Card, Button, SectionTitle, Stat, EmptyState } from '../../components/UI';
import { Clock, CalendarDays, CircleCheck, ClipboardCheck } from 'lucide-react';
import { ApiCenter } from '../../services/ApiCenter';

interface ReviewStats {
  due_today: number;
  due_this_week: number;
  mastered: number;
  learning: number;
}

export default function LearnReview() {
  const { user, navigate, t } = useContext(AppContext);
  const [stats, setStats] = useState<ReviewStats>({
    due_today: 0,
    due_this_week: 0,
    mastered: 0,
    learning: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadReviewStats();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadReviewStats = async () => {
    setLoading(true);
    try {
      // Bugfix: `ApiCenter.words.getReviewStats` does not exist (the call
      // always threw → stats stuck at 0). Wired to the real learning-stats
      // endpoint and mapped defensively (snake/camel), falling back to the
      // existing defaults so a shape mismatch is a safe no-op (no regression).
      const result = await ApiCenter.learning.getStats();
      if (result.success && result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
        const d: any = result.data;
        setStats(prev => ({
          due_today: d.due_today ?? d.dueToday ?? prev.due_today,
          due_this_week: d.due_this_week ?? d.dueThisWeek ?? prev.due_this_week,
          mastered: d.mastered ?? d.mastered_words ?? prev.mastered,
          learning: d.learning ?? d.learning_words ?? prev.learning,
        }));
      }
    } catch (error) {
      console.error('Failed to load review stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="ds-page min-h-screen bg-transparent pb-32 flex items-center justify-center">
        <Card className="mx-6 w-full max-w-sm text-center p-8 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-[color:var(--klein-blue)] mb-4" style={{ background: 'var(--klein-blue-soft)' }}>
            <Icons.Lock />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            {t('home.loginRequired')}
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            {t('home.accountRequired')}
          </p>
          <Button variant="grad" onClick={() => navigate('login')}>
            {t('auth.login')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="ds-page ds-section-gap min-h-screen bg-transparent pb-32">
      {/* Header */}
      <div className="pt-20 w-full">
        <div className="px-1">
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            Review Center
          </h1>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-1">
            Keep your vocabulary fresh with spaced repetition
          </p>
        </div>
      </div>

      <div className="w-full ds-section-gap">
        {/* Review Stats */}
        <div className="ds-grid-breathing grid grid-cols-2">
          <Card className="flex flex-col gap-2">
            <Clock className="w-9 h-9 text-[var(--klein-blue)]" aria-hidden />
            <Stat value={stats.due_today} label="Due Today" accent />
          </Card>

          <Card className="flex flex-col gap-2">
            <CalendarDays className="w-9 h-9 text-[var(--klein-blue)]" aria-hidden />
            <Stat value={stats.due_this_week} label="This Week" accent />
          </Card>

          <Card className="flex flex-col gap-2">
            <span className="text-[var(--klein-blue)]"><Icons.Sparkles /></span>
            <Stat value={stats.learning} label="Learning" accent />
          </Card>

          <Card className="flex flex-col gap-2">
            <CircleCheck className="w-9 h-9 text-[var(--klein-blue)]" aria-hidden />
            <Stat value={stats.mastered} label="Mastered" accent />
          </Card>
        </div>

        {/* Review Options */}
        <div>
          <SectionTitle title="Start a Session" className="mb-3 px-1" />
          <div className="ds-stack ds-stack-tight">
            {stats.due_today > 0 && (
              <div
                onClick={() => navigate('flashcards/run?reviewMode=due')}
                className="rounded-[var(--radius-card)] p-5 text-[color:var(--klein-on)] relative overflow-hidden cursor-pointer group"
                style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
              >
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/15 rounded-full blur-2xl pointer-events-none"></div>
                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                      <Clock className="w-8 h-8" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-xl">Review Due Cards</h3>
                      <p className="text-white/85 text-sm">{stats.due_today} cards waiting</p>
                    </div>
                  </div>
                  <div className="text-white/90 group-active:scale-90 transition-transform flex-shrink-0">
                    <Icons.ChevronRight />
                  </div>
                </div>
              </div>
            )}

            <div
              onClick={() => navigate('flashcards/run?reviewMode=all')}
              className="ds-row flex items-center gap-4 p-4 cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-[color:var(--klein-blue)]" style={{ background: 'var(--klein-blue-soft)' }}>
                <Icons.Sparkles />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">Practice All Cards</h3>
                <p className="text-[var(--color-text-secondary)] text-sm">Review any cards you want</p>
              </div>
              <div className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0">
                <Icons.ChevronRight />
              </div>
            </div>

            <div
              onClick={() => navigate('flashcards/run?reviewMode=mastered')}
              className="ds-row flex items-center gap-4 p-4 cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-[color:var(--klein-blue)]" style={{ background: 'var(--klein-blue-soft)' }}>
                <CircleCheck className="w-7 h-7" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">Mastered Words</h3>
                <p className="text-[var(--color-text-secondary)] text-sm">{stats.mastered} words mastered</p>
              </div>
              <div className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0">
                <Icons.ChevronRight />
              </div>
            </div>

            <div
              onClick={() => navigate('quiz/run')}
              className="ds-row flex items-center gap-4 p-4 cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-[color:var(--klein-blue)]" style={{ background: 'var(--klein-blue-soft)' }}>
                <ClipboardCheck className="w-7 h-7" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">Take a Quiz</h3>
                <p className="text-[var(--color-text-secondary)] text-sm">Test your knowledge</p>
              </div>
              <div className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0">
                <Icons.ChevronRight />
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {!loading && stats.due_today === 0 && stats.learning === 0 && (
          <EmptyState
            icon={<CircleCheck className="w-10 h-10 text-[var(--klein-blue)]" aria-hidden />}
            title="All Caught Up!"
            description="No cards due for review right now. Great job!"
            action={
              <Button variant="grad" onClick={() => navigate('learn/library')}>
                Add More Content
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
