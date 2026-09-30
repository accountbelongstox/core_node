/**
 * WfNewHomeDashboard — the home learning dashboard. Logged in: a compact bento
 * (greeting, today ring, KPIs, 7-day strip) fed by the shared learning-stats
 * center. Always: the editable learning-settings row (Save persists when
 * logged in, routes to login when not — the host's onSave decides).
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, LogIn, type LucideIcon,
  Languages, BookOpen, RefreshCw, GraduationCap, Flame, CalendarCheck,
  Target, Sparkles, Save, TrendingUp, Layers,
} from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';
import { getLanguageConfig } from '../WfNewLocales';
import { WfNewLanguagePanel } from './WfNewLanguagePanel';
import { wfNewSettings } from '../WfNewSettingsStore';
// Shared daily-goal editor (◀ input ▶) — writes wfNewSettings + roams the
// value to the backend itself; see ./WfNewDailyGoalEditor.
import { WfNewDailyGoalEditor } from './WfNewDailyGoalEditor';
import type { WfNewLanguage } from '../api';
import { useWordNewLearningStats } from '../services/WordNewLearningStatsCenter';

interface WfNewHomeDashboardProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  lang: string;
  isLoggedIn: boolean;
  nickname: string;
  /** Current default learning group (from the backend groups). */
  groupName: string;
  groupCount: number;
  /** Editable settings — initial values; the component keeps a local draft. */
  targetLang: string;
  dailyGoal: number;
  /** Target-language options for the selector (backend supported languages). */
  languageOptions: WfNewLanguage[];
  /** Persist settings when logged in, or prompt login when not (WfNewApp decides). */
  onSave: (next: { targetLang: string; dailyGoal: number }) => void;
  onOpenGroup: () => void;
}

/** Bento chip: icon + value only; the label lives in the tooltip / accessible name. */
const Chip: React.FC<{ icon: LucideIcon; label: string; value: React.ReactNode; accent: string }> = ({ icon: Icon, label, value, accent }) => (
  <div
    className="min-w-0 flex items-center justify-center gap-1.5 px-2 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-900/5 dark:border-white/5"
    title={label}
    aria-label={`${label}: ${value}`}
  >
    <Icon className={`w-4 h-4 shrink-0 ${accent}`} />
    <span className="truncate text-sm font-black font-mono text-slate-900 dark:text-slate-100">{value}</span>
  </div>
);

const PILL = 'h-9 min-w-0 flex items-center gap-2 px-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-900/5 dark:border-white/10 transition-colors';

