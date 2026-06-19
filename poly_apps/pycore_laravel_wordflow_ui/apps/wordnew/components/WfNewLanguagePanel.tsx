import React, { useEffect, useState } from 'react';
import { Languages, Globe, Target, Check, X, Save } from 'lucide-react';
import Portal from '../../../components/shared/Portal';
import { OVERLAY_Z, OVERLAY_CONTAINER, OVERLAY_BACKDROP } from '../../../styles/overlay';
import { wfNewApi, type WfNewLanguage } from '../api';

/**
 * WfNewLanguagePanel — the SHARED floating language picker, usable anywhere.
 *
 * One reusable popup (Portal + OVERLAY framework, like WfNewApiServerDialog) that
 * lets the user choose their NATIVE/source language (single) and MULTIPLE learning
 * targets. Self-contained: it fetches the backend-aligned catalog on open (falls
 * back to the built-in list offline) and, on Save, syncs to the backend
 * (wfNewApi.setLearningLanguages) AND calls onSave so the host updates its own
 * local state. Drop it in any page: render it controlled (open/onClose) behind a
 * button.
 */
interface WfNewLanguagePanelProps {
  open: boolean;
  onClose: () => void;
  nativeLang: string;
  targetLangs: string[];
  /** Optional preloaded options; when omitted the panel fetches them itself. */
  options?: WfNewLanguage[];
  /** Called with the saved selection (host updates its local display). */
  onSave: (sel: { native_language: string; learning_languages: string[] }) => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** Optional toast for validation/feedback. */
  addToast?: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
}

export const WfNewLanguagePanel: React.FC<WfNewLanguagePanelProps> = ({
  open, onClose, nativeLang, targetLangs, options, onSave, trans, addToast,
}) => {
  const [opts, setOpts] = useState<WfNewLanguage[]>(options || []);
  const [native, setNative] = useState(nativeLang);
  const [targets, setTargets] = useState<string[]>(targetLangs);
  const [saving, setSaving] = useState(false);

  // Reset the draft to the host's values each time the panel opens.
  useEffect(() => {
    if (open) { setNative(nativeLang); setTargets(targetLangs); }
  }, [open, nativeLang, targetLangs]);

  // Fetch the catalog on open when not preloaded.
  useEffect(() => {
    if (!open || (options && options.length)) { if (options) setOpts(options); return; }
    let cancelled = false;
    (async () => {
      try {
        const list = await wfNewApi.getSupportedLanguages();
        if (!cancelled && list.length) setOpts(list);
      } catch { /* api layer falls back to built-ins */ }
    })();
    return () => { cancelled = true; };
  }, [open, options]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggleTarget = (code: string) =>
    setTargets((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const labelFor = (l: WfNewLanguage) =>
    l.native_name && l.native_name !== l.name ? `${l.native_name} · ${l.name}` : l.name;

  const handleSave = async () => {
    if (saving) return;
    if (targets.length === 0) { addToast?.(trans('lang.needTarget'), 'warning'); return; }
    setSaving(true);
    const sel = { native_language: native, learning_languages: targets };
    try {
      const saved = await wfNewApi.setLearningLanguages(sel);
      onSave(saved);
      addToast?.(trans('lang.saved'), 'success');
    } catch (err: any) {
      // Still update locally; surface the error.
      onSave(sel);
      addToast?.(err?.message || trans('lang.saveFailed'), 'warning');
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <Portal>
      <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal}`}>
        <div className={`absolute inset-0 ${OVERLAY_BACKDROP}`} onClick={onClose} />
        <div className="relative w-full max-w-md bg-zinc-900/95 border border-white/10 rounded-3xl shadow-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
              <Languages className="w-4 h-4 text-indigo-400" />
              {trans('lang.title')}
            </h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Native / source language (single) */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
              <Globe className="w-3.5 h-3.5" /><span>{trans('lang.sourceTitle')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {opts.map((l) => (
                <button
                  key={`n-${l.code}`}
                  type="button"
                  onClick={() => setNative(l.code)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-bold border cursor-pointer transition-all ${
                    native === l.code ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300' : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {labelFor(l)}
                </button>
              ))}
            </div>
          </div>

          {/* Learning targets (multi) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-400">
                <Target className="w-3.5 h-3.5" /><span>{trans('lang.targetsTitle')}</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">{trans('lang.selectedCount', { count: targets.length })}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {opts.map((l) => {
                const active = targets.includes(l.code);
                return (
                  <button
                    key={`t-${l.code}`}
                    type="button"
                    onClick={() => toggleTarget(l.code)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-bold border cursor-pointer transition-all flex items-center gap-1 ${
                      active ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent shadow' : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {active && <Check className="w-3 h-3" />}{labelFor(l)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-300 border border-white/10 cursor-pointer">
              {trans('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white text-xs font-mono font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? trans('common.loading') : trans('lang.saveBtn')}</span>
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};
