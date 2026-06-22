import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Languages, Globe, Check, Save, Target } from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import { wfNewApi, type WfNewLanguage } from '../api';

/**
 * WfNewLanguages — the learning-language settings page.
 *
 * Source (native) language is a single choice; learning targets are MULTI-select.
 * Options come from the live /system/supported-languages catalog (the API layer
 * falls back to the built-in list offline) and the current selection from
 * /learning/languages; Save persists via setLearningLanguages (POST). Reachable
 * from Settings (see WfNewApp 'languages' tab).
 */
interface WfNewLanguagesProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  /** Mirror the saved selection back into the app (e.g. update the active target). */
  onSaved?: (selection: { native_language: string; learning_languages: string[] }) => void;
}

export const WfNewLanguages: React.FC<WfNewLanguagesProps> = ({
  activeTheme,
  trans,
  addToast,
  onSaved,
}) => {
  const [options, setOptions] = useState<WfNewLanguage[]>([]);
  const [nativeLang, setNativeLang] = useState<string>('zh');
  const [targets, setTargets] = useState<string[]>(['en']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opts = await wfNewApi.getSupportedLanguages();
        if (!cancelled) setOptions(opts);
      } catch {
        /* getSupportedLanguages already falls back to the built-in catalog */
      }
      try {
        const sel = await wfNewApi.getLearningLanguages();
        if (cancelled) return;
        setNativeLang(sel.native_language || 'zh');
        setTargets(sel.learning_languages.length ? sel.learning_languages : ['en']);
      } catch {
        /* unauthenticated / offline — keep the defaults */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleTarget = (code: string) => {
    setTargets((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const handleSave = async () => {
    if (saving) return;
    if (targets.length === 0) {
      addToast(trans('lang.needTarget'), 'warning');
      return;
    }
    setSaving(true);
    try {
      const saved = await wfNewApi.setLearningLanguages({
        native_language: nativeLang,
        learning_languages: targets,
      });
      setNativeLang(saved.native_language);
      setTargets(saved.learning_languages);
      onSaved?.(saved);
      addToast(trans('lang.saved'), 'success');
    } catch (err: any) {
      addToast(err?.message || trans('lang.saveFailed'), 'warning');
    } finally {
      setSaving(false);
    }
  };

  const labelFor = (l: WfNewLanguage) =>
    l.native_name && l.native_name !== l.name ? `${l.native_name} · ${l.name}` : l.name;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Source / native language */}
      <div className={`p-6 rounded-3xl ${activeTheme.cardClass} border border-white/5 shadow-lg space-y-3`}>
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-black text-slate-100">{trans('lang.sourceTitle')}</h3>
        </div>
        <p className="text-[11px] text-zinc-500 font-mono">{trans('lang.sourceHint')}</p>
        <select
          value={nativeLang}
          onChange={(e) => setNativeLang(e.target.value)}
          disabled={loading}
          className="w-full py-2.5 px-3 rounded-xl text-xs bg-slate-900 text-zinc-200 border border-white/10 outline-none cursor-pointer disabled:opacity-50"
        >
          {options.map((l) => (
            <option key={l.code} value={l.code}>{labelFor(l)}</option>
          ))}
        </select>
      </div>

      {/* Learning targets (multi-select) */}
      <div className={`p-6 rounded-3xl ${activeTheme.cardClass} border border-white/5 shadow-lg space-y-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-black text-slate-100">{trans('lang.targetsTitle')}</h3>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">{trans('lang.selectedCount', { count: targets.length })}</span>
        </div>
        <p className="text-[11px] text-zinc-500 font-mono">{trans('lang.targetsHint')}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {options.map((l) => {
            const active = targets.includes(l.code);
            return (
              <button
                key={l.code}
                type="button"
                disabled={loading}
                onClick={() => toggleTarget(l.code)}
                className={`px-3 py-2 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                  active
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent shadow-md'
                    : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                }`}
              >
                {active && <Check className="w-3 h-3" />}
                <span>{labelFor(l)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white text-xs font-mono font-black uppercase flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? trans('common.loading') : trans('lang.saveBtn')}</span>
        </button>
      </div>
    </div>
  );
};
