import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, RefreshCw, Languages, GraduationCap, Compass, Sliders, Sun, Moon, Play,
  Database, Trash2, Sparkles, ShieldCheck,
} from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';
import type { UserStats } from '../api/WfNewApiTypes';
import { WfNewApiCenterPanel } from '../components/api-center/WfNewApiCenterPanel';
import { getLanguageConfig, getSupportedLanguages } from '../WfNewLocales';
import { wfNewSettings } from '../WfNewSettingsStore';
import { useWfNewLearningTargets, useWfNewSetting } from '../useWfNewSettings';
import { WfNewLogo } from '../WfNewBrand';
import { WfNewLanguagePanel } from '../components/WfNewLanguagePanel';
import { commitDailyGoal } from '../components/WfNewDailyGoalEditor';
import { WordNewTtsEnginePriorityPanel } from '../components/settings/WordNewTtsEnginePriorityPanel';
import { WfNewSettingsProfileCard } from '../components/settings/WfNewSettingsProfileCard';
import { WfNewSettingsSection } from '../components/settings/WfNewSettingsSection';
import { WfNewThemePicker } from '../components/settings/WfNewThemePicker';
import { WfNewReviewAlgorithmPicker } from '../components/settings/WfNewReviewAlgorithmPicker';
import { SelectSettingRow, SwitchSettingRow } from '../components/settings/WfNewSettingRows';
import {
  BILINGUAL_RATIOS, RECITAL_ORDERS, VOICE_ACCENTS, toSelectOptions, type Translate,
} from '../components/settings/WfNewSettingChoices';
import { WfNewTransferLimitsPanel } from '../components/transfer/WfNewTransferLimits';
import { ActionButton } from '@/shared/ui/ActionButton';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import { NavRow } from '@/shared/ui/NavRow';
import { RangeField } from '@/shared/ui/RangeField';
import { SettingRow } from '@/shared/ui/SettingRow';

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
  /** Settings > Cache page (storage volumes, device clips, data caches). */
  onOpenCache: () => void;
  /** Open the AI Lab (custom word forge) — relocated off the bottom dock. */
  onOpenLabs: () => void;
  /** Navigate to the dedicated About page. */
  onOpenAbout: () => void;
  /** Open the super-admin console (loopback local-management mode). */
  onOpenAdmin: () => void;
  /** Open the full profile page from the settings profile card. */
  onOpenProfile: () => void;
  /** True only when the backend granted the loopback debug bypass. */
  isSuperAdmin: boolean;
  /** Account-bound settings (languages) are hidden when logged out. */
  isLoggedIn: boolean;
  trans: Translate;
}

const GOAL_PRESETS = [10, 20, 30, 50, 100] as const;
const SPEECH_RATE_RANGE = { min: 0.5, max: 1.6, step: 0.1 };
const RESET_DELAY_MS = 1200;
const CONTENT_FIELDS = [
  { id: 'tech', labelKey: 'set.fieldTech' },
  { id: 'literature', labelKey: 'set.fieldLit' },
  { id: 'business', labelKey: 'set.fieldBiz' },
  { id: 'general', labelKey: 'set.fieldGeneral' },
] as const;

const FIELD_LABEL_CLASS = 'block font-mono text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const COLUMN_TITLE_CLASS = 'block border-b border-zinc-100 pb-1 font-mono text-xs font-black uppercase tracking-wider text-indigo-500 dark:border-white/5 dark:text-indigo-400';
const BLOCK_TITLE_CLASS = 'font-mono text-sm font-extrabold uppercase tracking-wider';

