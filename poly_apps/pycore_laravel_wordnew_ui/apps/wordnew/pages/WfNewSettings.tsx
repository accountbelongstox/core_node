import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Check, RefreshCw, Star, Languages, Flame, GraduationCap, Compass,
  ChevronDown, Sliders, ToggleLeft, VolumeX, Library, BookmarkCheck, ArrowRight, Sun, Moon, Play,
  Database, Trash2, Sparkles, ShieldCheck,
} from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';
import type { UserStats } from '../api/WfNewApiTypes';
import { CUSTOM_THEMES } from '../WfNewThemes';
import { WfNewApiServerPanel } from '../components/WfNewApiServerPanel';
import { getLanguageConfig, getSupportedLanguages } from '../WfNewLocales';
import { wfNewSettings } from '../WfNewSettingsStore';
import { wfNewApi, type WfNewLanguage } from '../api';
import { WfNewLogo } from '../WfNewBrand';
import { WfNewLanguagePanel } from '../components/WfNewLanguagePanel';
import { WfNewCacheManager } from '../components/WfNewCacheManager';
import { WordNewTtsEnginePriorityPanel } from '../components/settings/WordNewTtsEnginePriorityPanel';

interface WfNewSettingsProps {
  activeTheme: ElementTheme;
  saveThemeChoice: (id: string) => void;
  lang: string;
  setLang: (lang: string) => void;
  /** Dark/light mode (relocated here from the header). */
  dark: boolean;
  toggleDark: () => void;
  userStats: UserStats;
  setUserStats: (stats: UserStats) => void;
  nickname: string;
  setNickname: (name: string) => void;
  avatarUrl: string;
  setAvatarUrl: (url: string) => void;
  speechRate: number;
  setSpeechRate: (r: number) => void;
  onClearCache: () => void;
  /** Open the dedicated learning-languages page (native + multi-target, backend-synced). */
  onOpenLanguages: () => void;
  /** Open the Learning Model sub-page (memorization mode + walkman params). */
  onOpenLearningModel: () => void;
  /** Open the subtitle Playback Settings sub-page. */
  onOpenPlaybackSettings: () => void;
  /** Open the AI Lab (custom word forge) — relocated off the bottom dock. */
  onOpenLabs: () => void;
  /** Navigate to the dedicated About page. */
  onOpenAbout: () => void;
  /** Open the super-admin console (loopback local-management mode). */
  onOpenAdmin: () => void;
  /** True only when the backend granted the loopback debug bypass. */
  isSuperAdmin: boolean;
  /** Account-bound settings (languages) are hidden when logged out. */
  isLoggedIn: boolean;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WfNewSettings: React.FC<WfNewSettingsProps> = ({
  activeTheme,
  saveThemeChoice,
  lang,
  setLang,
  dark,
  toggleDark,
  userStats,
  setUserStats,
  nickname,
  setNickname,
  avatarUrl,
  setAvatarUrl,
  speechRate,
  setSpeechRate,
  onClearCache,
  onOpenLanguages,
  onOpenLearningModel,
  onOpenPlaybackSettings,
  onOpenLabs,
  onOpenAbout,
  onOpenAdmin,
  isSuperAdmin,
  isLoggedIn,
  trans
}) => {
  const [goalInput, setGoalInput] = useState<number>(userStats.dailyGoal);
  const [resetting, setResetting] = useState(false);

  // Cache section now opens the dedicated Cache Manager (per-item / all clear)
  // instead of clearing directly — see WfNewCacheManager.
  const [cacheManagerOpen, setCacheManagerOpen] = useState(false);

  // --- Dynamic New Setting States (backed by the shared WfNewSettingsStore) ---
  // A. Dropdown setting (Select) - Accent Engine
  const [voiceAccent, setVoiceAccent] = useState<string>(() => wfNewSettings.get('voiceAccent'));

  // Background Breathing Filter Toggle
  const [disableBgBreathing, setDisableBgBreathing] = useState<boolean>(() => wfNewSettings.get('disableBgBreathing'));

  // Native language (single) + learning targets (MULTI-select, backend-synced).
  const [nativeLang, setNativeLang] = useState<string>(() => wfNewSettings.get('settingNativeLang'));
  const [targetLangs, setTargetLangs] = useState<string[]>(() => {
    const stored = wfNewSettings.get('settingTargetLangs');
    if (Array.isArray(stored) && stored.length) return stored;
    const legacy = wfNewSettings.get('settingTargetLang');
    return legacy ? [legacy] : ['en'];
  });
  const [langOptions, setLangOptions] = useState<WfNewLanguage[]>([]);
  const [langPanelOpen, setLangPanelOpen] = useState(false);

  // Load the backend-aligned language catalog (falls back to built-ins offline).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opts = await wfNewApi.getSupportedLanguages();
        if (!cancelled && opts.length) setLangOptions(opts);
      } catch {
        /* api layer already falls back to the built-in catalog */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Toggle a learning target → persist locally (multi + legacy primary) + sync to backend. */
  const toggleTargetLang = (code: string) => {
    const next = targetLangs.includes(code) ? targetLangs.filter((c) => c !== code) : [...targetLangs, code];
    const final = next.length ? next : targetLangs; // keep at least one
    setTargetLangs(final);
    wfNewSettings.setField('settingTargetLangs', final);
    wfNewSettings.setField('settingTargetLang', final[0]);
    // Best-effort backend sync (AppQyV1 /learning/languages).
    void wfNewApi.setLearningLanguages({ native_language: nativeLang, learning_languages: final }).catch(() => {});
  };

  // Bilingual custom pages parameters
  const [bilingualRatio, setBilingualRatio] = useState<string>(() => wfNewSettings.get('bilingualRatio'));
  const [recitalOrder, setRecitalOrder] = useState<string>(() => wfNewSettings.get('recitalOrder'));

  // B. Switch settings (boolean toggles)
  const [autoSpeech, setAutoSpeech] = useState<boolean>(() => wfNewSettings.get('autoSpeech'));
  const [hapticFeedback, setHapticFeedback] = useState<boolean>(() => wfNewSettings.get('hapticFeedback'));

  // C. Radio settings (Single Selection) - Study Recurrence Algorithm
  const [reviewAlgorithm, setReviewAlgorithm] = useState<string>(() => wfNewSettings.get('reviewAlgorithm'));

  // D. Multi-select checkboxes (Checklist) - Content Focus Fields
  const [contentFields, setContentFields] = useState<string[]>(() => wfNewSettings.get('contentFields'));

  // Persist each setting to the shared store when it changes. The store notifies
  // every subscriber (WfNewApp, WfNewBilingual, ...) — no manual 'storage' event.
  useEffect(() => { wfNewSettings.setField('voiceAccent', voiceAccent); }, [voiceAccent]);
  useEffect(() => { wfNewSettings.setField('disableBgBreathing', disableBgBreathing); }, [disableBgBreathing]);
  useEffect(() => { wfNewSettings.setField('settingNativeLang', nativeLang); }, [nativeLang]);
  useEffect(() => { wfNewSettings.setField('bilingualRatio', bilingualRatio); }, [bilingualRatio]);
  useEffect(() => { wfNewSettings.setField('recitalOrder', recitalOrder); }, [recitalOrder]);
  useEffect(() => { wfNewSettings.setField('autoSpeech', autoSpeech); }, [autoSpeech]);
  useEffect(() => { wfNewSettings.setField('hapticFeedback', hapticFeedback); }, [hapticFeedback]);
  useEffect(() => { wfNewSettings.setField('reviewAlgorithm', reviewAlgorithm); }, [reviewAlgorithm]);
  useEffect(() => { wfNewSettings.setField('contentFields', contentFields); }, [contentFields]);

  const saveGoal = (val: number) => {
    setGoalInput(val);
    setUserStats({
      ...userStats,
      dailyGoal: val
    });
    wfNewSettings.setField('dailyGoal', val);
  };

  const toggleFieldOption = (fieldId: string) => {
    setContentFields(prev => 
      prev.includes(fieldId) 
        ? prev.filter(f => f !== fieldId) 
        : [...prev, fieldId]
    );
  };

  const handleResetAction = () => {
    setResetting(true);
    setTimeout(() => {
      onClearCache();
      // Reset extra states to default
      setVoiceAccent('en-US');
      setAutoSpeech(true);
      setHapticFeedback(false);
      setReviewAlgorithm('ebbinghaus');
      setContentFields(['tech', 'literature']);
      setResetting(false);
    }, 1200);
  };


  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8 pb-24 max-w-4xl mx-auto"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Vessel Pilot credentials settings */}
        <div className={`p-6 rounded-3xl ${activeTheme.cardClass} space-y-5 shadow-sm`}>
          <h3 className="text-sm font-extrabold font-mono uppercase tracking-wider text-indigo-500 dark:text-indigo-400 flex items-center gap-2 border-b border-zinc-100 dark:border-white/5 pb-2">
            <GraduationCap className="w-4 h-4" />
            {trans('settings.goal')}
          </h3>

          {/* Avatar + nickname live in Edit Profile (not duplicated here). */}

          {/* Daily standard target selection dial */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
              {trans('settings.goal')} ({goalInput})
            </label>
            <div className="grid grid-cols-5 gap-2 pt-1">
              {([10, 20, 30, 50, 100] as const).map(goal => (
                <button
                  key={goal}
                  onClick={() => saveGoal(goal)}
                  className={`py-2 text-xs font-bold font-mono rounded-xl transition-all border ${
                    goalInput === goal
                      ? 'bg-indigo-500/15 border-indigo-500 text-indigo-600 dark:text-white'
                      : 'bg-zinc-100 dark:bg-white/5 border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10'
                  }`}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Atmospheric Themes Selection Grid */}
        <div className={`p-6 rounded-3xl ${activeTheme.cardClass} space-y-5 shadow-sm`}>
          <h3 className="text-sm font-extrabold font-mono uppercase tracking-wider text-indigo-500 dark:text-indigo-400 flex items-center gap-2 border-b border-zinc-100 dark:border-white/5 pb-2">
            <Compass className="w-4 h-4" />
            {trans('theme.selector')}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {CUSTOM_THEMES.map(theme => (
              <button
                key={theme.id}
                onClick={() => saveThemeChoice(theme.id)}
                className={`p-4 rounded-2xl text-left border transition-all duration-300 relative overflow-hidden group cursor-pointer ${
                  activeTheme.id === theme.id 
                    ? 'border-indigo-505 bg-indigo-50/60 dark:bg-indigo-500/10 ring-1 ring-indigo-500/30' 
                    : 'border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10 bg-zinc-50 dark:bg-white/5'
                }`}
              >
                {/* Embedded dynamic glow backdrop */}
                <div className={`absolute -right-2 -bottom-2 w-10 h-10 filter blur-xl rounded-full opacity-50 ${
                  theme.id === 'cosmic' ? 'bg-fuchsia-500' :
                  theme.id === 'aurora' ? 'bg-emerald-400' :
                  theme.id === 'sunset' ? 'bg-orange-500' : 'bg-indigo-400'
                }`} />

                <div className="relative z-10 flex flex-col justify-between h-full gap-4">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{lang === 'en' ? theme.nameEn : theme.nameZh}</span>
                  <div className="flex items-center gap-1.5 self-end">
                    {activeTheme.id === theme.id && (
                      <span className="p-0.5 rounded-full bg-indigo-500 text-white">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Dark / light mode — relocated here from the header. */}
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-white/5 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-800 dark:text-slate-200">{trans('set.appearanceMode')}</span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{dark ? trans('set.modeDark') : trans('set.modeLight')}</span>
            </div>
            <button
              onClick={toggleDark}
              className="flex items-center gap-1.5 text-xs bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 px-4 py-2 rounded-full font-bold transition-all cursor-pointer"
            >
              {dark ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-purple-500" />}
              <span>{dark ? trans('set.modeLight') : trans('set.modeDark')}</span>
            </button>
          </div>

          {/* Interface language — full selector (moved here from the header). */}
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-white/5 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-800 dark:text-slate-200">{trans('lang.selector')}</span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{getLanguageConfig(lang).nativeName}</span>
            </div>
            <div className="relative flex items-center gap-1.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 px-3 py-2 rounded-full">
              <Languages className="w-3.5 h-3.5 text-indigo-500" />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="bg-transparent text-xs font-bold outline-none cursor-pointer text-zinc-800 dark:text-slate-200"
              >
                {getSupportedLanguages().map((cfg) => (
                  <option key={cfg.code} value={cfg.code} className="text-zinc-900">
                    {cfg.flag} {cfg.nativeName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

      </div>

      {/* Backend API endpoint summary — click to open the full manager + test dialog */}
      <WfNewApiServerPanel activeTheme={activeTheme} trans={trans} />

      {/* NEW INTERACTIVE CONTROLS CONTAINER: Dropdown, Switches, Radios, Multi-select checkboxes */}
      <div className={`p-6 sm:p-8 rounded-3xl ${activeTheme.cardClass} space-y-6 shadow-md`}>
        <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-white/5 pb-3">
          <Sliders className="w-5 h-5 text-indigo-500" />
          <h3 className="text-base font-extrabold tracking-tight text-indigo-950 dark:text-white">
            {trans('set.prefTitle')}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Column A: Dropdown (Select) & Switches */}
          <div className="space-y-6">
            
            {/* 1. Pronunciation Accent Selector (Dropdown) */}
            <div className="space-y-2">
              <label className="text-xs font-black font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                {trans('set.accentLabel')}
              </label>
              <div className="relative">
                <select
                  value={voiceAccent}
                  onChange={(e) => setVoiceAccent(e.target.value)}
                  className={`w-full py-3 pl-4 pr-10 rounded-xl text-xs font-mono outline-none transition-all cursor-pointer appearance-none ${activeTheme.inputClass}`}
                >
                  <option value="en-US">{trans('set.accentUS')}</option>
                  <option value="en-GB">{trans('set.accentGB')}</option>
                  <option value="en-CA">{trans('set.accentCA')}</option>
                  <option value="en-AU">{trans('set.accentAU')}</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed font-mono">
                {trans('set.accentDesc')}
              </p>
            </div>

            {/* 2. Toggle Switches Section */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-black font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                {trans('set.switchesLabel')}
              </label>

              {/* Haptic / Animation Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
                <div>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">{trans('set.autoSpeechLabel')}</span>
                  <span className="text-[10px] text-zinc-400">{trans('set.autoSpeechDesc')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoSpeech(!autoSpeech)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                    autoSpeech ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      autoSpeech ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Ambient Atmosphere Haptic switch */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
                <div>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">{trans('set.hapticLabel')}</span>
                  <span className="text-[10px] text-zinc-400">{trans('set.hapticDesc')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setHapticFeedback(!hapticFeedback)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                    hapticFeedback ? 'bg-fuchsia-600' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      hapticFeedback ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Disable Background Breathing switch */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
                <div>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">{trans('set.bgBreathLabel')}</span>
                  <span className="text-[10px] text-zinc-400">{trans('set.bgBreathDesc')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDisableBgBreathing(!disableBgBreathing)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                    disableBgBreathing ? 'bg-amber-600' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      disableBgBreathing ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

          </div>

          {/* Column B: Single Radios & Multi-selection Checkboxes */}
          <div className="space-y-6">
            
            {/* 3. Review Algorithms (Radio Group / single-select) */}
            <div className="space-y-2">
              <label className="text-xs font-black font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                {trans('set.algoLabel')}
              </label>
              <div className="space-y-2 pt-1">
                {[
                  { id: 'ebbinghaus', title: trans('set.algoEbbTitle'), desc: trans('set.algoEbbDesc') },
                  { id: 'leitner', title: trans('set.algoLeitnerTitle'), desc: trans('set.algoLeitnerDesc') },
                  { id: 'rapid', title: trans('set.algoRapidTitle'), desc: trans('set.algoRapidDesc') }
                ].map((item) => (
                  <label
                    key={item.id}
                    onClick={() => setReviewAlgorithm(item.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      reviewAlgorithm === item.id
                        ? 'border-indigo-500 bg-indigo-500/5 text-indigo-900 dark:text-white'
                        : 'border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-white/2 hover:bg-zinc-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="study_algo"
                      checked={reviewAlgorithm === item.id}
                      onChange={() => {}} // Click is handled by parent label click
                      className="sr-only"
                    />
                    <div className="flex items-center justify-center pt-0.5">
                      <div className={`w-4 s h-4 rounded-full border flex items-center justify-center ${
                        reviewAlgorithm === item.id ? 'border-indigo-500 text-indigo-500' : 'border-zinc-300 dark:border-zinc-700'
                      }`}>
                        {reviewAlgorithm === item.id && (
                          <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold block">{item.title}</span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 block">{item.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 4. Filter Tags Checkboxes (Multi-select) */}
            <div className="space-y-2">
              <label className="text-xs font-black font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                {trans('set.fieldsLabel')}
              </label>
              <div className="grid grid-cols-2 gap-3 pt-1">
                {[
                  { id: 'tech', label: trans('set.fieldTech') },
                  { id: 'literature', label: trans('set.fieldLit') },
                  { id: 'business', label: trans('set.fieldBiz') },
                  { id: 'general', label: trans('set.fieldGeneral') }
                ].map((option) => {
                  const isChecked = contentFields.includes(option.id);
                  return (
                    <div
                      key={option.id}
                      onClick={() => toggleFieldOption(option.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                        isChecked 
                          ? 'border-fuchsia-500 bg-fuchsia-500/5 text-fuchsia-900 dark:text-fuchsia-200 font-bold' 
                          : 'border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-white/2 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        isChecked ? 'bg-fuchsia-500 border-fuchsia-500 text-white' : 'border-zinc-300 dark:border-zinc-700'
                      }`}>
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-mono">{option.label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed font-mono">
                {trans('set.fieldsDesc')}
              </p>
            </div>

          </div>

        </div>
      </div>

      {/* TTS engine try-order (re-orderable, mirrors pycore capability drawer). */}
      <WordNewTtsEnginePriorityPanel activeTheme={activeTheme} trans={trans} />

      {/* 5. Bilingual Acoustic Recital Preferences Section Card */}
      <div className={`p-6 sm:p-8 rounded-3xl ${activeTheme.cardClass} space-y-6 shadow-md`}>
        <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-white/5 pb-3">
          <Languages className="w-5 h-5 text-indigo-505" />
          <h3 className="text-base font-extrabold tracking-tight text-indigo-950 dark:text-white">
            {trans('set.bilingualTitle')}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Column A: Selecting Native and Target Languages Dropdowns */}
          <div className="space-y-5">
            <span className="text-xs font-black font-mono uppercase tracking-wider text-indigo-505 dark:text-indigo-400 block border-b border-zinc-100 dark:border-white/5 pb-1">
              {trans('set.langCoords')}
            </span>

            {/* Account-bound language settings — hidden when logged out. */}
            {!isLoggedIn && (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono py-2">
                {trans('set.loginForLanguages')}
              </p>
            )}

            {isLoggedIn && (
              <div className="space-y-3">
                {/* Compact summary of the current native + target selection. */}
                <div className="space-y-1.5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{trans('set.nativeLabel')}</span>
                    <span className="text-xs font-bold text-zinc-800 dark:text-slate-200">{getLanguageConfig(nativeLang).nativeName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{trans('set.targetLabel')}</span>
                    <span className="text-xs font-bold text-zinc-800 dark:text-slate-200 text-right truncate max-w-[60%]">
                      {targetLangs.map((c) => getLanguageConfig(c).nativeName).join(' · ') || '—'}
                    </span>
                  </div>
                </div>

                {/* Open the SHARED floating language panel (native + multi targets). */}
                <button
                  type="button"
                  onClick={() => setLangPanelOpen(true)}
                  className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-zinc-300 transition-all cursor-pointer"
                >
                  <span>{trans('set.selectLanguages')}</span>
                  <Languages className="w-4 h-4 text-indigo-400" />
                </button>
              </div>
            )}

            {/* Learning Model — local device settings (memorization mode + playback). */}
            <button
              type="button"
              onClick={onOpenLearningModel}
              className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-zinc-300 transition-all cursor-pointer"
            >
              <span>{trans('set.learningModel')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Playback Settings — subtitle player preferences sub-page. */}
            <button
              type="button"
              onClick={onOpenPlaybackSettings}
              className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-zinc-300 transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2"><Play className="w-3.5 h-3.5 text-indigo-400" />{trans('set.playbackSettings')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* AI Lab — custom word forge (relocated off the bottom dock). */}
            <button
              type="button"
              onClick={onOpenLabs}
              className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-zinc-300 transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-amber-400" />{trans('set.aiLab')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Column B: Acoustic proportional ratios & reading sequence */}
          <div className="space-y-5">
            <span className="text-xs font-black font-mono uppercase tracking-wider text-indigo-505 dark:text-indigo-400 block border-b border-zinc-100 dark:border-white/5 pb-1">
              {trans('set.speechCadence')}
            </span>

            {/* Playback Sentence Proportions (1en/2en-1zh) */}
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 font-mono">
                {trans('set.ratioLabel')}
              </label>
              <div className="relative">
                <select
                  value={bilingualRatio}
                  onChange={(e) => setBilingualRatio(e.target.value)}
                  className={`w-full py-3 pl-4 pr-10 rounded-xl text-xs font-mono outline-none transition-all cursor-pointer appearance-none ${activeTheme.inputClass}`}
                >
                  <option value="1en_1zh">{trans('set.ratioOpt1')}</option>
                  <option value="2en_1zh">{trans('set.ratioOpt2')}</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Pronunciation Sequence order (Native first vs Target first) */}
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 font-mono">
                {trans('set.orderLabel')}
              </label>
              <div className="relative">
                <select
                  value={recitalOrder}
                  onChange={(e) => setRecitalOrder(e.target.value)}
                  className={`w-full py-3 pl-4 pr-10 rounded-xl text-xs font-mono outline-none transition-all cursor-pointer appearance-none ${activeTheme.inputClass}`}
                >
                  <option value="target_first">{trans('set.orderTarget')}</option>
                  <option value="native_first">{trans('set.orderNative')}</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced sub-parameters (Speech speed, device parameters, system wipe) */}
      <div className={`p-6 rounded-3xl ${activeTheme.cardClass} grid grid-cols-1 md:grid-cols-2 gap-6 shadow-sm`}>
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold font-mono uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
            {trans('settings.speechSpeed')} ({speechRate}x)
          </h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono leading-relaxed">
            {trans('set.speedDesc')}
          </p>
          
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-zinc-500">0.5x</span>
            <input
              type="range"
              min="0.5"
              max="1.6"
              step="0.1"
              value={speechRate}
              onChange={(e) => {
                const r = parseFloat(e.target.value);
                setSpeechRate(r);
                wfNewSettings.setField('speechRate', r);
              }}
              className="flex-1 accent-indigo-500 h-1 bg-zinc-200 dark:bg-white/10 rounded-lg cursor-pointer"
            />
            <span className="text-xs font-mono text-zinc-500">1.6x</span>
          </div>
        </div>

        <div className="space-y-4 md:border-l border-zinc-100 dark:border-white/5 md:pl-6">
          <h3 className="text-sm font-extrabold font-mono uppercase tracking-wider text-rose-500 dark:text-rose-400">
            {trans('settings.reset')}
          </h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono leading-relaxed">
            {trans('set.resetDesc')}
          </p>

          <button
            onClick={handleResetAction}
            disabled={resetting}
            className="w-full text-xs font-mono font-bold uppercase tracking-widest bg-rose-500/10 hover:bg-rose-500/25 text-rose-500 dark:text-rose-400 py-3 rounded-2xl border border-rose-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            {resetting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              trans('settings.resetBtn')
            )}
          </button>
        </div>
      </div>

      {/* Cache — opens the dedicated Cache Manager (clear one / several / all). */}
      <div className={`p-6 sm:p-8 rounded-3xl ${activeTheme.cardClass} space-y-4 shadow-md`}>
        <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-white/5 pb-3">
          <Database className="w-5 h-5 text-indigo-500" />
          <h3 className="text-base font-extrabold tracking-tight text-indigo-950 dark:text-white">
            {trans('cache.title')}
          </h3>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono leading-relaxed">
          {trans('cache.desc')}
        </p>
        <button
          onClick={() => setCacheManagerOpen(true)}
          className="w-full text-xs font-mono font-bold uppercase tracking-widest bg-rose-500/10 hover:bg-rose-500/25 text-rose-500 dark:text-rose-400 py-3 rounded-2xl border border-rose-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          {trans('cache.clearBtn')}
        </button>
      </div>

      <WfNewCacheManager open={cacheManagerOpen} onClose={() => setCacheManagerOpen(false)} trans={trans} />

      {/* Super-admin console entry — visible ONLY when the backend granted the
          loopback debug bypass (page opened from the backend's own machine). */}
      {isSuperAdmin && (
        <div className={`rounded-3xl ${activeTheme.cardClass} shadow-sm overflow-hidden border border-amber-500/20`}>
          <button
            onClick={onOpenAdmin}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-amber-500/[0.06] transition-colors cursor-pointer"
          >
            <span className="p-1.5 rounded-xl bg-amber-500/15 border border-amber-500/20 shrink-0">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </span>
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-sm font-extrabold tracking-tight text-indigo-950 dark:text-white">
                {trans('admin.entryTitle')}
              </span>
              <span className="block text-[10px] font-mono text-zinc-500 truncate">
                {trans('admin.entryDesc')}
              </span>
            </span>
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5">
              {trans('admin.badge')}
            </span>
            <ArrowRight className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      )}

      {/* About — a settings item whose ICON is the brand LOGO; tapping it
          NAVIGATES to the dedicated About page (rich multilingual description). */}
      <div className={`rounded-3xl ${activeTheme.cardClass} shadow-sm overflow-hidden`}>
        <button
          onClick={onOpenAbout}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-black/[0.03] dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
          <WfNewLogo size={32} className="shrink-0" />
          <span className="flex-1 text-left text-sm font-extrabold tracking-tight text-indigo-950 dark:text-white">
            {trans('about.title')}
          </span>
          <span className="text-[11px] font-mono font-bold text-zinc-400">{trans('about.version')}</span>
          <ArrowRight className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Shared floating language panel (native + multi targets). */}
      <WfNewLanguagePanel
        open={langPanelOpen}
        onClose={() => setLangPanelOpen(false)}
        nativeLang={nativeLang}
        targetLangs={targetLangs}
        options={langOptions}
        onSave={(sel) => {
          setNativeLang(sel.native_language);
          setTargetLangs(sel.learning_languages);
          wfNewSettings.setField('settingNativeLang', sel.native_language);
          wfNewSettings.setField('settingTargetLangs', sel.learning_languages);
          wfNewSettings.setField('settingTargetLang', sel.learning_languages[0] || 'en');
        }}
        trans={trans}
      />
    </motion.div>
  );
};
