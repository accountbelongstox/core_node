import React, { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { BookMarked, RefreshCw, Sparkles } from 'lucide-react';
import {
  isDefaultVocabularyGroup,
} from '../../api/types/core';
import {
  dailyReadingWordGroups,
  dailyReadingWordGroupSnapshot,
  selectDailyReadingWordGroup,
  subscribeDailyReadingWordGroups,
  synchronizeDailyReadingWordGroups,
} from './dailyReadingWordGroupStore';
import { navigateToWordGroup } from '../../routing/WordNewHashRoutes';

interface Props {
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  refreshToken?: number;
  /** Words read aloud in the current playback session. */
  sessionReads?: number;
  /** Distinct words newly linked to the selected group this session. */
  sessionNewWords?: number;
}

export const WordNewDailyReadingWordGroupsPanel: React.FC<Props> = ({
  trans,
  refreshToken = 0,
  sessionReads = 0,
  sessionNewWords = 0,
}) => {
  const store = useSyncExternalStore(
    subscribeDailyReadingWordGroups,
    dailyReadingWordGroupSnapshot,
    dailyReadingWordGroupSnapshot,
  );

  useEffect(() => {
    void synchronizeDailyReadingWordGroups(refreshToken > 0).catch(() => undefined);
  }, [refreshToken]);

  const groups = useMemo(
    () => dailyReadingWordGroups(store.groups),
    [store.groups],
  );

  // Unless the user manually picked a group, the selection is the Default Vocabulary Group.
  const effectiveSelectedId = useMemo(() => {
    if (groups.length === 0) return null;
    if (store.id && groups.some((group) => group.id === store.id)) return store.id;
    return groups.find(isDefaultVocabularyGroup)?.id ?? groups[0].id;
  }, [groups, store.id]);

  // Local persist (emits the change event the player rebuilds on) + account
  // roam push are centralized in the daily-reading word-group store.
  const selectGroup = useCallback((id: string) => {
    selectDailyReadingWordGroup(id);
  }, []);

  useEffect(() => {
    if (!store.id || !effectiveSelectedId || store.id === effectiveSelectedId) return;
    selectGroup(effectiveSelectedId);
  }, [effectiveSelectedId, selectGroup, store.id]);

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
          onClick={() => void synchronizeDailyReadingWordGroups(true).catch(() => undefined)}
          className="p-1.5 rounded-lg border border-white/10 text-zinc-500 hover:text-indigo-300 transition-colors"
          title={trans('home.dailyReading.refresh')}
        >
          <RefreshCw className={`w-3 h-3 ${store.loading || store.syncing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {store.error && <p className="text-[11px] text-rose-400">{store.error}</p>}

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
            <button
              type="button"
              onClick={() => navigateToWordGroup(selectedGroup.id)}
              className="font-mono text-[10px] text-indigo-300 underline decoration-indigo-500/40 underline-offset-2 hover:text-indigo-100"
              title={trans('home.openCurrentGroup')}
            >
              {selectedGroup.count} {trans('home.dailyReading.wordsUnit')}
              {typeof selectedGroup.progress === 'number'
                ? ` · ${Math.round(selectedGroup.progress)}%`
                : ''}
            </button>
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
