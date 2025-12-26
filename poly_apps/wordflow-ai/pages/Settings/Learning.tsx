import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';

interface SettingCardProps {
  label: string;
  value?: string | number;
  icon?: React.ReactNode;
  onClick?: () => void;
}

const SettingCard: React.FC<SettingCardProps> = ({ label, value, icon, onClick }) => (
  <Card
    onClick={onClick}
    className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${
      onClick ? 'cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500' : ''
    } transition-all`}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1">
        {icon && <div className="text-slate-600 dark:text-slate-400">{icon}</div>}
        <span className="font-semibold text-slate-900 dark:text-white">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {value !== undefined && (
          <span className="text-sm text-slate-500 dark:text-slate-400">{value}</span>
        )}
        {onClick && <Icons.ChevronRight />}
      </div>
    </div>
  </Card>
);

interface ToggleCardProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: React.ReactNode;
}

const ToggleCard: React.FC<ToggleCardProps> = ({ label, description, value, onChange, icon }) => (
  <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1">
        {icon && <div className="text-slate-600 dark:text-slate-400">{icon}</div>}
        <div className="flex-1">
          <p className="font-semibold text-slate-900 dark:text-white">{label}</p>
          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-7 rounded-full p-1 transition-colors ${
          value ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
            value ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  </Card>
);

const LearningSettings = () => {
  const { settings, updateSettings, navigate, t } = useContext(AppContext);
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-6 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('settings')}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Icons.Back />
          </button>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {t('settings.learningGoals')}
          </h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Customize your daily learning targets and preferences
        </p>
      </div>

      <div className="sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto px-6 space-y-6">
        {/* Daily Goals Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Daily Goals
          </h2>

          <SettingCard
            label={t('settings.dailyWordGoal')}
            value={`${settings.learning.dailyWordGoal} ${t('library.words')}`}
            onClick={() => setShowGoalPicker(true)}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />

          <SettingCard
            label={t('settings.dailyReviewGoal')}
            value={`${settings.learning.dailyReviewGoal} ${t('library.words')}`}
            onClick={() => setShowGoalPicker(true)}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          />

          <SettingCard
            label={t('settings.sessionSize')}
            value={settings.learning.sessionSize}
            onClick={() => setShowGoalPicker(true)}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />

          {/* Goal Progress Card */}
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-800 dark:to-slate-800 border border-green-200 dark:border-slate-700">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 dark:text-white mb-1">Today's Progress</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  You've completed {Math.round((15 / settings.learning.dailyWordGoal) * 100)}% of your daily goal
                </p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((15 / settings.learning.dailyWordGoal) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sequential Player Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('settings.sequentialPlayer')}
          </h2>

          <Card
            onClick={() => navigate('playlist_config')}
            className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-none shadow-xl cursor-pointer hover:scale-[1.02] transition-transform"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                ▶
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">{t('settings.playlistConfig')}</h3>
                <p className="text-blue-100 text-sm">{t('settings.configureIntervals')}</p>
              </div>
              <Icons.ChevronRight />
            </div>
          </Card>
        </div>

        {/* Flow Control Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('settings.flowControl')}
          </h2>

          <ToggleCard
            label={t('settings.instantReview')}
            description="Review words immediately after learning"
            value={settings.learning.instantReviewEnabled}
            onChange={(value) =>
              updateSettings({ learning: { ...settings.learning, instantReviewEnabled: value } })
            }
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />

          <ToggleCard
            label={t('settings.autoAdvance')}
            description="Automatically move to next word after answering"
            value={settings.learning.autoAdvance}
            onChange={(value) =>
              updateSettings({ learning: { ...settings.learning, autoAdvance: value } })
            }
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            }
          />
        </div>

        {/* Learning Mode Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Learning Mode
          </h2>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <span className="font-semibold text-slate-900 dark:text-white">{t('settings.difficulty')}</span>
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400">{t('settings.adaptive')}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-semibold text-slate-900 dark:text-white">Review Algorithm</span>
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400">Spaced Repetition</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-800 border border-purple-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">Learning Tips</h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>Set realistic daily goals based on your schedule</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>Instant review helps reinforce new words immediately</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>Auto-advance speeds up practice sessions</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Goal Picker Modal (placeholder) */}
      {showGoalPicker && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={() => setShowGoalPicker(false)}
        >
          <Card
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                Adjust Goal
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Goal adjustment UI coming soon
              </p>
              <button
                onClick={() => setShowGoalPicker(false)}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LearningSettings;
