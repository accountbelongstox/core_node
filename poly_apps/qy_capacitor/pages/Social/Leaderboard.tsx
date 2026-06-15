/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { BackButton, ProgressBar } from '../../components/UI';
import { Avatar } from '../../components/Avatar';
import { PillNav } from '../../components/PillNav';
import { MOCK_LEADERBOARD as MOCK_LEADERBOARD_RAW, MOCK_ACHIEVEMENTS } from '../../services/mockData';
import type { LeaderboardUser } from '../../types';
import { Sunrise, Bug, Flame, Globe2, Trophy, type LucideIcon } from 'lucide-react';

// Backend leaderboard objects can carry a full `avatar_url`; the shared
// `LeaderboardUser` type only declares the relative `avatar`. Widen
// page-locally with the optional field already read defensively
// (`avatar_url || avatar`). Runtime unchanged — mock objects lack `avatar_url`.
const MOCK_LEADERBOARD = MOCK_LEADERBOARD_RAW as Array<LeaderboardUser & { avatar_url?: string }>;

// Map achievement ids to lucide icons (no emoji as UI affordance, per v4.1 §3.10)
const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  a1: Sunrise,
  a2: Bug,
  a3: Flame,
  a4: Globe2,
};

const LeaderboardPage = () => {
  const { navigate, t } = useContext(AppContext);
  const [tab, setTab] = useState<'ranking' | 'badges'>('ranking');

  const rankBadge = (rank: number) =>
    rank === 1
      ? 'bg-[var(--klein-blue)] text-[var(--klein-on)]'
      : rank === 2
      ? 'bg-slate-300 text-white'
      : rank === 3
      ? 'bg-orange-300 text-white'
      : 'bg-[var(--klein-blue-soft)] text-[var(--color-text-tertiary)]';

  return (
    <div className="ds-aura-bg min-h-screen pb-28">
      <div className="ds-aura-overlay" />
      <div className="relative h-full flex flex-col px-[var(--page-padding-h)] pt-[var(--page-padding-v)] animate-slide-up">
        {/* Minimal asymmetric header */}
        <div className="flex justify-between items-center mb-[var(--space-breath)]">
          <div className="flex items-center gap-3">
            <BackButton onClick={() => navigate('home')} />
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t('social.community')}</h1>
          </div>
        </div>

        {/* Filter — Pill nav */}
        <div className="mb-6">
          <PillNav
            aria-label="Leaderboard filter"
            activeId={tab}
            onChange={(id) => setTab(id as 'ranking' | 'badges')}
            items={[
              { id: 'ranking', label: t('social.rank') },
              { id: 'badges', label: t('social.badges') },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
          {tab === 'ranking' ? (
            <div className="ds-stack-tight flex flex-col">
              {MOCK_LEADERBOARD.map((u, i) => (
                <div
                  key={i}
                  className={`ds-row p-5 flex items-center gap-4 ${u.isCurrentUser ? 'ring-2 ring-[var(--klein-ring)]' : ''}`}
                >
                  <div className={`w-8 h-8 flex items-center justify-center font-bold rounded-full ${rankBadge(u.rank)}`}>
                    {u.rank}
                  </div>
                  <Avatar
                    src={u.avatar_url}
                    fallbackSrc={u.avatar}
                    name={u.name}
                    alt={u.name}
                    className="w-10 h-10 rounded-full border border-[var(--border-highlight)]"
                  />
                  <div className="flex-1 font-bold text-[var(--color-text-primary)] truncate">{u.name}</div>
                  <div className="text-[var(--klein-blue)] font-mono font-bold">{u.xp} XP</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ds-grid-breathing grid-cols-2">
              {MOCK_ACHIEVEMENTS.map(a => (
                <div key={a.id} className={`ds-card p-5 flex flex-col items-center text-center ${!a.unlocked ? 'opacity-60' : ''}`}>
                  <div className={`mb-3 ${!a.unlocked ? 'text-[var(--color-text-tertiary)]' : 'text-[var(--klein-blue)]'}`}>
                    {(() => {
                      const AchIcon = ACHIEVEMENT_ICONS[a.id] ?? Trophy;
                      return <AchIcon className="w-9 h-9" />;
                    })()}
                  </div>
                  <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">{a.name}</h3>
                  <p className="text-xs text-[var(--color-text-tertiary)] mb-3 leading-tight">{a.description}</p>
                  {a.unlocked ? (
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-bold rounded-full">{t('social.unlocked')}</span>
                  ) : (
                    <ProgressBar value={a.progress} max={a.maxProgress} className="mt-auto" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
