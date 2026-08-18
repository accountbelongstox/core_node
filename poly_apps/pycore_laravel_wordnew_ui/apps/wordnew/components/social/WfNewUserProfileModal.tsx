/** WfNewUserProfileModal - read-only public profile of another user (avatar,
 * languages, learning stats, presence + follow/friend/message actions), shown as
 * an overlay opened by user id from the partner cards and chat peer headers.
 * Self-contained (Portal + OVERLAY framework, like WfNewAgreementModal); fetches
 * GET /social/users/{id} through wfNewApi.getPublicUserProfile. */
import React, { useEffect, useState, useCallback } from 'react';
import { X, UserPlus, UserCheck, MessageSquare, Loader2, RefreshCw } from 'lucide-react';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_Z, OVERLAY_CONTAINER, OVERLAY_BACKDROP } from '@/shared/styles/overlay';
import { wfNewApi, type WfNewPublicUserProfile } from '../../api';
import { presenceClass } from './socialPresence';

interface WfNewUserProfileModalProps {
  /** The user to show; the modal is open while this is a number, closed when null. */
  userId: number | null;
  onClose: () => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  isLoggedIn?: boolean;
  /** Route a logged-out viewer to the auth screen when a gated action is triggered. */
  requireAuth?: () => void;
  /** Open/create a conversation with this user and jump to Chat (page-owned). */
  onMessage?: (userId: number) => void;
}

