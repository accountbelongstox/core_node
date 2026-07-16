import React from 'react';
import { Plus, Trash2, GripVertical, Monitor, Volume2 } from 'lucide-react';
import type { WfNewReaderPlayStep, WfNewReaderDisplayMode } from '../../api/types/bookProgress';
import { READER_SPEED_OPTIONS } from '../../constants/WfBookReaderConstants';
import { formatBookLangLabel } from '../../utils/WfBookReaderLangUtils';
import type { ElementTheme } from '../../WfNewTypes';

interface WfBookReaderSettingsPanelProps {
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
  onModeChange: (simul: boolean) => void;
  onToggleLang: (code: string) => void;
  onDisplayModeChange: (mode: WfNewReaderDisplayMode) => void;
  onSequenceChange: (seq: WfNewReaderPlayStep[]) => void;
  onSpeedChange: (lang: string, speed: number) => void;
  onAutoAdvanceChange: (v: boolean) => void;
  onRepeatOneChange: (v: boolean) => void;
  onAutoPlayOnOpenChange: (v: boolean) => void;
  onBrowserTtsChange: (v: boolean) => void;
}

export const WfBookReaderSettingsPanel: React.FC<WfBookReaderSettingsPanelProps> = ({
  activeTheme, trans, languages, simul, selectedLangs, displayMode, sequence, speedByLang,
  autoAdvance, repeatOne, autoPlayOnOpen, browserTts,
  onModeChange, onToggleLang, onDisplayModeChange, onSequenceChange, onSpeedChange,
  onAutoAdvanceChange, onRepeatOneChange, onAutoPlayOnOpenChange, onBrowserTtsChange,
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

  return (
    <div className={`rounded-3xl border border-white/5 p-4 sm:p-5 space-y-5 text-xs ${activeTheme.cardClass}`}>
      <div className={`flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider ${activeTheme.accentText}`}>
        <Monitor className="w-4 h-4" />
        {trans('reader.settingsUi')}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2.5">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">{trans('reader.languages')}</span>
          <div className="flex rounded-lg bg-white/5 border border-white/5 p-0.5 w-fit">
            <button type="button" onClick={() => onModeChange(false)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono cursor-pointer ${!simul ? activeTheme.accentBg : 'text-zinc-400'}`}>
              {trans('reader.modeSingle')}
            </button>
            <button type="button" onClick={() => onModeChange(true)} disabled={languages.length < 2} className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono cursor-pointer disabled:opacity-30 ${simul ? activeTheme.accentBg : 'text-zinc-400'}`}>
              {trans('reader.modeSimul')}
            </button>
          </div>
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
          <div className="flex rounded-lg bg-white/5 border border-white/5 p-0.5 w-fit">
            <button type="button" onClick={() => onDisplayModeChange('interleaved')} className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono cursor-pointer ${displayMode === 'interleaved' ? 'bg-indigo-500/20 text-indigo-200' : 'text-zinc-400'}`}>
              {trans('reader.displayInterleaved')}
            </button>
            <button type="button" onClick={() => onDisplayModeChange('stacked')} className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono cursor-pointer ${displayMode === 'stacked' ? 'bg-indigo-500/20 text-indigo-200' : 'text-zinc-400'}`}>
              {trans('reader.displayStacked')}
            </button>
          </div>
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
                <select value={step.lang} onChange={(e) => updateStep(idx, { lang: e.target.value })} className="bg-slate-900/80 text-zinc-200 text-[11px] font-mono border border-white/10 rounded py-1 px-2 cursor-pointer">
                  {languages.map((l) => <option key={l} value={l}>{label(l)}</option>)}
                </select>
                <span className="text-zinc-500 font-mono">×</span>
                <select value={step.repeat} onChange={(e) => updateStep(idx, { repeat: Number(e.target.value) })} className="bg-slate-900/80 text-zinc-200 text-[11px] font-mono border border-white/10 rounded py-1 px-2 cursor-pointer w-16">
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
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
              <div className="flex rounded-lg bg-white/5 p-0.5">
                {READER_SPEED_OPTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => onSpeedChange(lang, s)} className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono cursor-pointer ${(speedByLang[lang] ?? 1) === s ? activeTheme.accentBg : 'text-zinc-500'}`}>
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 font-mono text-zinc-400">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={autoAdvance} onChange={(e) => onAutoAdvanceChange(e.target.checked)} />
            {trans('reader.autoAdvance')}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={repeatOne} onChange={(e) => onRepeatOneChange(e.target.checked)} />
            {trans('reader.repeatOne')}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={autoPlayOnOpen} onChange={(e) => onAutoPlayOnOpenChange(e.target.checked)} />
            {trans('reader.autoPlayOnOpen')}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer" title={trans('reader.browserTtsHint')}>
            <input type="checkbox" checked={browserTts} onChange={(e) => onBrowserTtsChange(e.target.checked)} />
            {trans('reader.browserTts')}
          </label>
        </div>
      </div>
    </div>
  );
};
