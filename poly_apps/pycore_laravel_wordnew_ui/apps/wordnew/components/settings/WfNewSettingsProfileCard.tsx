import React, { useMemo } from 'react';
import { ChevronRight, Flame, GraduationCap, Sparkles } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { wfNewSettings } from '../../WfNewSettingsStore';
import { WfNewAvatarView } from '../WfNewAvatarView';
import { useWordNewLearningStats } from '../../services/WordNewLearningStatsCenter';
import { computeMemberLevel } from '../../services/WordNewAchievementCenter';

/** Settings entry into the profile: avatar, name, member tier and core counters. */
interface WfNewSettingsProfileCardProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  nickname: string;
  avatarUrl: string;
  onOpen: () => void;
}

export const WfNewSettingsProfileCard: React.FC<WfNewSettingsProfileCardProps> = ({
  activeTheme, trans, nickname, avatarUrl, onOpen,
}) => {
  const stats = useWordNewLearningStats();
  const learned = stats?.totalWordsLearned ?? 0;
  const mastered = stats?.masteredWords ?? 0;
  const streak = stats?.currentStreak ?? (Number(wfNewSettings.get('streakDays')) || 0);
  const member = useMemo(() => computeMemberLevel(learned, streak), [learned, streak]);
  const TierIcon = member.tier.Icon;

  const counters = [
    { icon: GraduationCap, value: learned, label: trans('stats.learned'), accent: 'text-indigo-400' },
    { icon: Sparkles, value: mastered, label: trans('dashboard.mastered'), accent: 'text-emerald-400' },
    { icon: Flame, value: `${streak}${trans('stats.days')}`, label: trans('stats.days'), accent: 'text-orange-400' },
  ];

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full min-w-0 p-3 sm:p-4 rounded-3xl ${activeTheme.cardClass} border border-white/5 hover:border-indigo-500/30 shadow-sm flex items-center gap-3 text-left transition-colors cursor-pointer group`}
      title={trans('hdr.profile')}
      aria-label={trans('hdr.profile')}
    >
      <span className="relative shrink-0 w-12 h-12 rounded-full bg-slate-900 border border-white/10 overflow-hidden flex items-center justify-center text-xl">
        <WfNewAvatarView value={avatarUrl} className="text-xl" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-slate-900 dark:text-slate-100">{nickname || trans('tip.profile')}</span>
        <span className={`mt-0.5 inline-flex items-center gap-1 max-w-full text-[10px] font-mono font-bold ${member.tier.accent}`}>
          <TierIcon className="w-3 h-3 shrink-0" />
          <span className="truncate">{trans('profile.tier.' + member.tier.id)} · Lv.{member.tier.level}</span>
        </span>
      </span>
      <span className="hidden min-[380px]:flex items-center gap-3 shrink-0">
        {counters.map(({ icon: Icon, value, label, accent }) => (
          <span key={label} className="flex flex-col items-center" title={label}>
            <Icon className={`w-3.5 h-3.5 ${accent}`} />
            <span className="text-xs font-black font-mono text-slate-900 dark:text-slate-100 leading-tight">{value}</span>
          </span>
        ))}
      </span>
      <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-indigo-400 shrink-0" />
    </button>
  );
};
