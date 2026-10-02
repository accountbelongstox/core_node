import React from 'react';
import { Activity, Clock, Trophy } from 'lucide-react';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { StateMessage } from '@/shared/ui/StateMessage';
import type { WfNewActivity, WfNewLeaderboardEntry } from '../../api';
import { formatRelativeTime } from '../../../../core/utils/formatters';
import { WfNewSocialAvatar } from './WfNewSocialAvatar';

const SOCIAL_SEGMENT_ACTIVE = 'bg-indigo-600 text-white shadow';
const FEED_VISIBLE_COUNT = 5;

interface WfNewSocialLeaderboardProps {
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  period: 'week' | 'all';
  onPeriodChange: (period: 'week' | 'all') => void;
  activities: WfNewActivity[];
  feedLoading: boolean;
  leaderboard: WfNewLeaderboardEntry[];
  loading: boolean;
}

export const WfNewSocialLeaderboard: React.FC<WfNewSocialLeaderboardProps> = ({
  trans, period, onPeriodChange, activities, feedLoading, leaderboard, loading: leaderboardLoading,
}) => (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black font-mono tracking-widest text-amber-400 uppercase flex items-center gap-1.5">
          <Trophy className="w-4 h-4" />
          {trans('social.leaderboardTitle')}
        </h4>
        <SegmentedControl<'week' | 'all'>
          value={period}
          onChange={onPeriodChange}
          activeClassName={SOCIAL_SEGMENT_ACTIVE}
          options={[
            { value: 'week', label: trans('social.week') },
            { value: 'all', label: trans('social.allTime') },
          ]}
        />
      </div>

      {/* Recent activity digest of followed users (legacy feed, folded in here). */}
      {!feedLoading && activities.length > 0 && (
        <div className="p-4 rounded-2xl bg-white/3 border border-white/5 space-y-3">
          <h5 className="text-[10px] font-black font-mono tracking-widest text-indigo-400 uppercase flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> {trans('social.feedTitle')}
          </h5>
          {activities.slice(0, FEED_VISIBLE_COUNT).map(act => (
            <div key={act.id} className="flex items-center gap-2.5">
              <WfNewSocialAvatar src={act.avatar_url} name={act.user_name} size="w-7 h-7" textClass="text-sm" />
              <span className="text-[11px] font-bold text-slate-200 truncate">{act.user_name}</span>
              <span className="text-[10px] text-zinc-500 truncate flex-1">{act.action || trans('social.feedDefaultAction')}</span>
              <span className="text-[9px] text-zinc-600 font-mono shrink-0 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatRelativeTime(act.time)}
              </span>
            </div>
          ))}
        </div>
      )}

      {leaderboardLoading && <StateMessage kind="empty" size="page">{trans('social.leaderboardLoading')}</StateMessage>}

      {!leaderboardLoading && leaderboard.length === 0 && <StateMessage kind="empty" size="page">{trans('social.leaderboardEmpty')}</StateMessage>}

      {!leaderboardLoading && leaderboard.map(entry => (
        <div
          key={entry.user_id}
          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
            entry.is_current_user
              ? 'bg-indigo-500/10 border-indigo-500/30'
              : 'bg-white/3 border-white/5 hover:border-white/10'
          }`}
        >
          <span className={`w-8 text-center font-black font-mono text-sm ${
            entry.rank === 1 ? 'text-amber-400' : entry.rank === 2 ? 'text-slate-300' : entry.rank === 3 ? 'text-orange-400' : 'text-zinc-500'
          }`}>
            #{entry.rank}
          </span>
          <WfNewSocialAvatar src={entry.avatar_url} name={entry.name || entry.username} size="w-9 h-9" textClass="text-sm" />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold truncate ${entry.is_current_user ? 'text-indigo-300' : 'text-slate-200'}`}>
              {entry.name || entry.username}
              {entry.is_current_user && <span className="ml-2 text-[9px] font-mono text-indigo-400">{trans('social.you')}</span>}
            </p>
          </div>
          <span className="text-xs font-black font-mono text-emerald-400 shrink-0">
            {trans('social.xp', { n: entry.xp })}
          </span>
        </div>
      ))}
    </div>
);
