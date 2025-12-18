import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Card } from '../../components/UI';
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
      const result = await ApiCenter.words.getReviewStats();
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to load review stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24 flex items-center justify-center">
        <Card className="mx-6 max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center p-8">
          <Icons.Lock />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-4 mb-2">
            {t('home.loginRequired')}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {t('home.accountRequired')}
          </p>
          <button
            onClick={() => navigate('login')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            {t('auth.login')}
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-8 max-w-md mx-auto">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Review Center
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Keep your vocabulary fresh with spaced repetition
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6">
        {/* Review Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-none shadow-lg">
            <div className="flex flex-col items-center text-center">
              <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-100 text-sm">Due Today</p>
              <p className="text-4xl font-bold mt-1">{stats.due_today}</p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none shadow-lg">
            <div className="flex flex-col items-center text-center">
              <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-orange-100 text-sm">This Week</p>
              <p className="text-4xl font-bold mt-1">{stats.due_this_week}</p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg">
            <div className="flex flex-col items-center text-center">
              <Icons.Sparkles />
              <p className="text-blue-100 text-sm mt-2">Learning</p>
              <p className="text-4xl font-bold mt-1">{stats.learning}</p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none shadow-lg">
            <div className="flex flex-col items-center text-center">
              <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-100 text-sm">Mastered</p>
              <p className="text-4xl font-bold mt-1">{stats.mastered}</p>
            </div>
          </Card>
        </div>

        {/* Review Options */}
        <div className="space-y-4">
          {stats.due_today > 0 && (
            <Card
              onClick={() => navigate('flashcards/run?reviewMode=due')}
              className="bg-gradient-to-r from-red-500 to-red-600 text-white border-none shadow-xl cursor-pointer hover:scale-[1.02] transition-transform"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">Review Due Cards</h3>
                    <p className="text-red-100 text-sm">{stats.due_today} cards waiting</p>
                  </div>
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          )}

          <Card
            onClick={() => navigate('flashcards/run?reviewMode=all')}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center text-white">
                  <Icons.Sparkles />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Practice All Cards</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">Review any cards you want</p>
                </div>
              </div>
              <Icons.ChevronRight />
            </div>
          </Card>

          <Card
            onClick={() => navigate('flashcards/run?reviewMode=mastered')}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center text-white">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Mastered Words</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">{stats.mastered} words mastered</p>
                </div>
              </div>
              <Icons.ChevronRight />
            </div>
          </Card>

          <Card
            onClick={() => navigate('quiz/run')}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Take a Quiz</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">Test your knowledge</p>
                </div>
              </div>
              <Icons.ChevronRight />
            </div>
          </Card>
        </div>

        {/* Empty State */}
        {!loading && stats.due_today === 0 && stats.learning === 0 && (
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center p-8">
            <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-2">All Caught Up!</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              No cards due for review right now. Great job!
            </p>
            <button
              onClick={() => navigate('learn/library')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              Add More Content
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
