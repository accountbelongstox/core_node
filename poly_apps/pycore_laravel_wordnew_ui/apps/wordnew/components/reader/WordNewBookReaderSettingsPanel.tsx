import React from 'react';
import { Plus, Trash2, GripVertical, Monitor, Volume2 } from 'lucide-react';
import { NumberInput } from '@/shared/ui/NumberInput';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { SelectField } from '@/shared/ui/SelectField';
import { SettingRow } from '@/shared/ui/SettingRow';
import { Switch } from '@/shared/ui/Switch';
import type { WfNewReaderPlayStep, WfNewReaderDisplayMode } from '../../api/types/bookProgress';
import { READER_SPEED_OPTIONS } from '../../constants/WordNewBookReaderConstants';
import { formatBookLangLabel } from '../../utils/WordNewBookReaderLangUtils';
import type { ElementTheme } from '../../WfNewThemes';
const SEQUENCE_REPEAT_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }));
const MAX_WORD_REPEATS = 10;

interface WordNewBookReaderSettingsPanelProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  languages: string[];
  simul: boolean;
  selectedLangs: string[];
  displayMode: WfNewReaderDisplayMode;
  sequence: WfNewReaderPlayStep[];
  speedByLang: Record<string, number>;
  autoAdvance: boolean;
  repeatOne: boolean;
  autoPlayOnOpen: boolean;
  browserTts: boolean;
  wordCards: boolean;
  wordCardPosition: 'before' | 'after';
  wordRepeats: number;
  wordMode: 'new' | 'all';
  onModeChange: (simul: boolean) => void;
  onToggleLang: (code: string) => void;
  onDisplayModeChange: (mode: WfNewReaderDisplayMode) => void;
  onSequenceChange: (seq: WfNewReaderPlayStep[]) => void;
  onSpeedChange: (lang: string, speed: number) => void;
  onAutoAdvanceChange: (v: boolean) => void;
  onRepeatOneChange: (v: boolean) => void;
  onAutoPlayOnOpenChange: (v: boolean) => void;
  onBrowserTtsChange: (v: boolean) => void;
  onWordCardsChange: (v: boolean) => void;
  onWordCardPositionChange: (v: 'before' | 'after') => void;
  onWordRepeatsChange: (v: number) => void;
  onWordModeChange: (v: 'new' | 'all') => void;
}

