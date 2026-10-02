import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Globe, Search, Target } from 'lucide-react';
import { wfNewApi, type WfNewLanguage } from '../../api';
import { WFNEW_BUILTIN_LANGUAGES } from '../../api/WfNewApiDefaults';
import type { Translate } from './WfNewSettingChoices';

/** Most-studied languages, shown first; the rest hide behind "show all". */
const COMMON_CODES = new Set(['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'ar', 'pt', 'it', 'hi']);

export interface WfNewLanguageSelection {
  native_language: string;
  learning_languages: string[];
}

export const languageLabel = (language: WfNewLanguage): string =>
  language.native_name && language.native_name !== language.name ? `${language.native_name} · ${language.name}` : language.name;

const matchesQuery = (language: WfNewLanguage, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return language.code.toLowerCase().includes(needle)
    || (language.name || '').toLowerCase().includes(needle)
    || (language.native_name || '').toLowerCase().includes(needle);
};

/** Language catalog: preloaded options, else the live catalog, else the built-in list (never empty). */
export function useWfNewLanguageCatalog(preloaded?: WfNewLanguage[], active: boolean = true): WfNewLanguage[] {
  const [fetched, setFetched] = useState<WfNewLanguage[]>([]);
  const hasPreloaded = !!preloaded && preloaded.length > 0;
  useEffect(() => {
    if (!active || hasPreloaded) return undefined;
    let cancelled = false;
    wfNewApi.getSupportedLanguages()
      .then((list) => { if (!cancelled && list.length) setFetched(list); })
      .catch(() => { /* the api layer falls back to the built-in catalog */ });
    return () => { cancelled = true; };
  }, [active, hasPreloaded]);
  if (hasPreloaded) return preloaded as WfNewLanguage[];
  return fetched.length ? fetched : WFNEW_BUILTIN_LANGUAGES;
}

/** Sync a selection to the backend; a failure keeps the selection (applied locally) and reports the error text. */
export async function saveLearningLanguages(selection: WfNewLanguageSelection): Promise<{ saved: WfNewLanguageSelection; error: string | null }> {
  try {
    return { saved: await wfNewApi.setLearningLanguages(selection), error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '';
    return { saved: selection, error: message };
  }
}

interface SectionProps {
  kind: 'native' | 'targets';
  catalog: WfNewLanguage[];
  selected: string[];
  onPick: (code: string) => void;
  trans: Translate;
  showHint?: boolean;
  disabled?: boolean;
}

/** One language chip section (single native pick or multi targets): search, common-first, show-all. */
export const WfNewLanguageChipSection: React.FC<SectionProps> = ({ kind, catalog, selected, onPick, trans, showHint = false, disabled = false }) => {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const native = kind === 'native';
  const query = search.trim();
  const selectedSet = new Set(selected);
  const visible = query
    ? catalog.filter((language) => matchesQuery(language, query))
    : expanded ? catalog : catalog.filter((language) => COMMON_CODES.has(language.code) || selectedSet.has(language.code));
  const hiddenCount = catalog.length - catalog.filter((language) => COMMON_CODES.has(language.code) || selectedSet.has(language.code)).length;
  const HeadIcon = native ? Globe : Target;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider ${native ? 'text-emerald-400' : 'text-indigo-400'}`}>
          <HeadIcon className="h-3.5 w-3.5" />
          <span>{trans(native ? 'lang.sourceTitle' : 'lang.targetsTitle')}</span>
        </div>
        {!native && <span className="font-mono text-[10px] text-zinc-500">{trans('lang.selectedCount', { count: selected.length })}</span>}
      </div>
      {showHint && <p className="font-mono text-[11px] text-zinc-500">{trans(native ? 'lang.sourceHint' : 'lang.targetsHint')}</p>}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={trans('lang.searchPh')}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-zinc-500 outline-none focus:border-indigo-500/50"
        />
      </div>
      <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
        {visible.map((language) => {
          const active = selectedSet.has(language.code);
          return (
            <button
              key={`${kind}-${language.code}`}
              type="button"
              disabled={disabled}
              onClick={() => onPick(language.code)}
              className={`flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 font-mono text-[11px] font-bold transition-all disabled:opacity-50 ${
                active
                  ? native
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-transparent bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow'
                  : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
              }`}
            >
              {active && !native && <Check className="h-3 w-3" />}
              {languageLabel(language)}
            </button>
          );
        })}
        {query && visible.length === 0 && <span className="py-1 font-mono text-[11px] text-zinc-500">{trans('lang.noMatch')}</span>}
      </div>
      {!query && (hiddenCount > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex cursor-pointer items-center gap-1 font-mono text-[10px] font-bold text-indigo-400 hover:text-indigo-300"
        >
          {expanded
            ? <><ChevronUp className="h-3 w-3" />{trans('lang.collapse')}</>
            : <><ChevronDown className="h-3 w-3" />{trans('lang.showAll', { count: hiddenCount })}</>}
        </button>
      )}
    </div>
  );
};
