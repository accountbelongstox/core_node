/**
 * WfNewHomeDashboard — the home learning panel: hangs from the header (straight
 * top, arched bottom), collapsed by default to one row of core figures (today
 * ring, today / goal, streak, reviews) with a glow and a flowing border; the
 * handle expands it to the full bento (KPIs, 7-day strip) fed by the shared
 * learning-stats center, plus the editable learning-settings row (Save persists
 * when logged in, routes to login when not — the host's onSave decides).
 * Logged out, the collapsed row offers the shared login.
 */
import React, { useEffect, useState } from 'react';
import { requestAuthLogin } from '../../../core/auth/AuthRequestCenter';
import { motion } from 'framer-motion';
import { ProgressRing } from '@/shared/ui/ProgressRing';
import { percentOf } from '../../../core/utils/mathUtils';
import {
  BarChart3, LogIn, type LucideIcon,
  Languages, BookOpen, RefreshCw, GraduationCap, Flame, CalendarCheck,
  Sparkles, Save, TrendingUp, Layers, ChevronDown,
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

/** Straight top, arched bottom (the panel hangs from the header). */
const ARC_STYLE: React.CSSProperties = { borderBottomLeftRadius: '50% 2.25rem', borderBottomRightRadius: '50% 2.25rem' };
const RING_GRADIENT = ['#818cf8', '#e879f9'] as const;
const RING_TRACK = 'text-slate-900/10 dark:text-white/10';
const RING_RADIUS = 42.5;
const RING_STROKE = 10;
const MINI_RING_RADIUS = 41.5;
const MINI_RING_STROKE = 11;
const RING_ANIMATION_SECONDS = 1.1;

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
  const [expanded, setExpanded] = useState(false);
  const [nativeLang, setNativeLang] = useState<string>(() => wfNewSettings.get('settingNativeLang'));
  const [targetLangs, setTargetLangs] = useState<string[]>(() => {
    const stored = wfNewSettings.get('settingTargetLangs');
    return Array.isArray(stored) && stored.length ? stored : [targetLang];
  });

  // Live figures (real when logged in, otherwise 0 / draft goal).
  const goal = stats ? stats.dailyGoal || draftGoal : draftGoal;
  const today = stats ? stats.todayProgress : 0;
  const pct = percentOf(today, goal);
  const streak = stats?.currentStreak ?? 0;
  const weekly = stats?.weeklyProgress?.length === 7 ? stats.weeklyProgress : [0, 0, 0, 0, 0, 0, 0];
  const weekMax = Math.max(1, ...weekly);

  const targetLabel = targetLangs.map((c) => getLanguageConfig(c).nativeName).join(' · ') || langCfg.nativeName;
  const saveLabel = isLoggedIn ? trans('dashboard.save') : trans('dashboard.saveLogin');

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="relative -mx-4 -mt-8 pb-4 sm:mx-0">
      <div
        className={`relative overflow-hidden px-[1.5px] pb-[1.5px] transition-shadow duration-500 ${
          expanded ? `shadow-lg ${activeTheme.glowClass || ''}` : 'shadow-[0_18px_40px_-14px_rgba(99,102,241,0.6)] dark:shadow-[0_18px_44px_-12px_rgba(129,140,248,0.45)]'
        }`}
        style={ARC_STYLE}
      >
        {expanded ? (
          <div aria-hidden className="absolute inset-0 bg-indigo-500/15" />
        ) : (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[220%] -translate-x-1/2 -translate-y-1/2 animate-[spin_5s_linear_infinite] motion-reduce:animate-none bg-[conic-gradient(from_0deg,transparent_0deg,transparent_200deg,#818cf8_260deg,#e879f9_310deg,#22d3ee_340deg,transparent_360deg)]"
          />
        )}
        <div
          className={`relative bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950 px-3 pt-3 sm:px-4 ${expanded ? 'pb-10' : 'pb-6'}`}
          style={ARC_STYLE}
        >
          {expanded ? (
            <div className="space-y-2.5">
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
              <ProgressRing
                progress={pct / 100}
                sizeClass="h-16 w-16"
                radius={RING_RADIUS}
                strokeWidth={RING_STROKE}
                gradient={RING_GRADIENT}
                trackClassName={RING_TRACK}
                durationSec={RING_ANIMATION_SECONDS}
              >
                <span className="text-xs font-black font-mono text-slate-900 dark:text-white">{pct}%</span>
              </ProgressRing>
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

      <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)_auto] gap-1.5 px-2 sm:px-6" title={trans('dashboard.settingsTitle')}>
        <button
          type="button"
          onClick={() => setLangPanelOpen(true)}
          className={`${PILL} sm:rounded-bl-[18px] hover:border-indigo-500/40 cursor-pointer text-left`}
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
          className={`${PILL} max-sm:rounded-bl-[18px] hover:border-indigo-500/40 cursor-pointer text-left`}
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
          className={`h-9 flex items-center justify-center gap-1.5 px-3 rounded-xl rounded-br-[18px] text-white text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
            isLoggedIn ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:brightness-110'
          }`}
          title={isLoggedIn ? saveLabel : trans('dashboard.loginHint')}
          aria-label={saveLabel}
        >
          {isLoggedIn ? <Save className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
        </button>
      </div>

            </div>
          ) : (
            <div className="flex w-full min-w-0 items-center gap-2.5">
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  aria-label={trans('dashboard.expand')}
                  title={trans('dashboard.expand')}
                >
                  <ProgressRing
                    progress={pct / 100}
                    sizeClass="h-9 w-9"
                    radius={MINI_RING_RADIUS}
                    strokeWidth={MINI_RING_STROKE}
                    gradient={RING_GRADIENT}
                    trackClassName={RING_TRACK}
                  >
                    <span className="text-[9px] font-black font-mono text-slate-900 dark:text-white">{pct}%</span>
                  </ProgressRing>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      <span className="truncate text-sm font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-fuchsia-600 dark:from-indigo-300 dark:to-fuchsia-300">{nickname}</span>
                    </span>
                    <span className="block font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200" title={trans('home.todayRecite')}>
                      {today}<span className="text-indigo-600 dark:text-indigo-300"> / {goal}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-orange-500/10 px-2 py-1 text-xs font-black font-mono text-orange-500 dark:text-orange-400" title={trans('home.checkIn')}>
                    <Flame className="h-3.5 w-3.5" />{streak}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-black font-mono text-amber-600 dark:text-amber-400" title={trans('home.needReview')}>
                    <RefreshCw className="h-3.5 w-3.5" />{stats?.needsReview ?? 0}
                  </span>
                </button>
              ) : (
                <>
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500 dark:text-indigo-300">
                    <LogIn className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700 dark:text-slate-200">{trans('dashboard.loginHint')}</span>
                  <button
                    type="button"
                    onClick={() => requestAuthLogin({ source: 'wordnew-home', reason: 'login-action' })}
                    className="shrink-0 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-3 py-1.5 text-[11px] font-bold text-white hover:brightness-110"
                  >
                    {trans('common.login')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-label={trans(expanded ? 'dashboard.collapse' : 'dashboard.expand')}
        title={trans(expanded ? 'dashboard.collapse' : 'dashboard.expand')}
        className="absolute bottom-0 left-1/2 z-10 inline-flex h-8 w-14 -translate-x-1/2 items-center justify-center rounded-full border border-indigo-500/20 bg-white text-indigo-500 shadow-md hover:text-fuchsia-500 dark:bg-slate-900 dark:text-indigo-300"
      >
        <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      </button>

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
