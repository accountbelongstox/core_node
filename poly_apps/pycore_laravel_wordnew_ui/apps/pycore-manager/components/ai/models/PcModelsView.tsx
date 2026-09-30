/**
 * PcModelsView — the manifest-driven model list: categories come from
 * `ui/ai_hub/catalog`, each row is a PcModelRow. Blocked (masked) models sink to
 * the bottom of their category and show their reason with a Retry action.
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, RefreshCcw, Search } from 'lucide-react';
import { retryAiHubBoot, useAiHubCatalog, usePcModelLive } from '@/apps/pycore-manager/api';
import type { AiHubCategory, AiHubEntry } from '@/apps/pycore-manager/api';
import { usePcRefreshSignal } from '../../../hooks/usePcRefreshSignal';
import { pcErrorCodeText } from '../../../utils/pcErrorCodes';
import { aiHubCategoryMeta } from '../../../utils/pcAiHubMeta';
import { PcLiveSystemMeters } from '../live/PcLiveSystemMeters';
import PcSystemInfoPanel from './PcSystemInfoPanel';
import { PcModelHistoryDrawer } from './PcModelHistoryDrawer';
import { PcModelRow } from './PcModelRow';
import { PcTtsSettingsBar } from './PcTtsSettingsBar';

const FILTER_ALL = 'all';
const CATEGORY_TTS = 'tts';

const isBlocked = (entry: AiHubEntry): boolean => entry.boot.state === 'blocked';

function matchesQuery(entry: AiHubEntry, query: string): boolean {
  if (!query) return true;
  const haystack = [entry.id, entry.note ?? '', ...(entry.aliases ?? [])].join(' ').toLowerCase();
  return haystack.includes(query);
}

function visibleEntries(category: AiHubCategory, query: string, onlyBlocked: boolean): AiHubEntry[] {
  return category.entries
    .filter((entry) => matchesQuery(entry, query) && (!onlyBlocked || isBlocked(entry)))
    .sort((left, right) => Number(isBlocked(left)) - Number(isBlocked(right)));
}

const PcModelsView: React.FC<{ refreshSignal?: number }> = ({ refreshSignal }) => {
  const { t } = useTranslation('pc');
  const catalog = useAiHubCatalog();
  const live = usePcModelLive(true);
  const [category, setCategory] = useState<string>(FILTER_ALL);
  const [query, setQuery] = useState('');
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [historyEntry, setHistoryEntry] = useState<AiHubEntry | null>(null);

  usePcRefreshSignal(refreshSignal, catalog.refresh);

  const blockedCount = useMemo(() => catalog.entries.filter(isBlocked).length, [catalog.entries]);
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.categories
      .filter((group) => category === FILTER_ALL || group.id === category)
      .map((group) => ({ group, entries: visibleEntries(group, needle, onlyBlocked) }))
      .filter(({ entries }) => entries.length > 0);
  }, [catalog.categories, category, query, onlyBlocked]);

  const recheck = async () => {
    setRechecking(true);
    try {
      await retryAiHubBoot();
    } finally {
      setRechecking(false);
    }
  };

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {catalog.error && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">{pcErrorCodeText(catalog.error)}</span>
          <button
            type="button"
            onClick={() => { void catalog.refresh(); }}
            className="ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold pc-glass text-indigo-500">
            <RefreshCcw className="w-3 h-3" /> {t('common.retry')}
          </button>
        </div>
      )}

      <section className="pc-glass p-5">
        <PcLiveSystemMeters system={live.snapshot?.system} />
      </section>

      <section className="pc-glass p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {[FILTER_ALL, ...catalog.categories.map((group) => group.id)].map((id) => {
            const meta = id === FILTER_ALL ? null : aiHubCategoryMeta(id);
            const total = id === FILTER_ALL
              ? catalog.entries.length
              : catalog.categories.find((group) => group.id === id)?.entries.length ?? 0;
            const Icon = meta?.Icon;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition ${
                  category === id ? 'bg-indigo-500/15 text-indigo-500' : 'text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
                }`}>
                {Icon && <Icon className={`w-3.5 h-3.5 ${meta?.accent ?? ''}`} />}
                {id === FILTER_ALL ? t('aiHub.models.all') : t(`aiHub.categories.${id}`, { defaultValue: id })}
                <span className="opacity-60 font-mono">{total}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('aiHub.models.search')}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-400"
            />
          </label>
          <button
            type="button"
            onClick={() => setOnlyBlocked((value) => !value)}
            className={`px-3 py-2 rounded-xl text-[11px] font-bold transition ${
              onlyBlocked ? 'bg-rose-500/15 text-rose-500' : 'pc-glass text-slate-500 hover:bg-rose-500/10'
            }`}>
            {t('aiHub.models.blockedOnly', { count: blockedCount })}
          </button>
          <button
            type="button"
            onClick={() => { void recheck(); }}
            disabled={rechecking}
            title={t('aiHub.models.recheckTitle')}
            className="px-3 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1 pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50">
            {rechecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
            {t('aiHub.models.recheck')}
          </button>
        </div>
      </section>

      {catalog.loading && !catalog.loaded ? (
        <div className="text-xs text-slate-500 py-8 text-center flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> {t('aiHub.models.loading')}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
          {t('aiHub.models.empty')}
        </div>
      ) : (
        groups.map(({ group, entries }) => {
          const meta = aiHubCategoryMeta(group.id);
          const Icon = meta.Icon;
          const blocked = group.entries.filter(isBlocked).length;
          return (
            <section key={group.id} className="pc-glass p-5 space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <Icon className={`w-4 h-4 ${meta.accent}`} />
                {t(`aiHub.categories.${group.id}`, { defaultValue: group.id })}
                <span className="text-[10px] font-mono font-normal text-slate-400">
                  {t('aiHub.models.counts', { ready: group.entries.length - blocked, blocked })}
                </span>
              </h2>
              {group.id === CATEGORY_TTS && <PcTtsSettingsBar />}
              <div className="space-y-2">
                {entries.map((entry) => (
                  <PcModelRow key={`${entry.category}:${entry.id}`} entry={entry} onHistory={setHistoryEntry} />
                ))}
              </div>
            </section>
          );
        })
      )}

      <PcSystemInfoPanel refreshSignal={refreshSignal} />
      <PcModelHistoryDrawer entry={historyEntry} onClose={() => setHistoryEntry(null)} />
    </div>
  );
};

export default PcModelsView;