export const WfNewSettings: React.FC<WfNewSettingsProps> = ({
  activeTheme, saveThemeChoice, lang, setLang, dark, toggleDark, userStats, setUserStats,
  setSpeechRate, onClearCache, onOpenLearningModel, onOpenPlaybackSettings,
  onOpenCache, onOpenLabs, onOpenAbout, onOpenAdmin, onOpenProfile, isSuperAdmin, isLoggedIn,
  nickname, avatarUrl, trans,
}) => {
  const [resetting, setResetting] = useState(false);
  const [langPanelOpen, setLangPanelOpen] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [goal] = useWfNewSetting('dailyGoal');
  const [speechRate, storeSpeechRate] = useWfNewSetting('speechRate');
  const [contentFields, setContentFields] = useWfNewSetting('contentFields');
  const [nativeLang] = useWfNewSetting('settingNativeLang');
  const targetLangs = useWfNewLearningTargets();

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  const saveGoal = (value: number): void => {
    setUserStats({ ...userStats, dailyGoal: value });
    commitDailyGoal(value);
  };

  const changeSpeechRate = (rate: number): void => {
    setSpeechRate(rate);
    storeSpeechRate(rate);
  };

  const toggleContentField = (fieldId: string): void => {
    setContentFields(contentFields.includes(fieldId) ? contentFields.filter((f) => f !== fieldId) : [...contentFields, fieldId]);
  };

  const handleResetAction = (): void => {
    setResetting(true);
    resetTimer.current = setTimeout(() => {
      onClearCache();
      wfNewSettings.resetPreferences();
      setResetting(false);
    }, RESET_DELAY_MS);
  };

  const inputClass = activeTheme.inputClass;
  const goalOptions = GOAL_PRESETS.map((preset) => ({ value: preset as number, label: String(preset) }));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8 pb-24 max-w-4xl mx-auto"
    >
      {isLoggedIn && (
        <WfNewSettingsProfileCard
          activeTheme={activeTheme}
          trans={trans}
          nickname={nickname}
          avatarUrl={avatarUrl}
          onOpen={onOpenProfile}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <WfNewSettingsSection activeTheme={activeTheme} icon={<GraduationCap className="w-5 h-5 text-indigo-500" />} title={`${trans('settings.goal')} (${goal})`}>
          <ChipGroup value={goal} options={goalOptions} onChange={saveGoal} />
        </WfNewSettingsSection>

        <WfNewSettingsSection activeTheme={activeTheme} icon={<Compass className="w-5 h-5 text-indigo-500" />} title={trans('theme.selector')}>
          <WfNewThemePicker activeId={activeTheme.id} onSelect={saveThemeChoice} lang={lang} />

          <SettingRow label={trans('set.appearanceMode')} hint={dark ? trans('set.modeDark') : trans('set.modeLight')} className="border-t border-zinc-100 dark:border-white/5">
            <button
              type="button"
              onClick={toggleDark}
              className="flex items-center gap-1.5 text-xs bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 px-4 py-2 rounded-full font-bold transition-all cursor-pointer"
            >
              {dark ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-purple-500" />}
              <span>{dark ? trans('set.modeLight') : trans('set.modeDark')}</span>
            </button>
          </SettingRow>

          <SettingRow label={trans('lang.selector')} hint={getLanguageConfig(lang).nativeName} className="border-t border-zinc-100 dark:border-white/5">
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 px-3 py-2 rounded-full">
              <Languages className="w-3.5 h-3.5 text-indigo-500" />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="bg-transparent text-xs font-bold outline-none cursor-pointer text-zinc-800 dark:text-slate-200"
              >
                {getSupportedLanguages().map((cfg) => (
                  <option key={cfg.code} value={cfg.code} className="text-zinc-900">{cfg.flag} {cfg.nativeName}</option>
                ))}
              </select>
            </div>
          </SettingRow>
        </WfNewSettingsSection>
      </div>

      <WfNewApiCenterPanel activeTheme={activeTheme} trans={trans} />

      <WfNewTransferLimitsPanel activeTheme={activeTheme} trans={trans} />

      <WfNewSettingsSection activeTheme={activeTheme} icon={<Sliders className="w-5 h-5 text-indigo-500" />} title={trans('set.prefTitle')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <SelectSettingRow
              settingKey="voiceAccent"
              label={trans('set.accentLabel')}
              hint={trans('set.accentDesc')}
              options={toSelectOptions(VOICE_ACCENTS, trans)}
              inputClassName={inputClass}
            />

            <div className="space-y-3 pt-2">
              <span className={FIELD_LABEL_CLASS}>{trans('set.switchesLabel')}</span>
              <SwitchSettingRow boxed settingKey="autoSpeech" label={trans('set.autoSpeechLabel')} hint={trans('set.autoSpeechDesc')} />
              <SwitchSettingRow boxed settingKey="hapticFeedback" label={trans('set.hapticLabel')} hint={trans('set.hapticDesc')} tone="fuchsia" />
              <SwitchSettingRow boxed settingKey="disableBgBreathing" label={trans('set.bgBreathLabel')} hint={trans('set.bgBreathDesc')} tone="amber" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <span className={FIELD_LABEL_CLASS}>{trans('set.algoLabel')}</span>
              <WfNewReviewAlgorithmPicker trans={trans} />
            </div>

            <div className="space-y-2">
              <span className={FIELD_LABEL_CLASS}>{trans('set.fieldsLabel')}</span>
              <div className="grid grid-cols-2 gap-3 pt-1">
                {CONTENT_FIELDS.map((option) => {
                  const checked = contentFields.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggleContentField(option.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all text-left ${
                        checked
                          ? 'border-fuchsia-500 bg-fuchsia-500/5 text-fuchsia-900 dark:text-fuchsia-200 font-bold'
                          : 'border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        checked ? 'bg-fuchsia-500 border-fuchsia-500 text-white' : 'border-zinc-300 dark:border-zinc-700'
                      }`}>
                        {checked && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      <span className="text-xs font-mono">{trans(option.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed font-mono">{trans('set.fieldsDesc')}</p>
            </div>
          </div>
        </div>
      </WfNewSettingsSection>

      <WordNewTtsEnginePriorityPanel activeTheme={activeTheme} trans={trans} />

      <WfNewSettingsSection activeTheme={activeTheme} icon={<Languages className="w-5 h-5 text-indigo-500" />} title={trans('set.bilingualTitle')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-5">
            <span className={COLUMN_TITLE_CLASS}>{trans('set.langCoords')}</span>

            {!isLoggedIn && (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono py-2">{trans('set.loginForLanguages')}</p>
            )}

            {isLoggedIn && (
              <div className="space-y-3">
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

                <NavRow label={trans('set.selectLanguages')} icon={<Languages className="w-3.5 h-3.5 text-indigo-400" />} onClick={() => setLangPanelOpen(true)} />
              </div>
            )}

            <NavRow label={trans('set.learningModel')} onClick={onOpenLearningModel} />
            <NavRow label={trans('set.playbackSettings')} icon={<Play className="w-3.5 h-3.5 text-indigo-400" />} onClick={onOpenPlaybackSettings} />
            <NavRow label={trans('set.aiLab')} icon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />} onClick={onOpenLabs} />
          </div>

          <div className="space-y-5">
            <span className={COLUMN_TITLE_CLASS}>{trans('set.speechCadence')}</span>
            <SelectSettingRow settingKey="bilingualRatio" label={trans('set.ratioLabel')} options={toSelectOptions(BILINGUAL_RATIOS, trans)} inputClassName={inputClass} />
            <SelectSettingRow settingKey="recitalOrder" label={trans('set.orderLabel')} options={toSelectOptions(RECITAL_ORDERS, trans)} inputClassName={inputClass} />
          </div>
        </div>
      </WfNewSettingsSection>

      <div className={`p-6 rounded-3xl ${activeTheme.cardClass} grid grid-cols-1 md:grid-cols-2 gap-6 shadow-sm`}>
        <div className="space-y-4">
          <h3 className={`${BLOCK_TITLE_CLASS} text-indigo-500 dark:text-indigo-400`}>
            {trans('settings.speechSpeed')} ({speechRate}x)
          </h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono leading-relaxed">{trans('set.speedDesc')}</p>
          <RangeField
            value={speechRate}
            {...SPEECH_RATE_RANGE}
            onChange={changeSpeechRate}
            leading={<span className="text-xs font-mono text-zinc-500">{SPEECH_RATE_RANGE.min}x</span>}
            trailing={<span className="text-xs font-mono text-zinc-500">{SPEECH_RATE_RANGE.max}x</span>}
          />
        </div>

        <div className="space-y-4 md:border-l border-zinc-100 dark:border-white/5 md:pl-6">
          <h3 className={`${BLOCK_TITLE_CLASS} text-rose-500 dark:text-rose-400`}>{trans('settings.reset')}</h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono leading-relaxed">{trans('set.resetDesc')}</p>
          <ActionButton variant="softDanger" size="lg" block className="tracking-widest" onClick={handleResetAction} disabled={resetting}>
            {resetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : trans('settings.resetBtn')}
          </ActionButton>
        </div>
      </div>

      <WfNewSettingsSection activeTheme={activeTheme} icon={<Database className="w-5 h-5 text-indigo-500" />} title={trans('cache.title')}>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono leading-relaxed">{trans('cache.desc')}</p>
        <ActionButton variant="softDanger" size="lg" block className="tracking-widest" onClick={onOpenCache} icon={<Trash2 className="w-4 h-4" />}>
          {trans('cache.clearBtn')}
        </ActionButton>
      </WfNewSettingsSection>

      {isSuperAdmin && (
        <div className={`rounded-3xl ${activeTheme.cardClass} shadow-sm overflow-hidden border border-amber-500/20`}>
          <NavRow
            variant="row"
            label={trans('admin.entryTitle')}
            hint={trans('admin.entryDesc')}
            onClick={onOpenAdmin}
            icon={(
              <span className="p-1.5 rounded-xl bg-amber-500/15 border border-amber-500/20 shrink-0">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
              </span>
            )}
            badge={(
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5">
                {trans('admin.badge')}
              </span>
            )}
          />
        </div>
      )}

      <div className={`rounded-3xl ${activeTheme.cardClass} shadow-sm overflow-hidden`}>
        <NavRow
          variant="row"
          label={trans('about.title')}
          onClick={onOpenAbout}
          icon={<WfNewLogo size={32} className="shrink-0" />}
          badge={<span className="text-[11px] font-mono font-bold text-zinc-400">{trans('about.version')}</span>}
        />
      </div>

      <WfNewLanguagePanel
        open={langPanelOpen}
        onClose={() => setLangPanelOpen(false)}
        nativeLang={nativeLang}
        targetLangs={targetLangs}
        onSave={(sel) => wfNewSettings.setLearningLanguages(sel)}
        trans={trans}
      />
    </motion.div>
  );
};
