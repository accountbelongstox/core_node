import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, RefreshCw, Sparkles } from 'lucide-react';
import { wfNewApi } from '../../api';
import {
  DEFAULT_VOCAB_GROUP_NAME,
  isDefaultVocabularyGroup,
  type WordGroup,
} from '../../api/types/core';
import {
  pullDailyReadingWordGroup,
  selectDailyReadingWordGroup,
  selectedDailyReadingWordGroupId,
} from './dailyReadingWordGroupStore';

interface Props {
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  refreshToken?: number;
  /** Words read aloud in the current playback session. */
  sessionReads?: number;
  /** Distinct words newly linked to the selected group this session. */
  sessionNewWords?: number;
}

interface PanelState {
  groups: WordGroup[];
}

function syntheticDefaultGroup(): WordGroup {
  return { id: DEFAULT_VOCAB_GROUP_NAME, name: DEFAULT_VOCAB_GROUP_NAME, count: 0 };
}

/** All groups with the Default Vocabulary Group guaranteed present and first. */
function withDefaultGroup(groups: WordGroup[]): WordGroup[] {
  const list = groups.some(isDefaultVocabularyGroup)
    ? [...groups]
    : [syntheticDefaultGroup(), ...groups];
  return list.sort(
    (a, b) => Number(isDefaultVocabularyGroup(b)) - Number(isDefaultVocabularyGroup(a)),
  );
}

export const WordNewDailyReadingWordGroupsPanel: React.FC<Props> = ({
  trans,
  refreshToken = 0,
  sessionReads = 0,
  sessionNewWords = 0,
}) => {
  const [state, setState] = useState<PanelState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => selectedDailyReadingWordGroupId(),
  );
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const groups = await wfNewApi.getWordGroups();
      if (mounted.current) setState({ groups });
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

  const groups = useMemo(
    () => withDefaultGroup((state?.groups ?? []).filter((group) => {
      const language = group.language?.trim().toLowerCase();
      return !language || language === 'en' || language === 'english' || isDefaultVocabularyGroup(group);
    })),
    [state],
  );

  // Unless the user manually picked a group, the selection is the Default Vocabulary Group.
  const effectiveSelectedId = useMemo(() => {
    if (groups.length === 0) return null;
    if (selectedId && groups.some((group) => group.id === selectedId)) return selectedId;
    return groups.find(isDefaultVocabularyGroup)?.id ?? groups[0].id;
  }, [groups, selectedId]);

  // Local persist (emits the change event the player rebuilds on) + account
  // roam push are centralized in the daily-reading word-group store.
  const selectGroup = useCallback((id: string) => {
    setSelectedId(id);
    selectDailyReadingWordGroup(id);
  }, []);

  // Backend restore on mount: the roamed selection wins over the local one;
  // with no remote value the store pushes the local selection up once.
  useEffect(() => {
    void pullDailyReadingWordGroup().then((appliedId) => {
      if (appliedId && mounted.current) setSelectedId(appliedId);
    });
  }, []);

  useEffect(() => {
    if (!selectedId || !effectiveSelectedId || selectedId === effectiveSelectedId) return;
    selectGroup(effectiveSelectedId);
  }, [effectiveSelectedId, selectGroup, selectedId]);

  const selectedGroup = groups.find((group) => group.id === effectiveSelectedId) ?? null;

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

      {groups.length > 0 && effectiveSelectedId && (
        <select
          value={effectiveSelectedId}
          onChange={(event) => selectGroup(event.target.value)}
          aria-label={trans('home.dailyReading.wordGroups')}
          className="w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-zinc-300"
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name} · {group.count} {trans('home.dailyReading.wordsUnit')}
            </option>
          ))}
        </select>
      )}

      {selectedGroup && (
        <div className={`rounded-xl border p-3 ${isDefaultVocabularyGroup(selectedGroup)
          ? 'border-indigo-500/30 bg-indigo-500/10'
          : 'border-white/10 bg-white/[0.03]'}`}>
          <div className="flex items-center justify-between text-xs">
            <span className={`flex items-center gap-1.5 font-bold ${isDefaultVocabularyGroup(selectedGroup) ? 'text-indigo-200' : 'text-zinc-200'}`}>
              <Sparkles className="w-3 h-3" />
              {selectedGroup.name}
            </span>
            <span className="font-mono text-[10px] text-indigo-300">
              {selectedGroup.count} {trans('home.dailyReading.wordsUnit')}
              {typeof selectedGroup.progress === 'number'
                ? ` · ${Math.round(selectedGroup.progress)}%`
                : ''}
            </span>
          </div>
          {(sessionReads > 0 || sessionNewWords > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 pt-2 text-[10px] font-mono text-zinc-500">
              {sessionReads > 0 && (
                <span>{trans('home.dailyReading.sessionReads', { count: sessionReads })}</span>
              )}
              {sessionNewWords > 0 && (
                <span className="text-emerald-400">
                  {trans('home.dailyReading.sessionNewWords', { count: sessionNewWords })}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
