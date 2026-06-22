/* [v4.1-Iris] Social Friends — ported from qy_capacitor/pages/Social/Friends.tsx.
 * Live data only: friends + activity feed come from the AppQyV1 social API
 * (GET /social/friends, GET /social/activities), and the Add button opens an
 * inline user search (GET /social/friends/search?q=) with follow / unfollow
 * actions (POST /social/friends/follow|unfollow). No mock fallback — when a
 * request fails or returns nothing, the section renders an EmptyState. */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Gift, Users, Search, UserPlus, UserMinus } from 'lucide-react';
import { Button, BackButton, SectionTitle, EmptyState, LoadingState } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfT } from '../WfAppContext';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';

// Response shapes of routes/AppQyV1Router/AppQyV1Social.php (after the
// WordflowApi envelope unwrap to `data`).
interface SocialFriend {
  id: number;
  username: string;
  name: string;
  avatar_url?: string | null;
  status: 'online' | 'studying' | 'offline';
  stats: { total_words: number; learned_words: number; mastered_words: number };
}
interface SocialActivity {
  id: string;
  user_id: number;
  user_name: string;
  avatar_url?: string | null;
  action: string;
  time: string;
}
interface SearchedUser {
  id: number;
  username: string;
  name: string;
  avatar_url?: string | null;
  status: 'online' | 'studying' | 'offline';
  is_following: boolean;
}

const avatarLetter = (name: string) => (name || '?').charAt(0).toUpperCase();

const SocialAvatar: React.FC<{ name: string; src?: string | null; className?: string }> = ({ name, src, className = '' }) =>
  src ? (
    <img src={src} alt={name} className={`object-cover ${className}`} />
  ) : (
    <div className={`flex items-center justify-center font-bold bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] ${className}`}>
      {avatarLetter(name)}
    </div>
  );