export const WordNewBookReaderSettingsPanel: React.FC<WordNewBookReaderSettingsPanelProps> = ({
  activeTheme, trans, languages, simul, selectedLangs, displayMode, sequence, speedByLang,
  autoAdvance, repeatOne, autoPlayOnOpen, browserTts, wordCards, wordCardPosition, wordRepeats, wordMode,
  onModeChange, onToggleLang, onDisplayModeChange, onSequenceChange, onSpeedChange,
  onAutoAdvanceChange, onRepeatOneChange, onAutoPlayOnOpenChange, onBrowserTtsChange,
  onWordCardsChange, onWordCardPositionChange, onWordRepeatsChange, onWordModeChange,
}) => {
  const addStep = () => {
    const lang = languages[0] || 'en';
    onSequenceChange([...sequence, { lang, repeat: 1 }]);
  };

  const updateStep = (idx: number, patch: Partial<WfNewReaderPlayStep>) => {
    onSequenceChange(sequence.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeStep = (idx: number) => {
    if (sequence.length <= 1) return;
    onSequenceChange(sequence.filter((_, i) => i !== idx));
  };

  const label = (code: string) => formatBookLangLabel(code, trans);
  const languageOptions = languages.map((l) => ({ value: l, label: label(l) }));

  return (
    <div className={`rounded-3xl border border-white/5 p-4 sm:p-5 space-y-5 text-xs ${activeTheme.cardClass}`}>
      <div className={`flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider ${activeTheme.accentText}`}>
        <Monitor className="w-4 h-4" />
        {trans('reader.settingsUi')}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2.5">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">{trans('reader.languages')}</span>
          <SegmentedControl
            value={simul}
            onChange={onModeChange}
            activeClassName={activeTheme.accentBg}
            options={[
              { value: false, label: trans('reader.modeSingle') },
              { value: true, label: trans('reader.modeSimul'), disabled: languages.length < 2 },
            ]}
          />
          <div className="flex flex-wrap gap-1.5">
            {languages.map((l) => {
              const on = selectedLangs.includes(l);
              return (
                <button key={l} type="button" onClick={() => onToggleLang(l)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono border cursor-pointer ${on ? activeTheme.accentBg : 'bg-white/5 border-white/5 text-zinc-400'}`}>
                  {label(l)}
                </button>
              );
            })}
          </div>
          {languages.length > 2 && (
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              {trans('reader.bookLangHint', { count: languages.length })}
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">{trans('reader.displayMode')}</span>
          <SegmentedControl
            value={displayMode}
            onChange={onDisplayModeChange}
            options={[
              { value: 'interleaved', label: trans('reader.displayInterleaved') },
              { value: 'stacked', label: trans('reader.displayStacked') },
            ]}
          />
          <p className="text-[10px] text-zinc-500 leading-relaxed">{trans('reader.displayHint')}</p>
        </div>
      </div>

      <div className="border-t border-white/5 pt-4 space-y-3">
        <div className={`flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider ${activeTheme.accentText}`}>
          <Volume2 className="w-4 h-4" />
          {trans('reader.settingsPlay')}
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">{trans('reader.playSequence')}</span>
          <div className="space-y-1.5">
            {sequence.map((step, idx) => (
              <div key={`${idx}-${step.lang}`} className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-lg p-2">
                <GripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                <SelectField
                  variant="compact"
                  value={step.lang}
                  onChange={(lang) => updateStep(idx, { lang })}
                  options={languageOptions}
                />
                <span className="text-zinc-500 font-mono">×</span>
                <SelectField variant="compact" value={step.repeat} onChange={(repeat) => updateStep(idx, { repeat })} options={SEQUENCE_REPEAT_OPTIONS} />
                <button type="button" onClick={() => removeStep(idx)} disabled={sequence.length <= 1} className="ml-auto p-1 text-zinc-500 hover:text-red-400 disabled:opacity-30 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addStep} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-amber-200 text-[10px] font-mono cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> {trans('reader.addPlayStep')}
          </button>
        </div>

        <div className={`grid gap-3 ${languages.length > 2 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {languages.map((lang) => (
            <div key={lang} className="flex items-center justify-between gap-2 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
              <span className="font-mono text-zinc-400 text-[11px]">{label(lang)}</span>
              <SegmentedControl
                size="xs"
                value={speedByLang[lang] ?? 1}
                onChange={(speed) => onSpeedChange(lang, speed)}
                activeClassName={activeTheme.accentBg}
                options={READER_SPEED_OPTIONS.map((speed) => ({ value: speed, label: `${speed}×` }))}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <SettingRow label={trans('reader.autoAdvance')}>
            <Switch on={autoAdvance} onChange={onAutoAdvanceChange} label={trans('reader.autoAdvance')} />
          </SettingRow>
          <SettingRow label={trans('reader.repeatOne')}>
            <Switch on={repeatOne} onChange={onRepeatOneChange} label={trans('reader.repeatOne')} />
          </SettingRow>
          <SettingRow label={trans('reader.autoPlayOnOpen')}>
            <Switch on={autoPlayOnOpen} onChange={onAutoPlayOnOpenChange} label={trans('reader.autoPlayOnOpen')} />
          </SettingRow>
          <SettingRow label={trans('reader.browserTts')} hint={trans('reader.browserTtsHint')}>
            <Switch on={browserTts} onChange={onBrowserTtsChange} label={trans('reader.browserTts')} />
          </SettingRow>
          <SettingRow label={trans('reader.wordCards')}>
            <Switch on={wordCards} onChange={onWordCardsChange} label={trans('reader.wordCards')} />
          </SettingRow>
          <SelectField
            variant="compact"
            label={trans('reader.wordCardPosition')}
            value={wordCardPosition}
            disabled={!wordCards}
            onChange={onWordCardPositionChange}
            options={[
              { value: 'before', label: trans('reader.wordCardsBefore') },
              { value: 'after', label: trans('reader.wordCardsAfter') },
            ]}
          />
          <SelectField
            variant="compact"
            label={trans('reader.wordMode')}
            value={wordMode}
            disabled={!wordCards}
            onChange={onWordModeChange}
            options={[
              { value: 'new', label: trans('reader.wordModeNew') },
              { value: 'all', label: trans('reader.wordModeAll') },
            ]}
          />
          <SettingRow label={trans('reader.wordRepeats')}>
            <NumberInput value={wordRepeats} min={1} max={MAX_WORD_REPEATS} step={1} onChange={onWordRepeatsChange} label={trans('reader.wordRepeats')} disabled={!wordCards} className="w-14 text-right" />
          </SettingRow>
        </div>
      </div>
    </div>
  );
};
