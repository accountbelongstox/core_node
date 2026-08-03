import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookMarked, RefreshCw, Sparkles } from 'lucide-react';
import { wfNewApi } from '../../api';
import { isDefaultVocabularyGroup, type WordGroup } from '../../api/types/core';

interface Props {
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  refreshToken?: number;
}

interface PanelState {
  groups: WordGroup[];
  defaultGroup: WordGroup | null;
}

export const WordNewDailyReadingWordGroupsPanel: React.FC<Props> = ({ trans, refreshToken = 0 }) => {
  const [state, setState] = useState<PanelState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const groups = await wfNewApi.getWordGroups();
      const defaultGroup = groups.find(isDefaultVocabularyGroup) ?? null;
      if (mounted.current) setState({ groups, defaultGroup });
    } catch (loadError) {
      if (mounted.current) setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, [load, refreshToken]);

  const otherGroups = state?.groups.filter((group) => !isDefaultVocabularyGroup(group)) ?? [];

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-black font-mono uppercase tracking-widest text-indigo-300">
          <BookMarked className="w-3.5 h-3.5" />
          {trans('home.dailyReading.wordGroups')}
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          className="p-1.5 rounded-lg border border-white/10 text-zinc-500 hover:text-indigo-300 transition-colors"
          title={trans('home.dailyReading.refresh')}
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-[11px] text-rose-400">{error}</p>}

      {state?.defaultGroup && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-bold text-indigo-200">
              <Sparkles className="w-3 h-3" />
              {state.defaultGroup.name}
            </span>
            <span className="font-mono text-[10px] text-indigo-300">
              {state.defaultGroup.count} {trans('home.dailyReading.wordsUnit')}
              {typeof state.defaultGroup.progress === 'number'
                ? ` · ${Math.round(state.defaultGroup.progress)}%`
                : ''}
            </span>
          </div>
        </div>
      )}

      {otherGroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {otherGroups.map((group) => (
            <span
              key={group.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 text-[10px] text-zinc-400"
              title={group.description || group.name}
            >
              {group.name}
              <span className="font-mono text-zinc-600">{group.count}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
};
