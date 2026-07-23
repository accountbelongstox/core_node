/**
 * Agent History — local Claude/Codex/Cursor/Gemini/Kimi/Antigravity sessions extracted by pycore.
 * Reads /api/local/agent-history/* (no Laravel login). Auto-refreshes every 10s.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, MessageSquareText, ListTree, User as UserIcon, Search, Radio } from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore/PycoreApi';
import type {
  AgentHistoryIndex,
  AgentHistoryPrompt,
  AgentHistorySessionDetail,
} from '../../../core/api-libs/pycore/pycoreTypes';
import { PAGE_SIZE, toolLabel } from '../../../components/views/dev-history/shared';
import SessionRow from '../../../components/views/dev-history/SessionRow';
import SessionDetailView from '../../../components/views/dev-history/SessionDetailView';
import PcAgentHistoryConfigPanel from './agent-history/PcAgentHistoryConfigPanel';
import PcAgentHistoryRecords from './agent-history/PcAgentHistoryRecords';
import PcAgentHistoryPromptItem from './agent-history/PcAgentHistoryPromptItem';

type TabId = 'sessions' | 'prompts';

const POLL_MS = 10_000;

const PcAgentHistoryPage: React.FC = () => {
  const { t } = useTranslation('pc');
  const tk = (k: string): string => t(`agentHistory.${k}`);

  const [index, setIndex] = useState<AgentHistoryIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);

  const [tab, setTab] = useState<TabId>('sessions');
  const [filterTool, setFilterTool] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<AgentHistorySessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [prompts, setPrompts] = useState<AgentHistoryPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptTotal, setPromptTotal] = useState(0);
  const [promptPage, setPromptPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const loadIndex = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const res = await pycoreApi.getAgentHistoryIndex();
    if (res.success && res.data) {
      setIndex(res.data);
    } else if (!silent) {
      setError(res.error || t('agentHistory.loadError'));
    }
    if (!silent) setLoading(false);
  }, [t]);

  const loadPrompts = useCallback(async () => {
    setPromptsLoading(true);
    const res = await pycoreApi.getAgentHistoryPrompts({
      tool: filterTool || undefined,
      user: filterUser || undefined,
      q: debouncedSearch || undefined,
      limit: PAGE_SIZE,
      offset: (promptPage - 1) * PAGE_SIZE,
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

  useEffect(() => { loadIndex(); }, [loadIndex]);

  useEffect(() => {
    if (tab === 'prompts') loadPrompts();
  }, [tab, loadPrompts]);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => { setPromptPage(1); }, [debouncedSearch, filterTool, filterUser]);

  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => {
      loadIndex(true);
      if (tab === 'prompts') loadPrompts();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [live, tab, loadIndex, loadPrompts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await pycoreApi.refreshAgentHistory();
    await loadIndex();
    if (tab === 'prompts') await loadPrompts();
    setRefreshing(false);
  };

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    const res = await pycoreApi.getAgentHistorySession(id);
    if (res.success && res.data) {
      setDetail(res.data);
    } else {
      setDetailError(res.error || tk('loadError'));
    }
    setDetailLoading(false);
  };

  const handlePromptSaved = (id: string, text: string) => {
    setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, text, edited: true } : p)));
    if (detail) {
      setDetail({
        ...detail,
        prompts: detail.prompts.map((p) => (p.id === id ? { ...p, text, edited: true } : p)),
      });
    }
  };

  const filteredSessions = useMemo(() => {
    const list = index?.sessions || [];
    const q = search.trim().toLowerCase();
    return list.filter((s) => {
      if (filterTool && s.tool !== filterTool) return false;
      if (filterUser && s.os_user !== filterUser) return false;
      if (!q) return true;
      const hay = `${s.title} ${s.project} ${s.tool} ${s.os_user}`.toLowerCase();
      return hay.includes(q);
    });
  }, [index, filterTool, filterUser, search]);

  const promptLabels = {
    copy: tk('copy'),
    copied: tk('copied'),
    edit: tk('edit'),
    save: tk('save'),
    cancel: tk('cancel'),
    edited: tk('edited'),
  };

  const totalPages = Math.max(1, Math.ceil(promptTotal / PAGE_SIZE));

  return (
    <div className="h-full flex flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{tk('title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{tk('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              live
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-300 dark:border-white/10 text-slate-500'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${live ? 'animate-pulse' : ''}`} />
            {live ? tk('liveOn') : tk('liveOff')}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {tk('refresh')}
          </button>
        </div>
      </header>

      {index?.generated_at && (
        <div className="text-xs font-mono text-slate-400">
          {tk('updated')}: {index.generated_at}
          <span className="ml-3">
            {index.counts?.sessions ?? index.sessions?.length ?? 0} {tk('sessionCount')}
            {' · '}
            {index.counts?.prompts ?? 0} {tk('promptCount')}
          </span>
        </div>
      )}

      <PcAgentHistoryConfigPanel tk={tk} />

      <PcAgentHistoryRecords tk={tk} />

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tk('searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
          />
        </div>
        <select
          value={filterTool}
          onChange={(e) => setFilterTool(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
        >
          <option value="">{tk('allTools')}</option>
          {(index?.tools || []).map((tool) => (
            <option key={tool} value={tool}>{toolLabel(tool)}</option>
          ))}
        </select>
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
        >
          <option value="">{tk('allUsers')}</option>
          {(index?.users || []).map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
        {(['sessions', 'prompts'] as TabId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            {id === 'sessions' ? <ListTree className="w-4 h-4" /> : <MessageSquareText className="w-4 h-4" />}
            {tk(id)}
          </button>
        ))}
      </div>

      {loading && !index ? (
        <div className="text-sm text-slate-500 py-8 text-center">{tk('loading')}</div>
      ) : error ? (
        <div className="text-sm text-red-500 py-8 text-center">{error}</div>
      ) : tab === 'sessions' ? (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
          <div className="overflow-auto space-y-2 pr-1">
            {filteredSessions.length === 0 ? (
              <div className="text-sm text-slate-500 py-8 text-center">{tk('empty')}</div>
            ) : (
              filteredSessions.map((s) => (
                <SessionRow
                  key={s.id}
                  s={s as any}
                  active={selectedId === s.id}
                  subagentLabel={tk('subagent')}
                  onClick={() => handleSelect(s.id)}
                />
              ))
            )}
          </div>
          <div className="overflow-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] p-4 min-h-[240px]">
            {detailLoading ? (
              <div className="text-sm text-slate-500">{tk('loading')}</div>
            ) : detailError ? (
              <div className="text-sm text-red-500">{detailError}</div>
            ) : detail ? (
              <SessionDetailView detail={detail as any} subagentLabel={tk('subagent')} />
            ) : (
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <UserIcon className="w-4 h-4" />
                {tk('pickSession')}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
          <div className="flex-1 overflow-auto space-y-3 pr-1">
            {promptsLoading ? (
              <div className="text-sm text-slate-500 py-8 text-center">{tk('loading')}</div>
            ) : prompts.length === 0 ? (
              <div className="text-sm text-slate-500 py-8 text-center">{tk('empty')}</div>
            ) : (
              prompts.map((p) => (
                <PcAgentHistoryPromptItem key={p.id} p={p} labels={promptLabels} onSaved={handlePromptSaved} />
              ))
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={promptPage <= 1}
                onClick={() => setPromptPage((n) => Math.max(1, n - 1))}
                className="px-3 py-1 rounded border text-sm disabled:opacity-40"
              >
                {tk('prev')}
              </button>
              <span className="text-xs text-slate-500">{promptPage} / {totalPages}</span>
              <button
                type="button"
                disabled={promptPage >= totalPages}
                onClick={() => setPromptPage((n) => n + 1)}
                className="px-3 py-1 rounded border text-sm disabled:opacity-40"
              >
                {tk('next')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PcAgentHistoryPage;