export const WfNewHomeDashboard: React.FC<WfNewHomeDashboardProps> = ({
  activeTheme, trans, lang, isLoggedIn, nickname, groupName, groupCount,
  targetLang, dailyGoal, languageOptions, onSave, onOpenGroup,
}) => {
  const liveStats = useWordNewLearningStats();
  const stats = isLoggedIn ? liveStats : null;
  // Local editable draft (kept in sync when the upstream values change).
  const [draftLang, setDraftLang] = useState(targetLang);
  const [draftGoal, setDraftGoal] = useState(dailyGoal);
  useEffect(() => setDraftLang(targetLang), [targetLang]);
  useEffect(() => setDraftGoal(dailyGoal), [dailyGoal]);
  const dirty = draftLang !== targetLang || draftGoal !== dailyGoal;

  const langCfg = getLanguageConfig(draftLang);

  // Shared floating language panel (native + MULTIPLE targets) — same component
  // used in Settings. The panel syncs to the backend itself; here we mirror the
  // result into the local draft + the settings store.
  const [langPanelOpen, setLangPanelOpen] = useState(false);
  const [nativeLang, setNativeLang] = useState<string>(() => wfNewSettings.get('settingNativeLang'));
  const [targetLangs, setTargetLangs] = useState<string[]>(() => {
    const stored = wfNewSettings.get('settingTargetLangs');
    return Array.isArray(stored) && stored.length ? stored : [targetLang];
  });

  // Live figures (real when logged in, otherwise 0 / draft goal).
  const goal = stats ? stats.dailyGoal || draftGoal : draftGoal;
  const today = stats ? stats.todayProgress : 0;
  const pct = goal > 0 ? Math.min(100, Math.round((today / goal) * 100)) : 0;
  const streak = stats?.currentStreak ?? 0;
  const weekly = stats?.weeklyProgress?.length === 7 ? stats.weeklyProgress : [0, 0, 0, 0, 0, 0, 0];
  const weekMax = Math.max(1, ...weekly);

  // Circular ring geometry.
  const R = 34;
  const C = 2 * Math.PI * R;

  const targetLabel = targetLangs.map((c) => getLanguageConfig(c).nativeName).join(' · ') || langCfg.nativeName;
  const saveLabel = isLoggedIn ? trans('dashboard.save') : trans('dashboard.saveLogin');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-2.5 sm:p-3 rounded-3xl border border-indigo-500/10 shadow-lg bg-gradient-to-br from-indigo-50/80 via-white/60 to-fuchsia-50/70 dark:from-slate-900/70 dark:via-slate-900/50 dark:to-indigo-950/40 backdrop-blur-xl ${activeTheme.glowClass || ''} space-y-2.5`}
    >
      {isLoggedIn && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 min-w-0 px-1">
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <p className="min-w-0 flex-1 truncate text-sm font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-fuchsia-600 dark:from-indigo-300 dark:to-fuchsia-300" title={trans('welcome.back')}>
              {nickname}
            </p>
            <span className="shrink-0 text-[10px] text-zinc-500 font-mono">{new Date().toLocaleDateString(lang)}</span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 auto-rows-[44px] gap-1.5">
            <div
              className="col-span-2 row-span-2 min-w-0 px-2.5 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/10 border border-indigo-500/15 flex items-center gap-2.5"
              title={trans('home.todayRecite')}
            >
              <div className="relative shrink-0 w-16 h-16">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r={R} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-900/10 dark:text-white/10" />
                  <motion.circle
                    cx="40" cy="40" r={R} fill="none" stroke="url(#wfn-ring)" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - pct / 100) }}
                    transition={{ duration: 1.1, ease: 'easeOut' }}
                  />
                  <defs>
                    <linearGradient id="wfn-ring" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#818cf8" /><stop offset="100%" stopColor="#e879f9" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-black font-mono text-slate-900 dark:text-white">{pct}%</span>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-black font-mono leading-none truncate text-slate-900 dark:text-white">
                  <span className="text-2xl">{today}</span>
                  <span className="text-xs text-indigo-600 dark:text-indigo-300"> / {goal}</span>
                </p>
                <p className="flex items-center gap-1 text-xs font-black font-mono text-orange-500 dark:text-orange-400 min-w-0" title={trans('home.checkIn')}>
                  <Flame className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{streak}</span>
                </p>
              </div>
            </div>

            <Chip icon={GraduationCap} label={trans('stats.learned')} accent="text-indigo-500 dark:text-indigo-400" value={stats?.totalWordsLearned ?? 0} />
            <Chip icon={Sparkles} label={trans('dashboard.mastered')} accent="text-emerald-500 dark:text-emerald-400" value={stats?.masteredWords ?? 0} />
            <Chip icon={Layers} label={trans('dashboard.learning')} accent="text-sky-500 dark:text-sky-400" value={stats?.learningWords ?? 0} />
            <Chip icon={RefreshCw} label={trans('home.needReview')} accent="text-amber-500 dark:text-amber-400" value={stats?.needsReview ?? 0} />
            <Chip icon={TrendingUp} label={trans('dashboard.accuracy')} accent="text-fuchsia-500 dark:text-fuchsia-400" value={`${stats?.averageAccuracy ?? 0}%`} />
            <Chip icon={CalendarCheck} label={trans('dashboard.studyDays')} accent="text-cyan-500 dark:text-cyan-400" value={stats?.studyDays ?? 0} />

            <div
              className="col-span-2 min-w-0 flex items-center gap-2 px-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-900/5 dark:border-white/5"
              title={trans('home.checkIn')}
            >
              <BarChart3 className="w-4 h-4 shrink-0 text-indigo-500 dark:text-indigo-300" />
              <div className="flex-1 flex items-end gap-1 h-6">
                {weekly.map((n, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm ${n > 0 ? 'bg-gradient-to-t from-indigo-500 to-fuchsia-400' : 'bg-slate-900/10 dark:bg-white/10'}`}
                    style={{ height: `${Math.max(20, Math.round((n / weekMax) * 100))}%` }}
                    title={`${n}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)_auto] gap-1.5" title={trans('dashboard.settingsTitle')}>
        <button
          type="button"
          onClick={() => setLangPanelOpen(true)}
          className={`${PILL} hover:border-indigo-500/40 cursor-pointer text-left`}
          title={trans('home.targetLang')}
          aria-label={`${trans('home.targetLang')}: ${targetLabel}`}
        >
          <Languages className="w-3.5 h-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
          <span className="shrink-0">{getLanguageConfig(targetLangs[0] || draftLang).flag}</span>
          <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{targetLabel}</span>
        </button>

        <div className={PILL}>
          <WfNewDailyGoalEditor lang={lang} compact />
        </div>

        <button
          type="button"
          onClick={onOpenGroup}
          className={`${PILL} hover:border-indigo-500/40 cursor-pointer text-left`}
          title={trans('home.openCurrentGroup')}
          aria-label={`${trans('home.currentGroup')}: ${groupName || '—'}`}
        >
          <BookOpen className="w-3.5 h-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" />
          <span className="truncate flex-1 text-xs font-bold text-slate-800 dark:text-slate-100">{groupName || '—'}</span>
          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-300">{groupCount}</span>
        </button>

        <button
          type="button"
          onClick={() => onSave({ targetLang: draftLang, dailyGoal: wfNewSettings.get('dailyGoal') })}
          disabled={isLoggedIn && !dirty}
          className={`h-9 flex items-center justify-center gap-1.5 px-3 rounded-xl text-white text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
            isLoggedIn ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:brightness-110'
          }`}
          title={isLoggedIn ? saveLabel : trans('dashboard.loginHint')}
          aria-label={saveLabel}
        >
          {isLoggedIn ? <Save className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Shared floating language panel (native + multi targets), same as Settings. */}
      <WfNewLanguagePanel
        open={langPanelOpen}
        onClose={() => setLangPanelOpen(false)}
        nativeLang={nativeLang}
        targetLangs={targetLangs}
        options={languageOptions}
        onSave={(sel) => {
          setNativeLang(sel.native_language);
          setTargetLangs(sel.learning_languages);
          const primary = sel.learning_languages[0] || draftLang;
          setDraftLang(primary);
          wfNewSettings.setField('settingNativeLang', sel.native_language);
          wfNewSettings.setField('settingTargetLangs', sel.learning_languages);
          wfNewSettings.setField('settingTargetLang', primary);
          // Propagate the primary target up so the host (WfNewApp) updates too.
          // The goal half always carries the LIVE store value (the shared
          // editor owns it now), never the stale local draft.
          onSave({ targetLang: primary, dailyGoal: wfNewSettings.get('dailyGoal') });
        }}
        trans={trans}
      />
    </motion.div>
  );
};
