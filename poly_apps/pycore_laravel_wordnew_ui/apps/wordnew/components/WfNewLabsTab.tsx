/**
 * WfNewLabsTab - the AI Cognitive Lab tab body (extracted from WfNewApp to keep
 * the shell under the 800-line modular limit). Owns no state: the forge form
 * fields + the custom-word list are owned by the shell and passed in, so a forge
 * action and a remove still route through the shell's handlers. The motion.div
 * page wrapper stays in WfNewApp (consistent with every other tab).
 */
import React from 'react';
import { BookOpen, Trash2 } from 'lucide-react';
import { ActionButton } from '@/shared/ui/ActionButton';
import { StateMessage } from '@/shared/ui/StateMessage';
import { TextField } from '@/shared/ui/TextField';
import type { ElementTheme } from '../WfNewThemes';
import type { Word } from '../api/WfNewApiTypes';

const CUSTOM_WORD_ID_PREFIX = 'custom';

interface WfNewLabsTabProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** All course words; only the `custom-*` ones are shown as forged injectors. */
  courseWords: Word[];
  /** Forge form fields (owned by the shell so the forged word reaches the live catalog). */
  newWordText: string;
  setNewWordText: (v: string) => void;
  newWordTransl: string;
  setNewWordTransl: (v: string) => void;
  newWordPhon: string;
  setNewWordPhon: (v: string) => void;
  newWordDef: string;
  setNewWordDef: (v: string) => void;
  /** Forge the current form values into a custom word. */
  onForge: () => void;
  /** Remove a forged custom word by id. */
  onRemoveCustom: (id: string) => void;
  /** Open the daily bilingual article page. */
  onOpenDailyReading: () => void;
}

export const WfNewLabsTab: React.FC<WfNewLabsTabProps> = ({
  activeTheme, trans, courseWords,
  newWordText, setNewWordText, newWordTransl, setNewWordTransl,
  newWordPhon, setNewWordPhon, newWordDef, setNewWordDef,
  onForge, onRemoveCustom, onOpenDailyReading,
}) => {
  const customWords = courseWords.filter((w) => w.id.startsWith(CUSTOM_WORD_ID_PREFIX));
  const inputClass = `font-mono ${activeTheme.inputClass}`;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center py-2">
        <h2 className="text-2xl font-black">{trans('lab.title')}</h2>
        <p className="text-zinc-500 text-xs font-mono">{trans('lab.sub')}</p>
      </div>

      {/* Entry to the daily bilingual article page. */}
      <button
        onClick={onOpenDailyReading}
        className={`w-full p-4 rounded-2xl text-left flex items-center justify-between ${activeTheme.cardClass} hover:scale-[1.01] transition-transform`}
      >
        <span className="flex items-center gap-2 text-sm font-bold">
          <BookOpen className="w-4 h-4 text-indigo-400" /> {trans('lab.dailyReading')}
        </span>
        <span className="text-xs text-zinc-500 font-mono">{trans('lab.dailyReadingSub')}</span>
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Forge Form */}
        <div className={`md:col-span-2 p-6 rounded-3xl ${activeTheme.cardClass} space-y-4`}>
          <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-indigo-400">
            {trans('lab.addWord')}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label={trans('lab.wordText')} placeholder={trans('lab.phWord')} value={newWordText} onChange={setNewWordText} inputClassName={inputClass} />
            <TextField label={trans('lab.wordTransl')} placeholder={trans('lab.phTransl')} value={newWordTransl} onChange={setNewWordTransl} inputClassName={inputClass} />
          </div>
          <TextField label={trans('lab.wordPhon')} placeholder={trans('lab.phPhon')} value={newWordPhon} onChange={setNewWordPhon} inputClassName={inputClass} />
          <TextField label={trans('lab.wordDef')} placeholder={trans('lab.phDef')} rows={3} value={newWordDef} onChange={setNewWordDef} inputClassName={inputClass} />

          <ActionButton block size="lg" onClick={onForge}>{trans('lab.btn')}</ActionButton>
        </div>

        {/* Forged lists */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-500">{trans('lab.activeInjectors')}</h4>

          <div className="space-y-2 max-h-[380px] overflow-y-auto no-scrollbar">
            {customWords.map((word) => (
              <div key={word.id} className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold text-indigo-400">{word.text}</p>
                  <p className="text-[10px] text-zinc-500 truncate mt-1">{word.translation}</p>
                </div>
                <button
                  onClick={() => onRemoveCustom(word.id)}
                  className="p-1.5 bg-white/5 rounded-lg text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {customWords.length === 0 && <StateMessage kind="empty" className="py-12">{trans('lab.noForged')}</StateMessage>}
          </div>
        </div>
      </div>
    </div>
  );
};