// "2026-06-11 11:09:40" / ISO → compact relative label.
const timeAgo = (raw: string): string => {
  const date = new Date(String(raw).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return raw;
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
};

const WfSocialFriendsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfT();

  const [friends, setFriends] = useState<SocialFriend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState(false);
  const [activities, setActivities] = useState<SocialActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [pendingFollowId, setPendingFollowId] = useState<number | null>(null);

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true);
    setFriendsError(false);
    try {
      const res = await wordflowApi.request<{ friends: SocialFriend[] }>('/social/friends');
      setFriends(Array.isArray(res?.friends) ? res.friends : []);
    } catch {
      setFriends([]);
      setFriendsError(true);
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  const loadActivities = useCallback(async () => {
    setActivitiesLoading(true);
    setActivitiesError(false);
    try {
      const res = await wordflowApi.request<{ activities: SocialActivity[] }>('/social/activities');
      setActivities(Array.isArray(res?.activities) ? res.activities : []);
    } catch {
      setActivities([]);
      setActivitiesError(true);
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
    loadActivities();
  }, [loadFriends, loadActivities]);

  const runSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchDone(false);
    try {
      const res = await wordflowApi.request<{ users: SearchedUser[] }>(
        `/social/friends/search?q=${encodeURIComponent(q)}`
      );
      setSearchResults(Array.isArray(res?.users) ? res.users : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
      setSearchDone(true);
    }
  };

  const toggleFollow = async (target: SearchedUser) => {
    setPendingFollowId(target.id);
    try {
      await wordflowApi.request(
        target.is_following ? '/social/friends/unfollow' : '/social/friends/follow',
        { method: 'POST', body: JSON.stringify({ user_id: target.id }) }
      );
      setSearchResults((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, is_following: !u.is_following } : u))
      );
      await loadFriends();
    } catch {
      // Keep the previous state — the button stays actionable for a retry.
    } finally {
      setPendingFollowId(null);
    }
  };

  const unfollowFriend = async (friendId: number) => {
    setPendingFollowId(friendId);
    try {
      await wordflowApi.request('/social/friends/unfollow', {
        method: 'POST',
        body: JSON.stringify({ user_id: friendId }),
      });
      await loadFriends();
    } catch {
      // Keep list as-is on failure.
    } finally {
      setPendingFollowId(null);
    }
  };

  const statusDot = (status: string) =>
    status === 'online' ? 'bg-green-500' : status === 'studying' ? 'bg-[var(--klein-blue)]' : 'bg-slate-400';

  const activeFriends = friends.filter((f) => f.status === 'online' || f.status === 'studying');

  return (
    <div className="min-h-screen pb-28">
      <div className="relative h-full flex flex-col px-[var(--page-padding-h)] pt-[var(--page-padding-v)] animate-slide-up max-w-md mx-auto">
        {/* Minimal asymmetric header */}
        <div className="flex items-center justify-between mb-[var(--space-breath)]">
          <div className="flex items-center gap-3">
            <BackButton onClick={() => navigate(wfPath('learn/home'))} />
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {t('social.friends') || 'Friends'}
            </h1>
          </div>
          <Button
            variant="klein"
            className="!w-auto px-5 !py-2.5 text-sm"
            onClick={() => setSearchOpen((v) => !v)}
          >
            {t('social.add') || 'Add'}
          </Button>
        </div>

        {/* Inline user search (follow / unfollow) */}
        {searchOpen && (
          <div className="ds-card p-4 mb-6 space-y-3">
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
                placeholder={t('social.searchPlaceholder') || 'Search by username...'}
                className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--border-highlight)] text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)]"
              />
              <Button variant="klein" className="!w-auto px-4 !py-2.5 text-sm" onClick={runSearch}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
            {searchLoading && <LoadingState label={t('common.loading') || 'Loading...'} />}
            {!searchLoading && searchDone && searchResults.length === 0 && (
              <p className="text-sm text-[var(--color-text-tertiary)] text-center py-2">
                {t('social.noUsersFound') || 'No users found'}
              </p>
            )}
            {!searchLoading && searchResults.map((u) => (
              <div key={u.id} className="ds-row p-3 flex items-center gap-3">
                <SocialAvatar name={u.name} src={u.avatar_url} className="w-10 h-10 rounded-full border border-[var(--border-highlight)]" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-[var(--color-text-primary)] truncate">{u.name}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)] truncate">@{u.username}</p>
                </div>
                <Button
                  variant={u.is_following ? 'secondary' : 'klein'}
                  className="!w-auto px-3 !py-2 text-xs"
                  disabled={pendingFollowId === u.id}
                  onClick={() => toggleFollow(u)}
                >
                  {u.is_following ? (
                    <span className="inline-flex items-center gap-1"><UserMinus className="w-3.5 h-3.5" />{t('social.unfollow') || 'Unfollow'}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" />{t('social.follow') || 'Follow'}</span>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Active friends horizontal scroll */}
        <div className="mb-8">
          <SectionTitle title={t('social.activeNow') || 'Active Now'} className="mb-3 px-1" />
          {friendsLoading ? (
            <LoadingState label={t('common.loading') || 'Loading...'} />
          ) : friendsError ? (
            <EmptyState
              icon={<Users className="w-10 h-10" />}
              title={t('social.friendsLoadFailed') || 'Could not load friends'}
              description={t('social.tryAgainLater') || 'Please try again later'}
            />
          ) : activeFriends.length === 0 ? (
            <EmptyState
              icon={<Users className="w-10 h-10" />}
              title={t('social.noFriendsOnline') || 'No friends online right now'}
              description={
                friends.length === 0
                  ? (t('social.followSomeone') || 'Follow someone to build your circle')
                  : undefined
              }
            />
          ) : (
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              {activeFriends.map((f) => (
                <div key={f.id} className="flex flex-col items-center gap-2 min-w-[70px]">
                  <div className="relative">
                    <SocialAvatar
                      name={f.name}
                      src={f.avatar_url}
                      className="w-16 h-16 rounded-2xl border border-[var(--border-highlight)] shadow-sm text-xl"
                    />
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--color-surface)] ${statusDot(f.status)}`} />
                  </div>
                  <span className="text-xs font-bold text-[var(--color-text-secondary)] truncate w-full text-center">
                    {f.name.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All friends list */}
        {!friendsLoading && !friendsError && friends.length > 0 && (
          <div className="mb-8 space-y-3">
            <SectionTitle title={`${t('social.allFriends') || 'All Friends'} (${friends.length})`} className="px-1" />
            <div className="ds-stack-tight flex flex-col">
              {friends.map((f) => (
                <div key={f.id} className="ds-row p-4 flex items-center gap-4">
                  <div className="relative">
                    <SocialAvatar name={f.name} src={f.avatar_url} className="w-12 h-12 rounded-full border border-[var(--border-highlight)]" />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--color-surface)] ${statusDot(f.status)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[var(--color-text-primary)] truncate">{f.name}</h3>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {f.stats.learned_words} {t('social.learnedWords') || 'learned'} · {f.stats.mastered_words} {t('social.masteredWords') || 'mastered'}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    className="!w-auto px-3 !py-2 text-xs"
                    disabled={pendingFollowId === f.id}
                    onClick={() => unfollowFriend(f.id)}
                  >
                    <span className="inline-flex items-center gap-1"><UserMinus className="w-3.5 h-3.5" />{t('social.unfollow') || 'Unfollow'}</span>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity feed */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-24">
          <SectionTitle title={t('social.activityFeed') || 'Activity Feed'} className="mb-1 px-1" />
          {activitiesLoading ? (
            <LoadingState label={t('common.loading') || 'Loading...'} />
          ) : activitiesError ? (
            <EmptyState
              icon={<Heart className="w-10 h-10" />}
              title={t('social.activitiesLoadFailed') || 'Could not load activity'}
              description={t('social.tryAgainLater') || 'Please try again later'}
            />
          ) : activities.length === 0 ? (
            <EmptyState
              icon={<Heart className="w-10 h-10" />}
              title={t('social.noActivity') || 'No recent activity'}
              description={t('social.noActivityHint') || 'Activity from people you follow shows up here'}
            />
          ) : (
            activities.map((a) => (
              <div key={a.id} className="ds-row p-5 flex gap-4">
                <SocialAvatar
                  name={a.user_name}
                  src={a.avatar_url}
                  className="w-12 h-12 rounded-full border border-[var(--border-highlight)] text-base flex-shrink-0"
                />
                <div className="flex-1">
                  <p className="text-sm text-[var(--color-text-primary)]">
                    <span className="font-bold">{a.user_name}</span> {a.action}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{timeAgo(a.time)}</p>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <button aria-label="Like" className="text-slate-300 hover:text-red-500 transition-colors">
                    <Heart className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}

          <div
            className="mt-4 rounded-[var(--radius-card)] p-6 text-[var(--klein-on)] relative overflow-hidden"
            style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            <div className="absolute -top-10 -right-8 w-32 h-32 bg-white/15 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{t('social.inviteFriends') || 'Invite Friends'}</h3>
                <p className="text-[var(--klein-on)]/80 text-sm">{t('social.getProFree') || 'Get Pro features free'}</p>
              </div>
              <Gift className="w-8 h-8 text-[var(--klein-on)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WfSocialFriendsPage;
