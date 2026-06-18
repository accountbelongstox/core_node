import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, User, Check, RefreshCw, Star, Languages, Flame, GraduationCap, Compass, 
  ChevronDown, Sliders, ToggleLeft, VolumeX, Library, BookmarkCheck
} from 'lucide-react';
import { ElementTheme, UserStats } from '../WfNewTypes';
import { CUSTOM_THEMES } from '../WfNewThemes';
import { WfNewApiServerPanel } from '../components/WfNewApiServerPanel';
import { getLanguageConfig } from '../WfNewLocales';

interface WfNewSettingsProps {
  activeTheme: ElementTheme;
  saveThemeChoice: (id: string) => void;
  lang: string;
  setLang: (lang: string) => void;
  userStats: UserStats;
  setUserStats: (stats: UserStats) => void;
  nickname: string;
  setNickname: (name: string) => void;
  avatarUrl: string;
  setAvatarUrl: (url: string) => void;
  speechRate: number;
  setSpeechRate: (r: number) => void;
  onClearCache: () => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WfNewSettings: React.FC<WfNewSettingsProps> = ({
  activeTheme,
  saveThemeChoice,
  lang,
  setLang,
  userStats,
  setUserStats,
  nickname,
  setNickname,
  avatarUrl,
  setAvatarUrl,
  speechRate,
  setSpeechRate,
  onClearCache,
  trans
}) => {
  const [goalInput, setGoalInput] = useState<number>(userStats.dailyGoal);
  const [resetting, setResetting] = useState(false);

  // --- Dynamic New Setting States ---
  // A. Dropdown setting (Select) - Accent Engine
  const [voiceAccent, setVoiceAccent] = useState<string>(() => {
    return localStorage.getItem('wf_setting_accent') || 'en-US';
  });

  // Background Breathing Filter Toggle
  const [disableBgBreathing, setDisableBgBreathing] = useState<boolean>(() => {
    return localStorage.getItem('wf_setting_disable_bg_breathing') === 'true';
  });

  // Native & Target Language selects
  const [nativeLang, setNativeLang] = useState<string>(() => {
    return localStorage.getItem('wf_setting_native_lang') || 'zh';
  });
  const [targetLang, setTargetLang] = useState<string>(() => {
    return localStorage.getItem('wf_setting_target_lang') || 'en';
  });

  // Bilingual custom pages parameters
  const [bilingualRatio, setBilingualRatio] = useState<string>(() => {
    return localStorage.getItem('wf_setting_bilingual_ratio') || '1en_1zh';
  });
  const [recitalOrder, setRecitalOrder] = useState<string>(() => {
    return localStorage.getItem('wf_setting_recital_order') || 'target_first';
  });

  // B. Switch settings (boolean toggles)
  const [autoSpeech, setAutoSpeech] = useState<boolean>(() => {
    return localStorage.getItem('wf_setting_autospeech') !== 'false';
  });
  const [hapticFeedback, setHapticFeedback] = useState<boolean>(() => {
    return localStorage.getItem('wf_setting_haptic') === 'true';
  });

  // C. Radio settings (Single Selection) - Study Recurrence Algorithm
  const [reviewAlgorithm, setReviewAlgorithm] = useState<string>(() => {
    return localStorage.getItem('wf_setting_algorithm') || 'ebbinghaus';
  });

  // D. Multi-select checkboxes (Checklist) - Content Focus Fields
  const [contentFields, setContentFields] = useState<string[]>(() => {
    const saved = localStorage.getItem('wf_setting_fields');
    return saved ? JSON.parse(saved) : ['tech', 'literature'];
  });

  // Save states to localStorage when changed
  useEffect(() => {
    localStorage.setItem('wf_setting_accent', voiceAccent);
  }, [voiceAccent]);

  useEffect(() => {
    localStorage.setItem('wf_setting_disable_bg_breathing', String(disableBgBreathing));
    // Trigger custom event to notify App.tsx instantly of background breathing updates
    window.dispatchEvent(new Event('storage'));
  }, [disableBgBreathing]);

  useEffect(() => {
    localStorage.setItem('wf_setting_native_lang', nativeLang);
    window.dispatchEvent(new Event('storage'));
  }, [nativeLang]);

  useEffect(() => {
    localStorage.setItem('wf_setting_target_lang', targetLang);
    window.dispatchEvent(new Event('storage'));
  }, [targetLang]);

  useEffect(() => {
    localStorage.setItem('wf_setting_bilingual_ratio', bilingualRatio);
    window.dispatchEvent(new Event('storage'));
  }, [bilingualRatio]);

  useEffect(() => {
    localStorage.setItem('wf_setting_recital_order', recitalOrder);
    window.dispatchEvent(new Event('storage'));
  }, [recitalOrder]);

  useEffect(() => {
    localStorage.setItem('wf_setting_autospeech', String(autoSpeech));
  }, [autoSpeech]);

  useEffect(() => {
    localStorage.setItem('wf_setting_haptic', String(hapticFeedback));
  }, [hapticFeedback]);

  useEffect(() => {
    localStorage.setItem('wf_setting_algorithm', reviewAlgorithm);
  }, [reviewAlgorithm]);

  useEffect(() => {
    localStorage.setItem('wf_setting_fields', JSON.stringify(contentFields));
  }, [contentFields]);

  const saveGoal = (val: number) => {
    setGoalInput(val);
    setUserStats({
      ...userStats,
      dailyGoal: val
    });
    localStorage.setItem('wf_new_daily_goal', String(val));
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

  const AVATARS = [
    '🤖', '🦁', '🦊', '🦉', '🎓', '🛸', '🚀', '⭐', '✨'
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8 pb-24 max-w-4xl mx-auto"
    >
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/50 dark:border-white/5 pb-5">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-indigo-950 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-500 animate-spin" style={{ animationDuration: '6s' }} />
            {trans('settings.title')}
          </h2>
          <p className="text-zinc-500 text-xs mt-1">{trans('settings.sub')}</p>
        </div>
        <div className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full border border-indigo-500/15 w-fit">
          ENGINE: v5.24 SECURE SHELL
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Vessel Pilot credentials settings */}
        <div className={`p-6 rounded-3xl ${activeTheme.cardClass} space-y-5 shadow-sm`}>
          <h3 className="text-sm font-extrabold font-mono uppercase tracking-wider text-indigo-500 dark:text-indigo-400 flex items-center gap-2 border-b border-zinc-100 dark:border-white/5 pb-2">
            <User className="w-4 h-4" />
            {trans('settings.profile')}
          </h3>

          {/* Avatar pick items */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
              {trans('settings.avatar')}
            </label>
            <div className="flex gap-2 flex-wrap pt-1">
              {AVATARS.map(avatar => (
                <button
                  key={avatar}
                  onClick={() => {
                    setAvatarUrl(avatar);
                    localStorage.setItem('wf_new_avatar', avatar);
                  }}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all bg-zinc-100 dark:bg-white/5 border hover:bg-zinc-200 dark:hover:bg-white/10 ${
                    avatarUrl === avatar 
                      ? 'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/10 scale-105' 
                      : 'border-transparent'
                  }`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          {/* Nickname input */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
              {trans('settings.nickname')}
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                localStorage.setItem('wf_new_nickname', e.target.value);
              }}
              className={`w-full py-2.5 px-4 text-xs font-mono rounded-xl outline-none transition-all ${activeTheme.inputClass}`}
            />
          </div>

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

          {/* Quick dialect Switcher card */}
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-white/5 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-800 dark:text-slate-200">{trans('lang.selector')}</span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{getLanguageConfig('en').nativeName} / {getLanguageConfig('zh').nativeName}</span>
            </div>
            
            <button
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
              className="flex items-center gap-1.5 text-xs bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 px-4 py-2 rounded-full font-bold transition-all cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-indigo-500" />
              <span>{getLanguageConfig(lang).nativeName}</span>
            </button>
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

            {/* Native Language selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 font-mono">
                {trans('set.nativeLabel')}
              </label>
              <div className="relative">
                <select
                  value={nativeLang}
                  onChange={(e) => setNativeLang(e.target.value)}
                  className={`w-full py-3 pl-4 pr-10 rounded-xl text-xs font-mono outline-none transition-all cursor-pointer appearance-none ${activeTheme.inputClass}`}
                >
                  <option value="zh">🇨🇳 {trans('lang.name.zh')}</option>
                  <option value="ja">🇯🇵 {trans('lang.name.ja')}</option>
                  <option value="ko">🇰🇷 {trans('lang.name.ko')}</option>
                  <option value="es">🇪🇸 {trans('lang.name.es')}</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Target Language selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 font-mono">
                {trans('set.targetLabel')}
              </label>
              <div className="relative">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className={`w-full py-3 pl-4 pr-10 rounded-xl text-xs font-mono outline-none transition-all cursor-pointer appearance-none ${activeTheme.inputClass}`}
                >
                  <option value="en">🇺🇸 {trans('lang.name.en')}</option>
                  <option value="fr">🇫🇷 {trans('lang.name.fr')}</option>
                  <option value="de">🇩🇪 {trans('lang.name.de')}</option>
                  <option value="es">🇪🇸 {trans('lang.name.es')}</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
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
                localStorage.setItem('wf_new_speech_rate', String(r));
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
    </motion.div>
  );
};
