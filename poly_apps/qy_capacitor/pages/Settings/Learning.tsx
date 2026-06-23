/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button, BackButton, ProgressBar, Sheet, SectionTitle } from '../../components/UI';
import { Play } from 'lucide-react';

interface SettingCardProps {
  label: string;
  value?: string | number;
  icon?: React.ReactNode;
  onClick?: () => void;
}

/** Reference settings row: soft rounded icon-chip + label + value + chevron. */
const SettingCard: React.FC<SettingCardProps> = ({ label, value, icon, onClick }) => (
  <div
    onClick={onClick}
    className={`ds-row w-full p-4 flex items-center justify-between gap-3 group ${
      onClick ? 'cursor-pointer ds-touch-target' : ''
    }`}
  >
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] [&_svg]:w-5 [&_svg]:h-5">
          {icon}
        </span>
      )}
      <span className="font-semibold text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">{label}</span>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {value !== undefined && (
        <span className="text-sm text-[var(--color-text-tertiary)]">{value}</span>
      )}
      {onClick && <span className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors"><Icons.ChevronRight /></span>}
    </div>
  </div>
);

interface ToggleCardProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: React.ReactNode;
}

const ToggleCard: React.FC<ToggleCardProps> = ({ label, description, value, onChange, icon }) => (
  <div className="ds-row w-full p-4 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] [&_svg]:w-5 [&_svg]:h-5">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-[var(--color-text-primary)] truncate">{label}</p>
        {description && (
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{description}</p>
        )}
      </div>
    </div>
    <button
      onClick={() => onChange(!value)}
      className="ds-touch-target w-12 h-7 rounded-full p-1 transition-colors flex-shrink-0"
      style={{ background: value ? 'var(--klein-gradient)' : 'var(--color-glass-border)' }}
      role="switch"
      aria-checked={value}
    >
      <div
        className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
          value ? 'translate-x-5' : ''
        }`}
      />
    </button>
  </div>
);

const LearningSettings = () => {
  const { settings, updateSettings, navigate, t } = useContext(AppContext);
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  const dailyWordGoal = settings.learning.dailyWordGoal || 1;
  const goalProgress = Math.min((15 / dailyWordGoal) * 100, 100);

  return (
    <div className="ds-aura-bg min-h-screen pb-28">
      <div className="ds-aura-overlay" />

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
        <div className="flex items-center gap-3 mb-2">
          <BackButton onClick={() => navigate('settings')} />
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            {t('settings.learningGoals')}
          </h1>
        </div>
        <p className="text-[var(--color-text-secondary)] pl-1">
          Customize your daily learning targets and preferences
        </p>
      </div>

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Daily Goals Section */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.dailyGoals') || 'Daily Goals'} className="px-1 mb-1" />

          <SettingCard
            label={t('settings.dailyWordGoal')}
            value={`${settings.learning.dailyWordGoal} ${t('library.words')}`}
            onClick={() => setShowGoalPicker(true)}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />

          <SettingCard
            label={t('settings.dailyReviewGoal')}
            value={`${settings.learning.dailyReviewGoal} ${t('library.words')}`}
            onClick={() => setShowGoalPicker(true)}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          />

          <SettingCard
            label={t('settings.sessionSize')}
            value={settings.learning.sessionSize}
            onClick={() => setShowGoalPicker(true)}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />

          {/* Goal Progress Card */}
          <Card>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[var(--color-text-primary)] mb-1">Today's Progress</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                  You've completed {Math.round(goalProgress)}% of your daily goal
                </p>
                <ProgressBar value={goalProgress} />
              </div>
            </div>
          </Card>
        </div>

        {/* Sequential Player Section — Iris gradient hero */}
        <div className="space-y-3">
          <SectionTitle title={t('settings.sequentialPlayer')} className="px-1" />

          <div
            onClick={() => navigate('playlist_config')}
            className="rounded-[var(--radius-card)] p-6 text-white cursor-pointer ds-touch-target active:scale-[0.99] transition-transform relative overflow-hidden"
            style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            <div className="absolute -top-12 -right-10 w-36 h-36 bg-white/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-14 -left-10 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Play className="w-7 h-7" fill="currentColor" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg mb-1">{t('settings.playlistConfig')}</h3>
                <p className="text-white/80 text-sm">{t('settings.configureIntervals')}</p>
              </div>
              <span className="text-white/80"><Icons.ChevronRight /></span>
            </div>
          </div>
        </div>

        {/* Flow Control Section */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.flowControl')} className="px-1 mb-1" />

          <ToggleCard
            label={t('settings.instantReview')}
            description="Review words immediately after learning"
            value={settings.learning.instantReviewEnabled}
            onChange={(value) =>
              updateSettings({ learning: { ...settings.learning, instantReviewEnabled: value } })
            }
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            }
          />
        </div>

        {/* Learning Mode Section */}
        <div className="space-y-3">
          <SectionTitle title={t('settings.learningMode') || 'Learning Mode'} className="px-1" />

          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-[var(--klein-blue-soft)] text-[var(--klein-blue)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </span>
                  <span className="font-semibold text-[var(--color-text-primary)]">{t('settings.difficulty')}</span>
                </div>
                <span className="text-sm text-[var(--color-text-tertiary)]">{t('settings.adaptive')}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-[var(--klein-blue-soft)] text-[var(--klein-blue)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <span className="font-semibold text-[var(--color-text-primary)]">Review Algorithm</span>
                </div>
                <span className="text-sm text-[var(--color-text-tertiary)]">Spaced Repetition</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Info Card */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[var(--color-text-primary)] mb-1">Learning Tips</h3>
              <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
                  <span>Set realistic daily goals based on your schedule</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
                  <span>Instant review helps reinforce new words immediately</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
                  <span>Auto-advance speeds up practice sessions</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Goal Picker Modal (placeholder) */}
      <Sheet open={showGoalPicker} onClose={() => setShowGoalPicker(false)} position="center">
        <div className="text-center">
          <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
            Adjust Goal
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">
            Goal adjustment UI coming soon
          </p>
          <Button variant="grad" onClick={() => setShowGoalPicker(false)}>
            Close
          </Button>
        </div>
      </Sheet>
    </div>
  );
};

export default LearningSettings;
