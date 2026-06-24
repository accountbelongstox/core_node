import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, MessageSquareText, ListTree, User as UserIcon, Search } from 'lucide-react';
import { Language } from '../../types';
import { api } from '../../core/api';
import type { DevHistoryIndex, DevHistoryPrompt, DevHistorySessionDetail } from '../../core/api/modules/DevHistoryAPI';
import { PAGE_SIZE, toolLabel } from './dev-history/shared';
import SessionRow from './dev-history/SessionRow';
import SessionDetailView from './dev-history/SessionDetailView';
import PromptItem from './dev-history/PromptItem';

interface DevHistoryProps {
  lang?: Language;
}

type TabId = 'sessions' | 'prompts';

const DevHistory: React.FC<DevHistoryProps> = ({ lang = 'en' }) => {
  const { t } = useTranslation();
  const tk = (k: string): string => t(`devHistoryView.${k}`);

  const [index, setIndex] = useState<DevHistoryIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabId>('sessions');
  const [filterTool, setFilterTool] = useState<string>('');
  const [filterUser, setFilterUser] = useState<string>('');
  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState<string>('');
  const [detail, setDetail] = useState<DevHistorySessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [prompts, setPrompts] = useState<DevHistoryPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptTotal, setPromptTotal] = useState(0);
  const [promptPage, setPromptPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const loadIndex = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.devHistory.getIndex();
    if (res.success && res.data) {
      setIndex(res.data);
    } else {
      setError(res.error || tk('loadError'));
    }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPrompts = useCallback(async () => {
    setPromptsLoading(true);
    const res = await api.devHistory.getPrompts({
      tool: filterTool || undefined,
      user: filterUser || undefined,
      q: debouncedSearch || undefined,
      limit: PAGE_SIZE,
      offset: (promptPage - 1) * PAGE_SIZE
    });
    if (res.success && res.data) {
      setPrompts(res.data.items || []);
      setPromptTotal(res.data.total || 0);
    } else {
      setPrompts([]);
      setPromptTotal(0);
    }
    setPromptsLoading(false);
  }, [filterTool, filterUser, debouncedSearch, promptPage]);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  useEffect(() => {
    if (tab === 'prompts') {
      loadPrompts();
    }
  }, [tab, loadPrompts]);

  // Debounce the search box into the server query (Prompts tab).
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(h);
  }, [search]);

  // Any new query/facet resets to the first page.
  useEffect(() => {
    setPromptPage(1);
  }, [debouncedSearch, filterTool, filterUser]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await api.devHistory.refresh();
    await loadIndex();
    if (tab === 'prompts') {
      await loadPrompts();
    }
    setRefreshing(false);
  };

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    const res = await api.devHistory.getSession(id);
    if (res.success && res.data) {
      setDetail(res.data);
    } else {
      setDetailError(res.error || tk('loadError'));
    }
    setDetailLoading(false);
  };

  const handlePromptSaved = (id: string, text: string) => {
    setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, text, edited: true } : p)));
  };

  const sessions = index?.sessions || [];
  const tools = index?.tools || [];
  const users = index?.users || [];

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (filterTool && s.tool !== filterTool) return false;
      if (filterUser && s.os_user !== filterUser) return false;
      if (q) {
        const hay = `${s.title} ${s.project} ${s.os_user} ${toolLabel(s.tool)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, filterTool, filterUser, search]);

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
      active
        ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/40'
        : 'bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-transparent hover:border-indigo-500/30'
    }`;

  const promptLabels = {
    copy: tk('copy'),
    copied: tk('copied'),
    edit: tk('edit'),
    save: tk('save'),
    cancel: tk('cancel'),
    edited: tk('edited')
  };

  return (
    <div data-lang={lang} className="relative z-10 h-full flex flex-col p-4 md:p-6 gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <MessageSquareText size={18} className="text-indigo-500" />
            {tk('title')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tk('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {index?.generated_at && (
            <span className="text-[11px] text-slate-400">
              {tk('generatedAt')}: {index.generated_at}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? tk('refreshing') : tk('refresh')}
          </button>
        </div>
      </div>

      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-black/5 dark:bg-white/5 p-0.5">
          <button
            onClick={() => setTab('sessions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              tab === 'sessions' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow' : 'text-slate-500'
            }`}
          >
            <ListTree size={14} /> {tk('sessions')}
          </button>
          <button
            onClick={() => setTab('prompts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              tab === 'prompts' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow' : 'text-slate-500'
            }`}
          >
            <MessageSquareText size={14} /> {tk('prompts')}
          </button>
        </div>

        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tk('search')}
            className="pl-7 pr-3 py-1.5 w-44 md:w-60 rounded-lg text-xs bg-black/5 dark:bg-white/5 border border-transparent focus:border-indigo-500/40 outline-none text-slate-700 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Facet chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setFilterTool('')} className={chip(filterTool === '')}>
          {tk('allTools')}
        </button>
        {tools.map((tool) => (
          <button key={tool} onClick={() => setFilterTool(tool)} className={chip(filterTool === tool)}>
            {toolLabel(tool)}
          </button>
        ))}
        <span className="mx-1 text-slate-300 dark:text-slate-600">|</span>
        <button onClick={() => setFilterUser('')} className={chip(filterUser === '')}>
          {tk('allUsers')}
        </button>
        {users.map((u) => (
          <button key={u} onClick={() => setFilterUser(u)} className={chip(filterUser === u)}>
            <UserIcon size={11} className="inline mr-1" />
            {u}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">…</div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-rose-500 text-sm">{error}</div>
        ) : index && index.is_dev_machine === false ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">{tk('notDevMachine')}</div>
        ) : tab === 'sessions' ? (
          <div className="h-full grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_1fr] gap-4">
            {/* Session list */}
            <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 overflow-y-auto">
              {filteredSessions.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">{tk('empty')}</div>
              ) : (
                filteredSessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    s={s}
                    active={s.id === selectedId}
                    subagentLabel={tk('subagent')}
                    onClick={() => handleSelect(s.id)}
                  />
                ))
              )}
            </div>

            {/* Session detail */}
            <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 overflow-y-auto">
              {detailLoading ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">…</div>
              ) : detail ? (
                <SessionDetailView detail={detail} subagentLabel={tk('subagent')} />
              ) : detailError ? (
                <div className="h-full flex items-center justify-center text-rose-500 text-sm">{detailError}</div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">{tk('selectSession')}</div>
              )}
            </div>
          </div>
        ) : (
          /* Prompts tab — server-side search + pagination */
          <div className="h-full rounded-xl border border-black/5 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto">
              {promptsLoading ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">…</div>
              ) : prompts.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">{tk('empty')}</div>
              ) : (
                <ul className="divide-y divide-black/5 dark:divide-white/10">
                  {prompts.map((p, i) => (
                    <PromptItem key={p.id || `${p.session_id}-${i}`} p={p} labels={promptLabels} onSaved={handlePromptSaved} />
                  ))}
                </ul>
              )}
            </div>
            {promptTotal > 0 && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-black/5 dark:border-white/10 text-[11px] text-slate-400">
                <span>{promptTotal} {tk('results')}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPromptPage((p) => Math.max(1, p - 1))}
                    disabled={promptPage <= 1 || promptsLoading}
                    className="px-2 py-1 rounded-md bg-black/5 dark:bg-white/5 disabled:opacity-40 hover:text-indigo-500"
                  >
                    {tk('prev')}
                  </button>
                  <span>
                    {tk('page')} {promptPage} / {Math.max(1, Math.ceil(promptTotal / PAGE_SIZE))}
                  </span>
                  <button
                    onClick={() => setPromptPage((p) => (p * PAGE_SIZE < promptTotal ? p + 1 : p))}
                    disabled={promptPage * PAGE_SIZE >= promptTotal || promptsLoading}
                    className="px-2 py-1 rounded-md bg-black/5 dark:bg-white/5 disabled:opacity-40 hover:text-indigo-500"
                  >
                    {tk('next')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DevHistory;
