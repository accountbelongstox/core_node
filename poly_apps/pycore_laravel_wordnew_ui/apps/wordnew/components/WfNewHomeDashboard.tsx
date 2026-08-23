/**
 * WfNewHomeDashboard — the home page's unified learning DASHBOARD (mobile-first).
 *
 * Merges what used to be two separate panels (the "learning bento" metrics row +
 * the "Today's Study Command / Words Decoded / Flame Streak" cards) into ONE
 * adaptive dashboard, and wires every figure to a REAL backend value
 * (GET /user/statistics — see WfNewStatistics):
 *   - a circular "Today's Command" ring (today_progress / daily_goal) + streak,
 *   - a responsive KPI grid (learned / mastered / learning / review / accuracy /
 *     study-days),
 *   - a 7-day check-in strip from weekly_progress,
 *   - an always-editable SETTINGS row (target language + daily goal + current
 *     group) whose Save persists when logged in, or prompts login when not.
 *
 * Adaptive auth behaviour (per spec):
 *   - LOGGED OUT: the whole dashboard still renders and the settings are editable,
 *     but the live-stats area is locked behind a "log in to unlock" CTA, and Save
 *     routes to login (onSave decides — it prompts when unauthenticated).
 *   - LOGGED IN: real stats fill in and Save writes through to the backend.
 *
 * Pure presentation: data + persistence come from props (WfNewApp owns the fetch
 * + the save/login routing).
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
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
import type { WfNewStatistics, WfNewLanguage } from '../api';

interface WfNewHomeDashboardProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  lang: string;
  isLoggedIn: boolean;
  /** Commander identity shown in the panel header. */
  nickname: string;
  avatarUrl: string;
  /** Real stats (logged in); null when logged out / not loaded. */
  stats: WfNewStatistics | null;
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

/** Compact KPI tile. */
const Kpi: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; accent: string }> = ({ icon, label, value, accent }) => (
  <div className="p-3 sm:p-3.5 rounded-2xl bg-white/5 border border-white/5">
    <div className={`flex items-center gap-1.5 text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider ${accent}`}>
      {icon}<span className="truncate">{label}</span>
    </div>
    <div className="mt-1.5 text-xl sm:text-2xl font-black font-mono text-slate-100 leading-none">{value}</div>
  </div>
);

