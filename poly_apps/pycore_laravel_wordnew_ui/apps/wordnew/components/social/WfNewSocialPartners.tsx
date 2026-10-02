import React from 'react';
import { Check, MessageSquare, Search, UserCheck, UserPlus, X } from 'lucide-react';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { StateMessage } from '@/shared/ui/StateMessage';
import { TextField } from '@/shared/ui/TextField';
import type { WfNewDiscoverUser, WfNewFriendRequest, WfNewPresenceStatus } from '../../api';
import { WfNewSocialAvatar } from './WfNewSocialAvatar';

const RIBBON_LANGS = ['all', 'en', 'zh', 'ja', 'es', 'fr', 'ko'];
const SOCIAL_SEGMENT_ACTIVE = 'bg-indigo-600 text-white shadow';

interface WfNewSocialPartnersProps {
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  incoming: WfNewFriendRequest[];
  discover: WfNewDiscoverUser[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  ribbonLang: string;
  onRibbonLangChange: (lang: string) => void;
  pendingIds: Record<number, boolean>;
  presence: Record<number, WfNewPresenceStatus>;
  onRespond: (request: WfNewFriendRequest, action: 'accept' | 'reject') => void;
  onAddFriend: (user: WfNewDiscoverUser) => void;
  onMessage: (user: WfNewDiscoverUser) => void;
  onOpenProfile: (userId: number) => void;
}

export const WfNewSocialPartners: React.FC<WfNewSocialPartnersProps> = ({
  trans, incoming, discover, loading: discoverLoading, search: partnerSearch, onSearchChange, ribbonLang, onRibbonLangChange,
  pendingIds, presence, onRespond, onAddFriend, onMessage, onOpenProfile,
}) => {
  const matchBadge = (match: WfNewDiscoverUser['match']) => {
    if (match === 'exchange') {
      return { label: trans('social.matchExchange'), cls: 'bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white border-fuchsia-400/30' };
    }
    if (match === 'native') {
      return { label: trans('social.matchNative'), cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' };
    }
    return { label: trans('social.matchTarget'), cls: 'bg-sky-500/15 text-sky-300 border-sky-500/20' };
  };

  return (
    <div className="space-y-6">
      {/* Incoming friend requests strip */}
      {incoming.length > 0 && (
        <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/10 space-y-3">
          <h4 className="text-[11px] font-black font-mono tracking-widest text-indigo-400 uppercase">
            {trans('social.incomingRequests', { n: incoming.length })}
          </h4>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {incoming.map(req => (
              <div key={req.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/4 border border-white/5 shrink-0">
                <WfNewSocialAvatar src={req.avatar_url} name={req.name || req.username} size="w-8 h-8" textClass="text-sm" />
                <span className="text-xs font-bold text-slate-200 max-w-[100px] truncate">{req.name || req.username}</span>
                <button
                  onClick={() => onRespond(req, 'accept')}
                  className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all cursor-pointer"
                  title={trans('social.accept')}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRespond(req, 'reject')}
                  className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-all cursor-pointer"
                  title={trans('social.reject')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter ribbon + search */}
      <div className="p-4 rounded-2xl bg-white/3 border border-white/5 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <TextField className="w-full sm:max-w-xs" icon={<Search />} value={partnerSearch} onChange={onSearchChange} placeholder={trans('social.searchPh')} />
        <SegmentedControl<string>
          value={ribbonLang}
          onChange={onRibbonLangChange}
          activeClassName={SOCIAL_SEGMENT_ACTIVE}
          className="max-w-full overflow-x-auto sm:w-auto"
          options={RIBBON_LANGS.map((langCode) => ({ value: langCode, label: langCode === 'all' ? trans('social.langAll') : trans('lang.name.' + langCode) }))}
        />
      </div>

      {/* Discover grid */}
      {discoverLoading && <StateMessage kind="empty" size="page">{trans('social.discoverLoading')}</StateMessage>}

      {!discoverLoading && discover.length === 0 && <StateMessage kind="empty" size="page">{trans('social.noDiscover')}</StateMessage>}

      {!discoverLoading && discover.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {discover.map(user => {
            const badge = matchBadge(user.match);
            const isPending = pendingIds[user.id];
            return (
              <div
                key={user.id}
                className="p-5 rounded-2xl bg-white/3 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    onClick={() => onOpenProfile(user.id)}
                    title={trans('social.profile.viewProfile')}
                    className="group flex items-center gap-3 min-w-0 cursor-pointer"
                  >
                    <WfNewSocialAvatar src={user.avatar} name={user.nickname} size="w-11 h-11" textClass="text-xl" presence={presence[user.id] || user.presence || 'offline'} />
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-200 truncate group-hover:text-indigo-300 transition-colors">{user.nickname}</h4>
                      <p className="text-[10px] text-indigo-400 font-mono">
                        <span className="uppercase text-slate-300 font-bold">{user.native_language}</span>
                        {' → '}
                        <span className="uppercase text-slate-300 font-bold">{(user.learning_languages || []).join(', ')}</span>
                      </p>
                    </div>
                  </div>
                  <span className={`text-[8px] font-black font-mono tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>

                {user.stats && (
                  <div className="flex gap-3 text-[10px] font-mono text-zinc-400">
                    {typeof user.stats.learned === 'number' && <span>{trans('social.statsLearned', { n: user.stats.learned })}</span>}
                    {typeof user.stats.streak === 'number' && <span>{trans('social.statsStreak', { n: user.stats.streak })}</span>}
                  </div>
                )}

                <div className="flex gap-2.5 pt-3 border-t border-white/5">
                  {user.is_friend ? (
                    <span className="flex-1 py-1.5 rounded-xl text-[11px] font-mono font-bold tracking-wider flex items-center justify-center gap-1.5 border bg-zinc-800/40 border-zinc-700 text-indigo-400">
                      <UserCheck className="w-3.5 h-3.5" /> {trans('social.alreadyFriend')}
                    </span>
                  ) : (
                    <button
                      onClick={() => onAddFriend(user)}
                      disabled={isPending}
                      className={`flex-1 py-1.5 rounded-xl text-[11px] font-mono font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                        isPending
                          ? 'bg-zinc-800/40 border-zinc-700 text-zinc-400'
                          : 'bg-indigo-600/90 hover:bg-indigo-600 border-indigo-500/20 text-white'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{isPending ? trans('social.pending') : trans('social.addFriend')}</span>
                    </button>
                  )}
                  <button
                    onClick={() => onMessage(user)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-400 border border-white/5 text-zinc-400 transition-all cursor-pointer"
                    title={trans('social.message')}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
