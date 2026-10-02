import React, { useState } from 'react';
import { Play, Minus, Plus, ChevronDown } from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';
import { wfNewSettings } from '../WfNewSettingsStore';

/**
 * WfNewPlaybackSettings — the subtitle Playback Settings sub-page (opened from
 * the main Settings page). Edits the six subtitle-player preferences: playback
 * speed, loop-current-line, show-translation, sequential auto-next, word-list
 * page size, and word-list language. All persisted to WfNewSettingsStore.
 */
interface WfNewPlaybackSettingsProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0] as const;
const WORD_LANGUAGES = ['english', 'chinese', 'japanese', 'korean'] as const;

export const WfNewPlaybackSettings: React.FC<WfNewPlaybackSettingsProps> = ({ activeTheme, trans }) => {
  const [speed, setSpeed] = useState<number>(() => wfNewSettings.get('subtitlePlaybackSpeed'));
  const [loopLine, setLoopLine] = useState<boolean>(() => wfNewSettings.get('subtitleLoopLine'));
  const [showTranslation, setShowTranslation] = useState<boolean>(() => wfNewSettings.get('subtitleShowTranslation'));
  const [autoNext, setAutoNext] = useState<boolean>(() => wfNewSettings.get('subtitleAutoNext'));
  const [pageSize, setPageSize] = useState<number>(() => wfNewSettings.get('wordListPageSize'));
  const [wordLang, setWordLang] = useState<string>(() => wfNewSettings.get('wordListLanguage'));

  const langLabel: Record<string, string> = {
    english: trans('playset.langEnglish'),
    chinese: trans('playset.langChinese'),
    japanese: trans('playset.langJapanese'),
    korean: trans('playset.langKorean'),
  };

  const Toggle: React.FC<{ on: boolean; onClick: () => void; color?: string }> = ({ on, onClick, color = 'bg-indigo-600' }) => (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-11 h-6 rounded-full transition-all cursor-pointer ${on ? color : 'bg-zinc-300 dark:bg-zinc-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className={`p-6 rounded-3xl ${activeTheme.cardClass} border border-white/5 shadow-lg space-y-1 divide-y divide-white/5`}>
        {/* Playback speed */}
        <div className="py-3 space-y-2">
          <span className="text-xs font-bold text-zinc-800 dark:text-slate-200">{trans('playset.speed')}</span>
          <div className="flex flex-wrap gap-2">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => { setSpeed(s); wfNewSettings.setField('subtitlePlaybackSpeed', s); }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-bold border cursor-pointer transition-all ${speed === s ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Loop current line */}
        <div className="flex items-center justify-between py-3">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zinc-800 dark:text-slate-200">{trans('playset.loopLine')}</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{trans('playset.loopLineDesc')}</span>
          </div>
          <Toggle on={loopLine} onClick={() => { const v = !loopLine; setLoopLine(v); wfNewSettings.setField('subtitleLoopLine', v); }} />
        </div>

        {/* Show translation */}
        <div className="flex items-center justify-between py-3">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zinc-800 dark:text-slate-200">{trans('playset.showTranslation')}</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{trans('playset.showTranslationDesc')}</span>
          </div>
          <Toggle on={showTranslation} onClick={() => { const v = !showTranslation; setShowTranslation(v); wfNewSettings.setField('subtitleShowTranslation', v); }} color="bg-fuchsia-600" />
        </div>

        {/* Sequential auto-next */}
        <div className="flex items-center justify-between py-3">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zinc-800 dark:text-slate-200">{trans('playset.autoNext')}</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{trans('playset.autoNextDesc')}</span>
          </div>
          <Toggle on={autoNext} onClick={() => { const v = !autoNext; setAutoNext(v); wfNewSettings.setField('subtitleAutoNext', v); }} />
        </div>

        {/* Word-list page size */}
        <div className="flex items-center justify-between py-3">
          <span className="text-xs font-bold text-zinc-800 dark:text-slate-200">{trans('playset.pageSize')}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => { const v = Math.max(10, pageSize - 10); setPageSize(v); wfNewSettings.setField('wordListPageSize', v); }} className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-600 dark:text-zinc-300 cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
            <span className="min-w-[40px] text-center text-xs font-black font-mono text-zinc-800 dark:text-slate-100">{pageSize}</span>
            <button onClick={() => { const v = Math.min(100, pageSize + 10); setPageSize(v); wfNewSettings.setField('wordListPageSize', v); }} className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-600 dark:text-zinc-300 cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Word-list language */}
        <div className="py-3 space-y-2">
          <span className="text-xs font-bold text-zinc-800 dark:text-slate-200">{trans('playset.wordLanguage')}</span>
          <div className="relative">
            <select
              value={wordLang}
              onChange={(e) => { setWordLang(e.target.value); wfNewSettings.setField('wordListLanguage', e.target.value); }}
              className={`w-full py-3 pl-4 pr-10 rounded-xl text-xs font-mono outline-none transition-all cursor-pointer appearance-none ${activeTheme.inputClass}`}
            >
              {WORD_LANGUAGES.map((l) => (
                <option key={l} value={l} className="text-zinc-900">{langLabel[l]}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
