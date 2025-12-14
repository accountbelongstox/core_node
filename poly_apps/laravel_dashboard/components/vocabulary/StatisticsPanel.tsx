import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Clock,
  Target,
  Award,
  RefreshCw,
  Download
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { commonClasses } from '../../styles/theme';

interface StatisticsPanelProps {
  userId?: string;
}

interface LearningStats {
  totalWords: number;
  learnedWords: number;
  reviewedWords: number;
  masteredWords: number;
  studyTime: number;
  accuracy: number;
  streak: number;
  dailyGoal: number;
  todayProgress: number;
}

interface ProgressData {
  date: string;
  wordsLearned: number;
  reviewsCompleted: number;
  studyTime: number;
}

const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ userId }) => {
  const [stats, setStats] = useState<LearningStats>({
    totalWords: 0,
    learnedWords: 0,
    reviewedWords: 0,
    masteredWords: 0,
    studyTime: 0,
    accuracy: 0,
    streak: 0,
    dailyGoal: 20,
    todayProgress: 0
  });
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');

  useEffect(() => {
    loadStatistics();
  }, [userId, timeRange]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      // Mock data - replace with actual API calls
      const mockStats: LearningStats = {
        totalWords: 500,
        learnedWords: 247,
        reviewedWords: 189,
        masteredWords: 132,
        studyTime: 750, // minutes
        accuracy: 87,
        streak: 14,
        dailyGoal: 20,
        todayProgress: 12
      };

      const mockProgress: ProgressData[] = generateMockProgressData(timeRange);

      setStats(mockStats);
      setProgressData(mockProgress);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMockProgressData = (range: 'week' | 'month' | 'year'): ProgressData[] => {
    const days = range === 'week' ? 7 : range === 'month' ? 30 : 365;
    const data: ProgressData[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString().split('T')[0],
        wordsLearned: Math.floor(Math.random() * 25),
        reviewsCompleted: Math.floor(Math.random() * 40),
        studyTime: Math.floor(Math.random() * 60)
      });
    }

    return data;
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const calculateWeeklyChange = (metric: keyof ProgressData): number => {
    if (progressData.length < 7) return 0;
    const lastWeek = progressData.slice(-7);
    const prevWeek = progressData.slice(-14, -7);

    const lastWeekSum = lastWeek.reduce((sum, day) => sum + (day[metric] as number), 0);
    const prevWeekSum = prevWeek.reduce((sum, day) => sum + (day[metric] as number), 0);

    if (prevWeekSum === 0) return 100;
    return Math.round(((lastWeekSum - prevWeekSum) / prevWeekSum) * 100);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Learning Statistics
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track your vocabulary learning progress
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadStatistics}
            disabled={loading}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Words Learned */}
        <div className={`${commonClasses.card} p-6`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Words Learned
            </h3>
            <Target className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.learnedWords}
            </p>
            <p className="text-sm text-gray-500 mb-1">/ {stats.totalWords}</p>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: `${(stats.learnedWords / stats.totalWords) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            +{calculateWeeklyChange('wordsLearned')}% this week
          </p>
        </div>

        {/* Study Time */}
        <div className={`${commonClasses.card} p-6`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Study Time
            </h3>
            <Clock className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatTime(stats.studyTime)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Total time invested</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            +{calculateWeeklyChange('studyTime')}% this week
          </p>
        </div>

        {/* Accuracy */}
        <div className={`${commonClasses.card} p-6`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Accuracy
            </h3>
            <BarChart3 className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.accuracy}%
          </p>
          <p className="text-sm text-gray-500 mt-1">Average accuracy</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            +5% improvement
          </p>
        </div>

        {/* Streak */}
        <div className={`${commonClasses.card} p-6`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Daily Streak
            </h3>
            <Award className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.streak}
          </p>
          <p className="text-sm text-gray-500 mt-1">Consecutive days</p>
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
            Keep it up!
          </p>
        </div>
      </div>

      {/* Daily Goal Progress */}
      <div className={`${commonClasses.card} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Today's Progress
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {stats.todayProgress} / {stats.dailyGoal} words
            </p>
          </div>
          <Calendar className="w-6 h-6 text-indigo-500" />
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-4 rounded-full transition-all flex items-center justify-end pr-2"
            style={{ width: `${Math.min((stats.todayProgress / stats.dailyGoal) * 100, 100)}%` }}
          >
            {stats.todayProgress >= stats.dailyGoal && (
              <span className="text-xs font-semibold text-white">Goal!</span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {stats.dailyGoal - stats.todayProgress > 0
            ? `${stats.dailyGoal - stats.todayProgress} more words to reach your daily goal`
            : 'Daily goal achieved! Great job!'}
        </p>
      </div>

      {/* Progress Chart */}
      <div className={`${commonClasses.card} p-6`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Learning Progress
          </h3>
          <div className="flex gap-2">
            {(['week', 'month', 'year'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm rounded ${
                  timeRange === range
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Simple Bar Chart */}
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-indigo-500 rounded"></div>
              <span>Words Learned</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Reviews Completed</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 h-48">
            {progressData.slice(-7).map((day, index) => {
              const maxValue = Math.max(
                ...progressData.slice(-7).map(d => Math.max(d.wordsLearned, d.reviewsCompleted))
              );
              return (
                <div key={index} className="flex flex-col items-center gap-1">
                  <div className="flex-1 w-full flex flex-col justify-end gap-1">
                    <div
                      className="w-full bg-indigo-500 rounded-t transition-all hover:bg-indigo-600"
                      style={{ height: `${(day.wordsLearned / maxValue) * 100}%` }}
                      title={`Words: ${day.wordsLearned}`}
                    />
                    <div
                      className="w-full bg-green-500 rounded-t transition-all hover:bg-green-600"
                      style={{ height: `${(day.reviewsCompleted / maxValue) * 100}%` }}
                      title={`Reviews: ${day.reviewsCompleted}`}
                    />
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className={`${commonClasses.card} p-6`}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Achievements
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <Award className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="font-semibold text-sm">First 100 Words</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Completed</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <TrendingUp className="w-8 h-8 text-blue-500" />
            <div>
              <p className="font-semibold text-sm">Week Streak</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">7 days in a row</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <Target className="w-8 h-8 text-green-500" />
            <div>
              <p className="font-semibold text-sm">Perfect Week</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">100% daily goals</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPanel;
