/**
 * WfNewLabsTab - the AI Cognitive Lab tab body (extracted from WfNewApp to keep
 * the shell under the 800-line modular limit). Owns no state: the forge form
 * fields + the custom-word list are owned by the shell and passed in, so a forge
 * action and a remove still route through the shell's handlers. The motion.div
 * page wrapper stays in WfNewApp (consistent with every other tab).
 */
import React from 'react';
import { BookOpen, Trash2 } from 'lucide-react';
import { ElementTheme, Word } from '../WfNewTypes';

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
  const customWords = courseWords.filter((w) => w.id.startsWith('custom'));
  const inputCls = `w-full py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none ${activeTheme.inputClass}`;

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
          <BookOpen className="w-4 h-4 text-indigo-400" /> Daily Reading
        </span>
        <span className="text-xs text-zinc-500 font-mono">Bilingual articles + English audio -&gt;</span>
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Forge Form */}
        <div className={`md:col-span-2 p-6 rounded-3xl ${activeTheme.cardClass} space-y-4`}>
          <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-indigo-400">
            {trans('lab.addWord')}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-mono text-zinc-500">{trans('lab.wordText')}</label>
              <input
                type="text"
                placeholder={trans('lab.phWord')}
                value={newWordText}
                onChange={(e) => setNewWordText(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-mono text-zinc-500">{trans('lab.wordTransl')}</label>
              <input
                type="text"
                placeholder={trans('lab.phTransl')}
                value={newWordTransl}
                onChange={(e) => setNewWordTransl(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] uppercase font-mono text-zinc-500">{trans('lab.wordPhon')}</label>
            <input
              type="text"
              placeholder={trans('lab.phPhon')}
              value={newWordPhon}
              onChange={(e) => setNewWordPhon(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] uppercase font-mono text-zinc-500">{trans('lab.wordDef')}</label>
            <textarea
              rows={3}
              placeholder={trans('lab.phDef')}
              value={newWordDef}
              onChange={(e) => setNewWordDef(e.target.value)}
              className={`w-full py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none resize-none ${activeTheme.inputClass}`}
            />
          </div>

          <button
            onClick={onForge}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-2xl text-xs font-mono font-bold uppercase tracking-wider"
          >
            {trans('lab.btn')}
          </button>
        </div>

        {/* Forged lists */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-500">Live Active Injectors</h4>

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

            {customWords.length === 0 && (
              <div className="text-center py-12 text-xs font-mono text-zinc-600">
                No forged words in current live catalog. Add one to see it here!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
