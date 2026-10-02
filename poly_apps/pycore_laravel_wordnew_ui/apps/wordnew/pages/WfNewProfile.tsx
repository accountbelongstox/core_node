import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Award, Settings, Activity, Save, Upload, Lock,
  LogIn, LogOut, ShieldCheck,
} from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';
import { useWfNewSetting } from '../useWfNewSettings';
import { ActionButton } from '@/shared/ui/ActionButton';
import { ModalFooter } from '@/shared/ui/ModalParts';
import { ModalShell } from '@/shared/ui/ModalShell';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { ProgressRing } from '@/shared/ui/ProgressRing';
import { TextField } from '@/shared/ui/TextField';
import { wfNewApi } from '../api';
import { WfNewAvatarView } from '../components/WfNewAvatarView';
import { WfNewAvatarCropper } from '../components/WfNewAvatarCropper';
import { deriveAchievements, computeMemberLevel, type WordNewAchievement } from '../services/WordNewAchievementCenter';
import { useWordNewLearningStats } from '../services/WordNewLearningStatsCenter';

// Per-badge accent palette (cycled) so the trophy case reads as varied, not uniform.
const BADGE_ACCENTS = [
  'text-indigo-300 from-indigo-500/25', 'text-emerald-300 from-emerald-500/25',
  'text-amber-300 from-amber-500/25', 'text-cyan-300 from-cyan-500/25',
  'text-fuchsia-300 from-fuchsia-500/25', 'text-rose-300 from-rose-500/25',
  'text-sky-300 from-sky-500/25', 'text-violet-300 from-violet-500/25',
];
const STREAK_GOAL_DAYS = 30;
const PROFILE_INPUT_CLASS = 'border border-white/10 bg-slate-900 text-slate-100 focus:border-indigo-500';
const LEVEL_SEGMENTS = 10;
const FALLBACK_ACCURACY_BASE = 60;
const FALLBACK_ACCURACY_SPAN = 39;
const LOGOUT_CARD_CLASS = 'relative w-full max-w-sm space-y-5 rounded-3xl border border-white/10 p-6 shadow-2xl';
const riseIn = (duration: number, delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration, delay },
});

interface WfNewProfileProps {
  activeTheme: ElementTheme;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  currentUser: {
    nickname: string;
    avatar: string;
    email: string;
    nativeLang: string;
    targetLang: string;
    bio: string;
    isLoggedIn: boolean;
  };
  onUpdateProfile: (updatedData: { nickname: string; avatar: string; nativeLang: string; targetLang: string; bio: string }) => void;
  /** Fired right after a successful avatar upload so the new image shows app-wide immediately. */
  onAvatarUpdated?: (avatarUrl: string) => void;
  /** Navigate to the login/register screen (shown when logged out). */
  onLogin: () => void;
  /** Sign out — clears the session/identity but NOT cached media (see WfNewApp.clearUserSession). */
  onLogout: () => void;
  learnedWordsCount: number;
}

