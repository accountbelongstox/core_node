/**
 * WfNewStudyStatsBar — the study progress header for the shelf deep-dive. Ports
 * the legacy client's three-bar top rail (whole-group mastered %, daily-goal %,
 * session %) plus mastered / learning / due count chips. Pure presentation:
 * every number comes from WfNewStudyProgress.computeStats (blended local +
 * backend), passed in by the panel.
 */
import React from 'react';
import { CheckCircle2, GraduationCap, RotateCcw } from 'lucide-react';
import type { StudyStats } from './WfNewStudyProgress';
import { studyT } from './WfNewStudyLocales';

interface WfNewStudyStatsBarProps {
  stats: StudyStats;
  dailyGoal: number;
  lang: string;
}

const pct = (num: number, den: number): number =>
  den <= 0 ? 0 : Math.min(100, Math.round((num / den) * 100));

export const WfNewStudyStatsBar: React.FC<WfNewStudyStatsBarProps> = ({
  stats,
  dailyGoal,
  lang,
}) => {
  const masteredPct = pct(stats.mastered, stats.total);
  const dailyPct = pct(stats.dailyHandled, dailyGoal);
  const sessionPct = pct(stats.sessionHandled, stats.total);

  const bars: Array<{ key: string; label: string; value: number; color: string }> = [
    { key: 'mastered', label: studyT(lang, 'study.stats.mastered'), value: masteredPct, color: 'bg-emerald-500' },
    { key: 'daily', label: studyT(lang, 'study.stats.dailyGoal'), value: dailyPct, color: 'bg-indigo-500' },
    { key: 'session', label: studyT(lang, 'study.stats.session'), value: sessionPct, color: 'bg-amber-500' },
  ];

  const chips: Array<{ key: string; label: string; value: number; icon: React.ReactNode; cls: string }> = [
    {
      key: 'mastered',
      label: studyT(lang, 'study.stats.mastered'),
      value: stats.mastered,
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      cls: 'bg-emerald-500/10 text-emerald-400',
    },
    {
      key: 'learning',
      label: studyT(lang, 'study.stats.learning'),
      value: stats.learning,
      icon: <GraduationCap className="w-3.5 h-3.5" />,
      cls: 'bg-indigo-500/10 text-indigo-400',
    },
    {
      key: 'due',
      label: studyT(lang, 'study.stats.due'),
      value: stats.due,
      icon: <RotateCcw className="w-3.5 h-3.5" />,
      cls: 'bg-amber-500/10 text-amber-400',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Progress bars */}
      <div className="space-y-2.5">
        {bars.map((b) => (
          <div key={b.key} className="space-y-1">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-zinc-500">{b.label}</span>
              <span className="text-zinc-400 font-bold">{b.value}%</span>
            </div>
            <div className="w-full bg-white/5 dark:bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
              <div
                className={`${b.color} h-full rounded-full transition-all duration-700`}
                style={{ width: `${b.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Count chips */}
      <div className="grid grid-cols-3 gap-2">
        {chips.map((c) => (
          <div
            key={c.key}
            className={`flex flex-col items-center gap-1 py-2.5 rounded-xl ${c.cls}`}
          >
            <div className="flex items-center gap-1">
              {c.icon}
              <span className="text-lg font-black font-mono leading-none">{c.value}</span>
            </div>
            <span className="text-[9px] uppercase font-mono tracking-wide opacity-80">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