export const WfNewUserProfileModal: React.FC<WfNewUserProfileModalProps> = ({
  userId, onClose, trans, addToast, isLoggedIn = true, requireAuth, onMessage,
}) => {
  const [profile, setProfile] = useState<WfNewPublicUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [friendPending, setFriendPending] = useState(false);

  const load = useCallback((id: number) => {
    setLoading(true);
    setError(false);
    setFriendPending(false);
    wfNewApi.getPublicUserProfile(id)
      .then((p) => { setProfile(p); })
      .catch(() => { setProfile(null); setError(true); })
      .finally(() => { setLoading(false); });
  }, []);

  // (Re)fetch whenever the target user changes; clear stale data on close.
  useEffect(() => {
    if (userId == null) { setProfile(null); setError(false); return; }
    load(userId);
  }, [userId, load]);

  // Esc to close.
  useEffect(() => {
    if (userId == null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [userId, onClose]);

  const handleFollow = useCallback(() => {
    if (userId == null || !profile) return;
    if (!isLoggedIn) { requireAuth?.(); return; }
    const next = !profile.is_following;
    setFollowBusy(true);
    setProfile((prev) => (prev ? { ...prev, is_following: next } : prev));
    const call = next ? wfNewApi.followUser(userId) : wfNewApi.unfollowUser(userId);
    call
      .catch(() => {
        // Revert the optimistic toggle on failure.
        setProfile((prev) => (prev ? { ...prev, is_following: !next } : prev));
        addToast(trans('social.requestFailed'), 'warning');
      })
      .finally(() => setFollowBusy(false));
  }, [userId, profile, isLoggedIn, requireAuth, addToast, trans]);

  const handleAddFriend = useCallback(() => {
    if (userId == null || !profile) return;
    if (!isLoggedIn) { requireAuth?.(); return; }
    setFriendPending(true);
    wfNewApi.sendFriendRequest(userId)
      .then(() => addToast(trans('social.requestSent', { name: profile.name }), 'success'))
      .catch(() => {
        setFriendPending(false);
        addToast(trans('social.requestFailed'), 'warning');
      });
  }, [userId, profile, isLoggedIn, requireAuth, addToast, trans]);

  const handleMessage = useCallback(() => {
    if (userId == null) return;
    if (!isLoggedIn) { requireAuth?.(); return; }
    onMessage?.(userId);
    onClose();
  }, [userId, isLoggedIn, requireAuth, onMessage, onClose]);

  if (userId == null) return null;

  const avatarUrl = profile?.avatar_url || '';
  const avatarIsImg = /^https?:|^data:/i.test(avatarUrl);
  const initial = (profile?.name || '?').slice(0, 1);
  const status = profile?.presence?.status || 'offline';

  return (
    <Portal>
      <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal}`}>
        <div className={`absolute inset-0 ${OVERLAY_BACKDROP}`} onClick={onClose} />
        <div className="relative w-full max-w-sm bg-zinc-900/95 border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
            <h3 className="text-sm font-black text-slate-100">{trans('social.profile.title')}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 cursor-pointer shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto">
            {loading && (
              <div className="py-12 flex flex-col items-center gap-3 text-zinc-500 font-mono text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                {trans('social.profile.loading')}
              </div>
            )}

            {!loading && error && (
              <div className="py-12 flex flex-col items-center gap-3 text-zinc-500 font-mono text-xs">
                <p>{isLoggedIn ? trans('social.profile.error') : trans('social.profile.loginToView')}</p>
                {isLoggedIn && (
                  <button
                    onClick={() => load(userId)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> {trans('social.profile.retry')}
                  </button>
                )}
              </div>
            )}

            {!loading && !error && profile && (
              <div className="space-y-5">
                {/* Identity */}
                <div className="flex flex-col items-center text-center space-y-2.5">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-4xl select-none overflow-hidden border border-white/10">
                      {avatarIsImg
                        ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                        : <span>{avatarUrl || initial}</span>}
                    </div>
                    <span className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-zinc-900 ${presenceClass(status)}`} />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-100">{profile.name}</h4>
                    <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                      {trans('social.status.' + status)}
                    </p>
                  </div>
                  {(profile.native_language || profile.learning_languages.length > 0) && (
                    <p className="text-[11px] text-indigo-400 font-mono">
                      {profile.native_language && (
                        <span className="uppercase text-slate-300 font-bold">{profile.native_language}</span>
                      )}
                      {profile.native_language && profile.learning_languages.length > 0 && ' → '}
                      {profile.learning_languages.length > 0 && (
                        <span className="uppercase text-slate-300 font-bold">{profile.learning_languages.join(', ')}</span>
                      )}
                    </p>
                  )}
                  {profile.bio && (
                    <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xs">{profile.bio}</p>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { n: profile.post_count, label: trans('social.profile.posts') },
                    { n: profile.follower_count, label: trans('social.profile.followers') },
                    { n: profile.following_count, label: trans('social.profile.following') },
                  ].map((s) => (
                    <div key={s.label} className="p-2.5 rounded-xl bg-white/3 border border-white/5 text-center">
                      <p className="text-sm font-black font-mono text-slate-100">{s.n}</p>
                      <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2.5 pt-1">
                  <button
                    onClick={handleFollow}
                    disabled={followBusy}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-mono font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                      profile.is_following
                        ? 'bg-zinc-800/40 border-zinc-700 text-indigo-400 hover:bg-zinc-800/70'
                        : 'bg-indigo-600/90 hover:bg-indigo-600 border-indigo-500/20 text-white'
                    } ${followBusy ? 'opacity-60' : ''}`}
                  >
                    {profile.is_following ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>{profile.is_following ? trans('social.profile.unfollow') : trans('social.profile.follow')}</span>
                  </button>

                  {profile.is_friend ? (
                    <span className="flex-1 py-2 rounded-xl text-[11px] font-mono font-bold tracking-wider flex items-center justify-center gap-1.5 border bg-zinc-800/40 border-zinc-700 text-indigo-400">
                      <UserCheck className="w-3.5 h-3.5" /> {trans('social.alreadyFriend')}
                    </span>
                  ) : (
                    <button
                      onClick={handleAddFriend}
                      disabled={friendPending}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-mono font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                        friendPending
                          ? 'bg-zinc-800/40 border-zinc-700 text-zinc-400'
                          : 'bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-400 border-white/10 text-zinc-300'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{friendPending ? trans('social.pending') : trans('social.addFriend')}</span>
                    </button>
                  )}

                  <button
                    onClick={handleMessage}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-400 border border-white/10 text-zinc-300 transition-all cursor-pointer"
                    title={trans('social.message')}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default WfNewUserProfileModal;