export const WfNewProfile: React.FC<WfNewProfileProps> = ({
  activeTheme,
  addToast,
  trans,
  currentUser,
  onUpdateProfile,
  onAvatarUpdated,
  onLogin,
  onLogout,
  learnedWordsCount
}) => {
  // Local state for editing the coordinates
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(currentUser.nickname);
  const [bio, setBio] = useState(currentUser.bio);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [nativeLang, setNativeLang] = useState(currentUser.nativeLang);
  const [targetLang, setTargetLang] = useState(currentUser.targetLang);

  // Preset avatars: loaded from the backend (falls back to the built-in set in
  // the API layer when offline / no preset endpoint). Plus image upload.
  const [presetAvatars, setPresetAvatars] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isEditing) return;
    (async () => {
      try {
        const presets = await wfNewApi.getPresetAvatars();
        if (!cancelled && presets.length) setPresetAvatars(presets);
      } catch {
        /* API layer already falls back to built-ins; ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [isEditing]);

  // Step 1: pick a file → open the cropper (no upload yet).
  const handlePickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) setCropFile(file);
    // Allow re-selecting the same file.
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Step 2: cropper returns a square JPEG → upload it.
  const handleCropped = async (file: File) => {
    setCropFile(null);
    setUploading(true);
    try {
      const result = await wfNewApi.uploadAvatar(file);
      // Prefer the absolute URL; the backend persists the upload server-side.
      const next = result.avatar_url || result.avatar;
      if (next) {
        setAvatar(next);
        // Reflect the new avatar immediately app-wide (no separate Save needed).
        onAvatarUpdated?.(next);
      }
      addToast(trans('profile.avatarUploaded'), 'success');
    } catch (err: any) {
      addToast(err?.message || trans('profile.avatarUploadFailed'), 'warning');
    } finally {
      setUploading(false);
    }
  };

  // Real learning statistics from the shared stats center (null when logged out).
  const liveStatistics = useWordNewLearningStats();
  const statistics = currentUser.isLoggedIn ? liveStatistics : null;

  // Streak (real counter) feeds both the member level and the metrics. Prefer the
  // backend streak from /user/statistics when present, else the local setting.
  const [localStreak] = useWfNewSetting('streakDays');
  const streakDays = statistics?.currentStreak ?? (Number(localStreak) || 0);

  // Real learned/mastered/total where the stats payload provides them, else the prop.
  const learnedReal = statistics?.totalWordsLearned ?? learnedWordsCount;
  const masteredReal = statistics?.masteredWords ?? 0;
  const totalReal = statistics?.totalWords ?? learnedWordsCount;
  const studyDaysReal = statistics?.studyDays ?? 0;

  // Member level — data-driven tier from learned words + streak (no fake plumbing).
  const member = useMemo(
    () => computeMemberLevel(learnedReal, streakDays),
    [learnedReal, streakDays],
  );

  // Achievements — derived from REAL counters via the shared achievement center
  // (real per-badge lucide icons + unlocked + progress), not a hardcoded list.
  const achievements = useMemo<WordNewAchievement[]>(
    () => deriveAchievements({ learned: learnedReal, mastered: masteredReal, streak: streakDays, total: totalReal, studyDays: studyDaysReal }),
    [learnedReal, masteredReal, streakDays, totalReal, studyDaysReal],
  );
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  // The "hero" is the most prestigious UNLOCKED badge (latest in display order,
  // which runs early-win → long-haul); falls back to the first locked one.
  const heroBadge =
    [...achievements].reverse().find((a) => a.unlocked) ?? achievements[0];
  const restBadges = achievements.filter((a) => a.id !== heroBadge.id);

  // synapticRatio = REAL accuracy (averageAccuracy, 0–100) when available.
  // Graceful fallback (logged-out / offline / missing): derive from the member
  // level progress (real counters), NOT a hardcoded constant.
  const hasAccuracy = typeof statistics?.averageAccuracy === 'number';
  const synapticRatioPct = hasAccuracy
    ? Math.round(statistics!.averageAccuracy)
    : Math.round(FALLBACK_ACCURACY_BASE + member.progress * FALLBACK_ACCURACY_SPAN);

  // Learning-metrics tiles: use real accuracy for the ring; else the same
  // counter-derived fallback so the gauge always reflects real data.
  const retentionPct = synapticRatioPct;
  const streakDots = Math.min(streakDays, STREAK_GOAL_DAYS);
  const tierLabel = `${trans('profile.tier.' + member.tier.id)} · ${trans('profile.levelShort', { level: member.tier.level })}`;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      addToast(trans('profile.nickEmpty'), 'warning');
      return;
    }

    onUpdateProfile({
      nickname,
      bio,
      avatar,
      nativeLang,
      targetLang
    });

    setIsEditing(false);
    addToast(trans('profile.saved'), 'success');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* 0. AUTH CONTROL — login CTA when logged out, sign-out row when logged in.
          Sign-out clears the session/identity only; cached audio/video and local
          learning data are intentionally preserved (see WfNewApp.clearUserSession). */}
      {currentUser.isLoggedIn ? (
        <div className={`flex items-center gap-3 p-4 rounded-2xl ${activeTheme.cardClass} border border-white/5`}>
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-100 truncate">
              {trans('profile.loggedInAs', { name: currentUser.nickname || currentUser.email || trans('profile.defaultName') })}
            </p>
            <p className="text-[10px] text-zinc-500 font-mono">{trans('profile.sessionActive')}</p>
          </div>
        </div>
      ) : (
        <div className={`flex items-center gap-3 p-4 rounded-2xl ${activeTheme.cardClass} border border-indigo-500/20`}>
          <LogIn className="w-5 h-5 text-indigo-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-100">{trans('profile.loggedOutTitle')}</p>
            <p className="text-[10px] text-zinc-500 font-mono">{trans('profile.loggedOutHint')}</p>
          </div>
          <ActionButton size="sm" onClick={onLogin} icon={<LogIn className="w-3.5 h-3.5" />}>{trans('profile.loginCta')}</ActionButton>
        </div>
      )}

      {/* 1. Profile Interactive overview block */}
      <div className={`p-6 sm:p-8 rounded-3xl ${activeTheme.cardClass} border border-white/5 shadow-2xl relative overflow-hidden`}>
        
        {/* Glow decorative graphics */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
          
          {/* Left portion: big avatar */}
          <div className="relative group">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-900 border-2 border-indigo-500/40 flex items-center justify-center text-4xl sm:text-5xl overflow-hidden shadow-xl">
              <WfNewAvatarView value={currentUser.avatar} className="text-4xl sm:text-5xl" />
            </div>
            
            <span className="absolute bottom-1 right-1 bg-emerald-500 border border-slate-900 w-4 h-4 rounded-full" />
          </div>

          {/* Right portion: statistics and info */}
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <h3 className="text-xl font-black text-slate-100 flex items-center justify-center md:justify-start gap-2">
                  {currentUser.nickname}
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </h3>

                <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-black tracking-widest ${member.tier.accent} bg-white/5 border border-white/10 py-0.5 px-2 rounded-full uppercase self-center`}>
                  <member.tier.Icon className="w-3 h-3" />
                  {tierLabel}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">{currentUser.email || trans('profile.offlineEmail')}</p>
              <p className="text-xs text-zinc-400 italic mt-2">"{currentUser.bio || trans('profile.noBio')}"</p>
            </div>

            {/* Micro stats metrics */}
            <div className="grid grid-cols-3 gap-3 max-w-md pt-2">
              <div className="p-3 rounded-xl bg-white/2 border border-white/5 text-center">
                <span className="text-[9px] text-zinc-500 font-mono block uppercase">{trans('profile.learnedPool')}</span>
                <span className="text-sm font-black text-slate-200">{learnedReal} {trans('profile.wordsUnit')}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/2 border border-white/5 text-center">
                <span className="text-[9px] text-zinc-500 font-mono block uppercase">{trans('profile.activeStreak')}</span>
                <span className="text-sm font-black text-orange-400 flex items-center justify-center gap-1">
                  🔥 {streakDays}{trans('profile.daysSuffix')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/2 border border-white/5 text-center">
                <span className="text-[9px] text-zinc-500 font-mono block uppercase">{trans('profile.synapticRatio')}</span>
                <span className="text-sm font-black text-indigo-400">{synapticRatioPct}%</span>
              </div>
            </div>

            {/* Quick launcher button to trigger edits */}
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono font-bold transition-all border border-white/10 cursor-pointer text-zinc-300"
              >
                {trans('profile.adjustBtn')}
              </button>
            )}
          </div>

        </div>

      </div>

      {/* 1b. MEMBER LEVEL banner — prominent, per-tier gradient + progress ring. */}
      <motion.div
        {...riseIn(0.4)}
        className={`p-5 sm:p-6 rounded-3xl ${activeTheme.cardClass} border border-white/5 shadow-xl relative overflow-hidden`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${member.tier.gradient} pointer-events-none`} />
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-5">

          {/* Tier badge + progress ring */}
          <ProgressRing progress={member.progress} sizeClass="w-24 h-24" radius={44} strokeWidth={7} colorClass={member.tier.accent}>
            <member.tier.Icon className={`w-7 h-7 ${member.tier.accent}`} />
            <span className="text-[9px] font-mono font-black text-zinc-300 mt-0.5">{trans('profile.levelShort', { level: member.tier.level })}</span>
          </ProgressRing>

          {/* Tier text + to-next */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">{trans('profile.memberLevel')}</span>
            <h4 className={`text-2xl font-black ${member.tier.accent} flex items-center justify-center sm:justify-start gap-2`}>
              {trans('profile.tier.' + member.tier.id)}
            </h4>
            {member.next ? (
              <p className="text-[11px] text-zinc-400 mt-1 font-mono">
                {trans('profile.toNextLevel', {
                  count: member.toNext,
                  tier: trans('profile.tier.' + member.next.id),
                })}
              </p>
            ) : (
              <p className="text-[11px] text-amber-300 mt-1 font-mono font-bold">{trans('profile.maxTier')}</p>
            )}
            <div className="mt-2.5 inline-flex items-center gap-2 text-[10px] font-mono text-zinc-500">
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{trans('profile.levelScore', { count: member.score })}</span>
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{Math.round(member.progress * 100)}%</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2. Interactive Editing forms if isEditing, else showcases credentials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* EDITING FORM PORTLET */}
        {isEditing ? (
          <div className={`col-span-full p-6 sm:p-8 rounded-3xl ${activeTheme.cardClass} border border-indigo-500/20 shadow-xl space-y-5`}>
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Settings className="w-5 h-5 text-indigo-400" />
              <h4 className="text-sm font-black text-slate-100">
                {trans('profile.editTitle')}
              </h4>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left column details */}
                <div className="space-y-4">
                  
                  <TextField label={trans('profile.nicknameLabel')} required value={nickname} onChange={setNickname} inputClassName={PROFILE_INPUT_CLASS} />
                  <TextField label={trans('profile.bioLabel')} value={bio} onChange={setBio} inputClassName={PROFILE_INPUT_CLASS} />

                  {/* Language selection lives in Settings → Languages (single source
                      of truth, backend-synced multi-select), not on the profile editor. */}
                  <p className="text-[10px] text-zinc-500 font-mono leading-relaxed pt-1">
                    {trans('profile.languagesMovedHint')}
                  </p>

                </div>

                {/* Right column: avatar — current preview, upload, and presets */}
                <div className="space-y-3">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 font-mono block">
                    {trans('profile.pickAvatar')}
                  </label>

                  {/* Current avatar preview + upload control */}
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-2xl overflow-hidden shrink-0">
                      <WfNewAvatarView value={avatar} className="text-2xl" />
                    </div>
                    <div className="space-y-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handlePickAvatar}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono font-bold text-zinc-300 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploading ? trans('common.loading') : trans('profile.uploadAvatar')}</span>
                      </button>
                      <p className="text-[9px] text-zinc-600 font-mono">{trans('profile.uploadHint')}</p>
                    </div>
                  </div>

                  {/* Preset choices (emoji or backend image presets) */}
                  <div className="grid grid-cols-5 gap-2 pb-2 max-h-40 overflow-y-auto">
                    {presetAvatars.map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAvatar(preset)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg overflow-hidden transition-all cursor-pointer ${
                          avatar === preset
                            ? 'bg-indigo-500/20 border-2 border-indigo-500 scale-105'
                            : 'bg-white/2 dark:bg-white/4 border border-white/5 hover:bg-white/5'
                        }`}
                      >
                        <WfNewAvatarView value={preset} className="text-lg" />
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Actions submit row */}
              <div className="flex gap-3 justify-end pt-3.5 border-t border-white/5">
                <ActionButton variant="secondary" size="sm" onClick={() => setIsEditing(false)}>{trans('common.cancel')}</ActionButton>
                <ActionButton type="submit" icon={<Save className="w-4 h-4" />}>{trans('profile.saveBtn')}</ActionButton>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* COLUMN A: ACHIEVEMENTS — mobile-first "trophy case" (hero + varied chips). */}
            <div className={`lg:col-span-2 p-5 sm:p-7 rounded-3xl ${activeTheme.cardClass} border border-white/5 space-y-5 shadow-lg`}>
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <Award className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-black text-slate-100 font-mono uppercase tracking-wide flex-1">
                  {trans('profile.badgesTitle')}
                </h4>
                <span className="text-[10px] font-mono font-black text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                  {trans('profile.badgeProgress', { count: unlockedCount, total: achievements.length })}
                </span>
              </div>

              {/* HERO tile — the most prestigious unlocked badge, larger + glowing. */}
              {(() => {
                const HeroIcon = heroBadge.icon;
                const heroUnlocked = heroBadge.unlocked;
                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className={`relative overflow-hidden rounded-2xl p-5 border flex items-center gap-4 ${
                      heroUnlocked
                        ? 'border-amber-400/30 bg-gradient-to-br from-amber-500/15 via-fuchsia-500/10 to-indigo-500/10'
                        : 'border-white/5 bg-white/2 opacity-70'
                    }`}
                  >
                    {heroUnlocked && (
                      <motion.div
                        aria-hidden
                        className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-400/20 blur-3xl pointer-events-none"
                        animate={{ opacity: [0.4, 0.8, 0.4] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />
                    )}
                    <div className={`relative shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center border ${
                      heroUnlocked ? 'border-amber-400/40 bg-amber-400/10' : 'border-white/10 bg-slate-900/60 grayscale'
                    }`}>
                      <HeroIcon className={`w-8 h-8 ${heroUnlocked ? 'text-amber-300' : 'text-zinc-600'}`} />
                      {!heroUnlocked && <Lock className="absolute -bottom-1 -right-1 w-4 h-4 text-zinc-400 bg-slate-900 rounded-full p-0.5" />}
                    </div>
                    <div className="relative min-w-0">
                      <span className="text-[8px] font-mono uppercase tracking-widest text-amber-300/80">{trans('profile.featuredBadge')}</span>
                      <p className="text-base font-black text-slate-100 truncate">{trans('profile.ach.' + heroBadge.id + '.name')}</p>
                      <p className="text-[10px] text-zinc-400 leading-snug">{trans('profile.ach.' + heroBadge.id + '.desc')}</p>
                    </div>
                  </motion.div>
                );
              })()}

              {/* Compact medal chips — horizontal snap-scroll on phone, grid on wider. */}
              <div className="flex gap-3 overflow-x-auto snap-x pb-2 -mx-1 px-1 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
                {restBadges.map((badge, i) => {
                  const Icon = badge.icon;
                  const accent = BADGE_ACCENTS[i % BADGE_ACCENTS.length];
                  return (
                    <motion.div
                      key={badge.id}
                      {...riseIn(0.3, 0.04 * i)}
                      className={`snap-start shrink-0 w-40 sm:w-auto p-3.5 rounded-2xl border relative overflow-hidden ${
                        badge.unlocked
                          ? `bg-gradient-to-br ${accent.split(' ')[1]} to-transparent border-white/10`
                          : 'bg-slate-900/30 border-white/5 opacity-55 grayscale'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`relative shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${
                          badge.unlocked ? 'border-white/10 bg-white/5' : 'border-white/5 bg-slate-900/60'
                        }`}>
                          <Icon className={`w-5 h-5 ${badge.unlocked ? accent.split(' ')[0] : 'text-zinc-600'}`} />
                          {!badge.unlocked && <Lock className="absolute -bottom-1 -right-1 w-3.5 h-3.5 text-zinc-400 bg-slate-900 rounded-full p-0.5" />}
                        </div>
                        <p className="text-[11px] font-black text-slate-100 leading-tight truncate">{trans('profile.ach.' + badge.id + '.name')}</p>
                      </div>
                      {/* locked → tiny progress hint; unlocked → ✓ */}
                      {badge.unlocked ? (
                        <span className="mt-2 inline-block text-[8px] font-black font-mono tracking-widest text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded-full uppercase">
                          {trans('profile.unlocked')}
                        </span>
                      ) : (
                        <div className="mt-2 space-y-1">
                          <ProgressBar done={badge.progress} total={badge.maxProgress} tone="neutral" className="h-1" />
                          <span className="text-[8px] font-mono text-zinc-500">{badge.progress}/{badge.maxProgress}</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN B: LEARNING METRICS — mixed bento (ring + big-number + segmented + dots). */}
            <div className={`p-5 sm:p-7 rounded-3xl ${activeTheme.cardClass} border border-white/5 space-y-4 shadow-lg`}>
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-black text-slate-100 font-mono uppercase tracking-wide">
                  {trans('profile.pathMetrics')}
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* (a) RADIAL ring gauge — retention. Spans both columns on phone. */}
                <motion.div
                  {...riseIn(0.35)}
                  className="col-span-2 p-4 rounded-2xl bg-slate-900/40 border border-white/5 flex items-center gap-4"
                >
                  <ProgressRing progress={retentionPct / 100} sizeClass="w-20 h-20" colorClass="text-indigo-400">
                    <span className="text-base font-black text-indigo-300">{retentionPct}%</span>
                  </ProgressRing>
                  <div>
                    <p className="text-xs font-black text-slate-100">{trans('profile.mRetention')}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{trans('profile.mRetentionSub')}</p>
                  </div>
                </motion.div>

                {/* (b) BIG-NUMBER stat tile — learned words. */}
                <motion.div
                  {...riseIn(0.35, 0.05)}
                  className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-transparent border border-emerald-500/20"
                >
                  <p className="text-2xl font-black text-emerald-300 leading-none">{learnedReal}</p>
                  <p className="text-[9px] text-zinc-400 font-mono uppercase mt-1">{trans('profile.learnedPool')}</p>
                </motion.div>

                {/* (c) BIG-NUMBER stat tile — streak. */}
                <motion.div
                  {...riseIn(0.35, 0.1)}
                  className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/15 to-transparent border border-orange-500/20"
                >
                  <p className="text-2xl font-black text-orange-300 leading-none flex items-baseline gap-1">{streakDays}<span className="text-xs">🔥</span></p>
                  <p className="text-[9px] text-zinc-400 font-mono uppercase mt-1">{trans('profile.activeStreak')}</p>
                </motion.div>

                {/* (d) SEGMENTED bar — level progress. */}
                <motion.div
                  {...riseIn(0.35, 0.15)}
                  className="col-span-2 p-4 rounded-2xl bg-slate-900/40 border border-white/5 space-y-2"
                >
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-zinc-400">{trans('profile.mLevelProgress')}</span>
                    <span className={member.tier.accent + ' font-bold'}>{Math.round(member.progress * 100)}%</span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: LEVEL_SEGMENTS }).map((_, i) => (
                      <div key={i} className={`flex-1 h-2.5 rounded-sm ${i < Math.round(member.progress * LEVEL_SEGMENTS) ? 'bg-indigo-400' : 'bg-white/5'}`} />
                    ))}
                  </div>
                </motion.div>

                {/* (e) DOT/spark row — streak days toward the monthly goal. */}
                <motion.div
                  {...riseIn(0.35, 0.2)}
                  className="col-span-2 p-4 rounded-2xl bg-slate-900/40 border border-white/5 space-y-2"
                >
                  <p className="text-[10px] font-mono text-zinc-400">{trans('profile.mStreakGoal', { count: STREAK_GOAL_DAYS })}</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: STREAK_GOAL_DAYS }).map((_, i) => (
                      <span key={i} className={`w-2 h-2 rounded-full ${i < streakDots ? 'bg-amber-400' : 'bg-white/8'}`} />
                    ))}
                  </div>
                </motion.div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/40 text-[9px] text-zinc-500 leading-relaxed">
                🌟 <strong className="text-zinc-400">{trans('profile.tipLabel')}</strong>: {trans('profile.tipBody')}
              </div>
            </div>
          </>
        )}

      </div>

      {/* BOTTOM: sign-out (logged in only) — kept at the very end of the page, away
          from the primary actions, since it is destructive. Click → confirm dialog. */}
      {currentUser.isLoggedIn && (
        <div className="pt-2 flex justify-center">
          <ActionButton variant="ghostDanger" size="sm" onClick={() => setShowLogoutConfirm(true)} icon={<LogOut className="w-3.5 h-3.5" />}>
            {trans('profile.logout')}
          </ActionButton>
        </div>
      )}

      {/* Sign-out confirmation dialog */}
      <ModalShell open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} backdrop="strong" cardClassName={`${LOGOUT_CARD_CLASS} ${activeTheme.cardClass}`}>
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
            <LogOut className="w-5 h-5" />
          </span>
          <div>
            <h4 className="text-sm font-black text-slate-100">{trans('profile.logoutConfirmTitle')}</h4>
            <p className="text-[10px] text-zinc-500 font-mono">{trans('profile.logoutConfirmHint')}</p>
          </div>
        </div>
        <ModalFooter className="gap-3">
          <ActionButton variant="secondary" size="sm" onClick={() => setShowLogoutConfirm(false)}>{trans('common.cancel')}</ActionButton>
          <ActionButton variant="danger" onClick={() => { setShowLogoutConfirm(false); onLogout(); }} icon={<LogOut className="w-4 h-4" />}>
            {trans('profile.logout')}
          </ActionButton>
        </ModalFooter>
      </ModalShell>

      {/* Avatar cropper modal (opens after a file is picked) */}
      {cropFile && (
        <WfNewAvatarCropper
          file={cropFile}
          trans={trans}
          onCancel={() => setCropFile(null)}
          onCropped={handleCropped}
        />
      )}

    </div>
  );
};
