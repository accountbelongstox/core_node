/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Button, BackButton, SectionTitle } from '../../components/UI';
import { Avatar } from '../../components/Avatar';
import { MOCK_FRIENDS as MOCK_FRIENDS_RAW, MOCK_ACTIVITIES } from '../../services/mockData';
import type { Friend } from '../../types';
import { Heart, Gift } from 'lucide-react';

// Backend friend objects can carry a full `avatar_url`; the shared `Friend`
// type only declares the relative `avatar`. Widen page-locally with the
// optional field already read defensively (`avatar_url || avatar`). Runtime
// unchanged — mock objects simply lack `avatar_url`.
const MOCK_FRIENDS = MOCK_FRIENDS_RAW as Array<Friend & { avatar_url?: string }>;

const FriendsPage = () => {
  const { navigate, t } = useContext(AppContext);

  const statusDot = (status: string) =>
    status === 'online' ? 'bg-green-500' : status === 'studying' ? 'bg-[var(--klein-blue)]' : 'bg-slate-400';

  return (
    <div className="ds-aura-bg min-h-screen pb-28">
      <div className="ds-aura-overlay" />
      <div className="relative h-full flex flex-col px-[var(--page-padding-h)] pt-[var(--page-padding-v)] animate-slide-up">
        {/* Minimal asymmetric header */}
        <div className="flex items-center justify-between mb-[var(--space-breath)]">
          <div className="flex items-center gap-3">
            <BackButton onClick={() => navigate('home')} />
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t('social.friends')}</h1>
          </div>
          <Button variant="klein" className="!w-auto px-5 !py-2.5 text-sm">{t('social.add')}</Button>
        </div>

        {/* Active Friends Horizontal Scroll */}
        <div className="mb-8">
          <SectionTitle title={t('social.activeNow')} className="mb-3 px-1" />
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {MOCK_FRIENDS.map(f => (
              <div key={f.id} className="flex flex-col items-center gap-2 min-w-[70px]">
                <div className="relative">
                  <Avatar
                    src={f.avatar_url}
                    fallbackSrc={f.avatar}
                    name={f.name}
                    alt={f.name}
                    className="w-16 h-16 rounded-2xl border border-[var(--border-highlight)] shadow-sm text-xl"
                  />
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--color-surface)] ${statusDot(f.status)}`}></div>
                </div>
                <span className="text-xs font-bold text-[var(--color-text-secondary)] truncate w-full text-center">{f.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-24">
          <SectionTitle title={t('social.activityFeed')} className="mb-1 px-1" />
          {MOCK_ACTIVITIES.map(a => (
            <div key={a.id} className="ds-row p-5 flex gap-4">
              <Avatar src={a.userAvatar} name={a.userName} alt={a.userName} className="w-12 h-12 rounded-full border border-[var(--border-highlight)] text-base flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-[var(--color-text-primary)]">
                  <span className="font-bold">{a.userName}</span> {a.action}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{a.time}</p>
              </div>
              <div className="flex flex-col items-center justify-center">
                <button aria-label="Like" className="text-slate-300 hover:text-red-500 transition-colors"><Heart className="w-5 h-5" /></button>
                <span className="text-xs text-[var(--color-text-tertiary)]">{a.likes}</span>
              </div>
            </div>
          ))}

          <div
            className="mt-4 rounded-[var(--radius-card)] p-6 text-[var(--klein-on)] relative overflow-hidden"
            style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            <div className="absolute -top-10 -right-8 w-32 h-32 bg-white/15 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{t('social.inviteFriends')}</h3>
                <p className="text-[var(--klein-on)]/80 text-sm">{t('social.getProFree')}</p>
              </div>
              <Gift className="w-8 h-8 text-[var(--klein-on)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FriendsPage;
