/**
 * PcSentenceVoiceVariantsPanel - per-language sentence-audio voice variant editor.
 * GET/POST/DELETE /api/local/sentence-audio/variants (pycore proxies laravel).
 *
 * Renders a table of variant specs (variant_key, accent, gender, is_primary).
 * Rows are edited locally; the Save button POSTs the full spec list for the
 * selected language. Exactly one row is primary (radio-select).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioLines, RefreshCw, AlertTriangle, Loader2, Plus, Trash2, Save,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { SentenceVoiceVariant } from '../../../core/api-libs/pycore/pycoreTypes';

const LANG_OPTIONS = ['en', 'zh', 'ja', 'ko'];

/** Default 3-row en spec set shown when the backend returns an empty list. */
const DEFAULT_EN_SPECS: DraftSpec[] = [
  { variant_key: 'us_f', accent: 'us', gender: 'female', is_primary: true },
  { variant_key: 'uk_f', accent: 'uk', gender: 'female', is_primary: false },
  { variant_key: 'us_m', accent: 'us', gender: 'male', is_primary: false },
];

/** Local editable row (lang is panel-level, not per-row). */
type DraftSpec = {
  variant_key: string;
  accent: string;
  gender: string;
  is_primary: boolean;
};

const toDraft = (v: SentenceVoiceVariant): DraftSpec => ({
  variant_key: v.variant_key || '',
  accent: v.accent || '',
  gender: v.gender || 'female',
  is_primary: !!v.is_primary,
});

const emptyDraft = (): DraftSpec => ({
  variant_key: '', accent: '', gender: 'female', is_primary: false,
});

export const PcSentenceVoiceVariantsPanel: React.FC<{ lang?: string }> = ({
  lang: initialLang = 'en',
}) => {
  const [lang, setLang] = useState(initialLang);
  const [specs, setSpecs] = useState<DraftSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async (l: string) => {
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const r = await pycoreApi.getSentenceVoiceVariants(l);
      if (!mounted.current) return;
      const list = Array.isArray(r) ? r : [];
      if (list.length) {
        setSpecs(list.map(toDraft));
      } else {
        // Empty backend list: seed the default en rows so the user has a starting point.
        setSpecs(l === 'en' ? DEFAULT_EN_SPECS.map((s) => ({ ...s })) : [emptyDraft()]);
      }
    } catch (e: any) {
      if (!mounted.current) return;
      setErr(e?.message || 'variants unavailable');
      setSpecs(l === 'en' ? DEFAULT_EN_SPECS.map((s) => ({ ...s })) : [emptyDraft()]);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(lang); }, [lang, load]);

  const setPrimary = (idx: number) => {
    setSpecs((prev) => prev.map((s, i) => ({ ...s, is_primary: i === idx })));
  };

  const updateRow = (idx: number, field: keyof DraftSpec, value: string) => {
    setSpecs((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const addRow = () => {
    setSpecs((prev) => [...prev, emptyDraft()]);
  };

  const removeRow = (idx: number) => {
    setSpecs((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // If the primary row was removed, promote the first remaining row.
      if (!next.some((s) => s.is_primary) && next.length) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next.length ? next : [emptyDraft()];
    });
  };

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      // Ensure exactly one primary (promote the first if none is primary).
      let draft = specs;
      if (!draft.some((s) => s.is_primary) && draft.length) {
        draft = draft.map((s, i) => (i === 0 ? { ...s, is_primary: true } : s));
        setSpecs(draft);
      }
      const payload = draft.map((s) => ({
        variant_key: s.variant_key.trim(),
        accent: s.accent || null,
        gender: s.gender,
        is_primary: !!s.is_primary,
      }));
      const r = await pycoreApi.saveSentenceVoiceVariants(lang, payload);
      if (!mounted.current) return;
      if (r && r.success !== false) {
        const saved = Array.isArray(r.specs) ? r.specs : [];
        if (saved.length) setSpecs(saved.map(toDraft));
        setNotice({ ok: true, text: 'Saved' });
      } else {
        setNotice({ ok: false, text: (r as any)?.error || 'save failed' });
      }
    } catch (e: any) {
      if (mounted.current) setNotice({ ok: false, text: e?.message || 'save failed' });
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  return (
    <div className="pc-glass rounded-2xl p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <AudioLines className="w-4 h-4 text-teal-400 shrink-0" />
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
          Voice Variants
        </span>
        <span className="text-[10px] text-slate-400">
          per-language sentence TTS accent / gender
        </span>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="ml-auto px-2 py-1 text-xs rounded-lg border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200"
        >
          {LANG_OPTIONS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => load(lang)}
          disabled={loading}
          className="p-1.5 rounded-lg pc-glass hover:bg-teal-500/10 text-teal-500 transition disabled:opacity-50"
          title="Reload"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {err && (
        <p className="text-[11px] text-rose-500">
          <AlertTriangle className="w-3 h-3 inline mr-1" />{err}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> loading…
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-500/10">
                  <th className="text-left py-1.5 px-2 font-bold">variant_key</th>
                  <th className="text-left py-1.5 px-2 font-bold">accent</th>
                  <th className="text-left py-1.5 px-2 font-bold">gender</th>
                  <th className="text-center py-1.5 px-2 font-bold">primary</th>
                  <th className="py-1.5 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-500/10">
                {specs.map((s, idx) => (
                  <tr key={idx} className="text-slate-700 dark:text-slate-200">
                    <td className="py-1.5 px-2">
                      <input
                        type="text"
                        value={s.variant_key}
                        onChange={(e) => updateRow(idx, 'variant_key', e.target.value)}
                        placeholder="e.g. us_f"
                        className="w-full px-2 py-1 text-xs font-mono rounded-lg border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200"
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <select
                        value={s.accent}
                        onChange={(e) => updateRow(idx, 'accent', e.target.value)}
                        className="px-2 py-1 text-xs rounded-lg border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200"
                      >
                        <option value="">-</option>
                        <option value="us">us</option>
                        <option value="uk">uk</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      <select
                        value={s.gender}
                        onChange={(e) => updateRow(idx, 'gender', e.target.value)}
                        className="px-2 py-1 text-xs rounded-lg border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200"
                      >
                        <option value="female">female</option>
                        <option value="male">male</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <input
                        type="radio"
                        name="primary-variant"
                        checked={s.is_primary}
                        onChange={() => setPrimary(idx)}
                        className="rounded border-slate-300"
                        title="Set as primary"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition"
                        title="Remove row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold pc-glass text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add row
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {notice && (
            <p className={`text-[11px] ${notice.ok ? 'text-emerald-500' : 'text-rose-500'}`}>
              {notice.text}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default PcSentenceVoiceVariantsPanel;