export const WfNewHomeDashboard: React.FC<WfNewHomeDashboardProps> = ({
  activeTheme, trans, lang, isLoggedIn, nickname, avatarUrl, stats, groupName, groupCount,
  targetLang, dailyGoal, languageOptions, onSave, onOpenGroup,
}) => {
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
  const goal = isLoggedIn && stats ? stats.dailyGoal || draftGoal : draftGoal;
  const today = isLoggedIn && stats ? stats.todayProgress : 0;
  const pct = goal > 0 ? Math.min(100, Math.round((today / goal) * 100)) : 0;
  const streak = stats?.currentStreak ?? 0;
  const weekly = stats?.weeklyProgress?.length === 7 ? stats.weeklyProgress : [0, 0, 0, 0, 0, 0, 0];
  const weekMax = Math.max(1, ...weekly);

  // Circular ring geometry.
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 sm:p-5 rounded-3xl border border-white/5 shadow-lg bg-slate-900/50 ${activeTheme.glowClass || ''} space-y-5`}
    >
      {/* The whole stats dashboard renders ONLY when logged in. When logged out
          it is simply absent (no "log in to unlock" prompt); the learning
          settings row below stays visible either way. */}
      {isLoggedIn && (<>
      {/* ── Header: the original date stays on the LEFT; the logged-in user
            greeting moves to the RIGHT and shows the USERNAME ONLY (no avatar —
            the top nav bar already renders the avatar). ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] text-zinc-500 font-mono shrink-0">
          {new Date().toLocaleDateString()}
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-fuchsia-400 truncate">
            {trans('welcome.back')}
          </p>
          <p className="mt-0.5 text-base sm:text-xl font-black tracking-tight truncate bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-indigo-100 to-white">
            {nickname || 'Commander'}
          </p>
        </div>
      </div>

      {/* ── BENTO stats grid — a hero "Today's Command" tile (ring left, big
            number on the RIGHT) spanning 2×2, KPI tiles + a wide check-in strip
            filling the rest. ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[84px] sm:auto-rows-[92px] gap-2.5 sm:gap-3">
        {/* HERO: Today's Study Command — col-span-2, row-span-2 */}
        <div className="col-span-2 row-span-2 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-fuchsia-950/20 border border-indigo-500/10 flex items-center justify-between gap-3">
          {/* progress ring (left) */}
          <div className="relative shrink-0 w-[92px] h-[92px] sm:w-[104px] sm:h-[104px]">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
              <motion.circle
                cx="40" cy="40" r={R} fill="none" stroke="url(#wfn-ring)" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - pct / 100) }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="wfn-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#818cf8" /><stop offset="100%" stopColor="#e879f9" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-black font-mono text-white leading-none">{pct}%</span>
              <span className="text-[8px] font-mono text-indigo-300 uppercase">{trans('goal.title')}</span>
            </div>
          </div>
          {/* recited count + streak (RIGHT) */}
          <div className="min-w-0 text-right">
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-300 flex items-center justify-end gap-1.5">
              {trans('home.todayRecite')} <Target className="w-3.5 h-3.5" />
            </p>
            <p className="mt-1 text-3xl sm:text-4xl font-black font-mono text-white leading-none">
              {today}<span className="text-lg sm:text-xl text-indigo-300 font-medium"> / {goal}</span>
            </p>
            <div className="mt-2 flex items-center justify-end gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-orange-400"><Flame className="w-3.5 h-3.5" /> {streak}{trans('stats.days')}</span>
              <span className="flex items-center gap-1 text-emerald-400"><GraduationCap className="w-3.5 h-3.5" /> {stats?.totalWordsLearned ?? 0}</span>
            </div>
          </div>
        </div>

        {/* KPI tiles fill the 2×2 block beside the hero */}
        <Kpi icon={<GraduationCap className="w-3 h-3" />} label={trans('stats.learned')} accent="text-indigo-400" value={stats?.totalWordsLearned ?? 0} />
        <Kpi icon={<Sparkles className="w-3 h-3" />} label={trans('dashboard.mastered')} accent="text-emerald-400" value={stats?.masteredWords ?? 0} />
        <Kpi icon={<Layers className="w-3 h-3" />} label={trans('dashboard.learning')} accent="text-sky-400" value={stats?.learningWords ?? 0} />
        <Kpi icon={<RefreshCw className="w-3 h-3" />} label={trans('home.needReview')} accent="text-amber-400" value={stats?.needsReview ?? 0} />

        {/* Check-in 7-day strip — wide tile (col-span-2) */}
        <div className="col-span-2 p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-300">
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>{trans('home.checkIn')}</span>
            <span className="ml-auto text-amber-400">🔥 {streak}{trans('stats.days')}</span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-1.5 h-10">
            {weekly.map((n, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div
                  className={`w-full rounded-md transition-all ${n > 0 ? 'bg-gradient-to-t from-indigo-500 to-fuchsia-400' : 'bg-white/8'}`}
                  style={{ height: `${Math.max(14, Math.round((n / weekMax) * 100))}%` }}
                  title={`${n}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Remaining KPIs fill the last row beside the check-in strip */}
        <Kpi icon={<TrendingUp className="w-3 h-3" />} label={trans('dashboard.accuracy')} accent="text-fuchsia-400" value={`${stats?.averageAccuracy ?? 0}%`} />
        <Kpi icon={<CalendarCheck className="w-3 h-3" />} label={trans('dashboard.studyDays')} accent="text-cyan-400" value={stats?.studyDays ?? 0} />
      </div>
      </>)}

      {/* ── Settings (always editable) — target language + daily goal + group ── */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> {trans('dashboard.settingsTitle')}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Target language(s) — opens the SHARED floating language panel. */}
          <div className="block">
            <span className="text-[9px] font-mono uppercase tracking-wider text-indigo-400 flex items-center gap-1"><Languages className="w-3 h-3" /> {trans('home.targetLang')}</span>
            <button
              type="button"
              onClick={() => setLangPanelOpen(true)}
              className={`mt-1.5 w-full py-2 px-3 text-xs font-mono rounded-xl outline-none text-left flex items-center justify-between gap-2 cursor-pointer ${activeTheme.inputClass}`}
            >
              <span className="truncate">
                {getLanguageConfig(targetLangs[0] || draftLang).flag}{' '}
                {targetLangs.map((c) => getLanguageConfig(c).nativeName).join(' · ') || langCfg.nativeName}
              </span>
              <Languages className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            </button>
          </div>

          {/* Daily goal — the SHARED editor (writes wfNewSettings + roams the
              value to the backend itself, so it needs no Save and stays in
              sync with every other editor instance); replaces the old local
              −/+ draft stepper. Save below still re-saves the LIVE store goal
              (never a stale draft) together with the target language. */}
          <div className="flex items-center">
            <WfNewDailyGoalEditor lang={lang} className="flex-1" />
          </div>

          {/* Current group (read-only) */}
          <div className="block">
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1"><BookOpen className="w-3 h-3" /> {trans('home.currentGroup')}</span>
            <button
              type="button"
              onClick={onOpenGroup}
              className="mt-1.5 w-full py-2 px-3 rounded-xl bg-white/5 border border-white/5 text-left hover:border-indigo-500/30 hover:bg-indigo-500/10 transition-colors"
              title={trans('home.openCurrentGroup')}
            >
              <div className="text-xs font-black truncate text-slate-100">{groupName || '—'}</div>
              <div className="text-[10px] text-indigo-300 font-mono underline decoration-indigo-500/40 underline-offset-2">{groupCount} {trans('profile.wordsUnit')}</div>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {!isLoggedIn && <span className="block text-center text-[10px] font-mono text-amber-400">{trans('dashboard.loginHint')}</span>}
          <button
            type="button"
            onClick={() => onSave({ targetLang: draftLang, dailyGoal: wfNewSettings.get('dailyGoal') })}
            disabled={isLoggedIn && !dirty}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            {isLoggedIn ? trans('dashboard.save') : trans('dashboard.saveLogin')}
          </button>
        </div>
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
