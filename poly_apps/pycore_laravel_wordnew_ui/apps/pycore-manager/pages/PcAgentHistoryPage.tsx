/**
 * Agent History — installed Agent/Claude/Codex/Cursor/Gemini/Kimi/Antigravity/Cline sessions extracted by pycore.
 * DIFF read surface: ID page tables (IDs + status metadata only) are cached in
 * the frontend store and aligned by revision; only the visible page is
 * materialized. No full loads.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, MessageSquareText, ListTree, User as UserIcon, Search, Radio } from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import { connectPycoreHttp } from '@/apps/pycore-manager/api';
import { pycoreEventBus } from '@/apps/pycore-manager/api';
import { PYCORE_EVENT_TOPICS } from '@/apps/pycore-manager/api';
import type {
  AgentHistoryPrompt,
  AgentHistoryPromptIdItem,
  AgentHistorySessionDetail,
  AgentHistorySessionIdItem,
  AgentHistorySessionSummary,
} from '@/apps/pycore-manager/api';
import {
  agentHistoryPageTableStore,
  type AgentHistoryPageTable,
} from '@/apps/pycore-manager/persistence/AgentHistoryPageTableStore';
import { AGENT_HISTORY_TOOLS, PAGE_SIZE, toolLabel } from './agent-history/presentation';
import SessionRow from './agent-history/SessionRow';
import SessionDetailView from './agent-history/SessionDetailView';
import PcAgentHistoryConfigPanel from './agent-history/PcAgentHistoryConfigPanel';
import PcAgentHistoryRecords from './agent-history/PcAgentHistoryRecords';
import PcAgentHistoryPromptItem from './agent-history/PcAgentHistoryPromptItem';
import {
  agentHistoryUiStateStore,
  type AgentHistoryTabId as TabId,
  type AgentHistoryTaskPeriod,
  type AgentHistoryUiState,
} from '../persistence/AgentHistoryUiStateStore';

type HeaderState = {
  generatedAt: string;
  tools: string[];
  users: string[];
  counts: Record<string, number>;
};

const STORE_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const MONITORED_AGENT_TOOLS = new Set<string>(AGENT_HISTORY_TOOLS);

function validCachedPage<T extends { id: string }>(
  table: AgentHistoryPageTable<T> | null,
): table is AgentHistoryPageTable<T> {
  return Boolean(
    table
    && typeof table.revision === 'string'
    && Number.isFinite(table.total)
    && table.total >= 0
    && table.items.every((item) => typeof item?.id === 'string' && item.id.length > 0),
  );
}

function normalizeGeneratedAt(value: unknown): string {
  const timestamp = String(value || '').trim();
  const match = STORE_TIMESTAMP_PATTERN.exec(timestamp);
  if (!match) return '';
  const parts = match.slice(1).map(Number);
  const [year, month, day, hour, minute, second] = parts;
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (year < 2000 || year > 2100) return '';
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
    || parsed.getUTCHours() !== hour
    || parsed.getUTCMinutes() !== minute
    || parsed.getUTCSeconds() !== second
  ) return '';
  return timestamp;
}

function readUiState(): AgentHistoryUiState {
  const stored = agentHistoryUiStateStore.getSnapshot();
  return {
    tab: stored.tab === 'prompts' ? 'prompts' : 'sessions',
    filterTool: String(stored.filterTool || ''),
    filterUser: String(stored.filterUser || ''),
    search: String(stored.search || ''),
    sessionPage: stored.sessionPage,
    promptPage: stored.promptPage,
    selectedId: String(stored.selectedId || ''),
    selectedTool: MONITORED_AGENT_TOOLS.has(String(stored.selectedTool || ''))
      ? String(stored.selectedTool)
      : '',
    enabledTools: Array.isArray(stored.enabledTools)
      ? stored.enabledTools.map(String).filter((tool) => MONITORED_AGENT_TOOLS.has(tool))
      : [],
    live: stored.live !== false,
    taskPeriod: stored.taskPeriod === 'history' ? 'history' : 'today',
  };
}

const PcAgentHistoryPage: React.FC = () => {
  const { t } = useTranslation('pc');
  const tk = useCallback((k: string): string => t(`agentHistory.${k}`), [t]);
  const initialUiState = useRef(readUiState()).current;

  const [header, setHeader] = useState<HeaderState>({ generatedAt: '', tools: [], users: [], counts: {} });
  const [sessionRows, setSessionRows] = useState<AgentHistorySessionSummary[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionPage, setSessionPage] = useState(initialUiState.sessionPage);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [prompts, setPrompts] = useState<AgentHistoryPrompt[]>([]);
  const [promptTotal, setPromptTotal] = useState(0);
  const [promptPage, setPromptPage] = useState(initialUiState.promptPage);
  const [promptLoading, setPromptLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [live, setLive] = useState(initialUiState.live);

  const [tab, setTab] = useState<TabId>(initialUiState.tab);
  const [filterTool, setFilterTool] = useState(initialUiState.filterTool);
  const [filterUser, setFilterUser] = useState(initialUiState.filterUser);
  const [enabledTools, setEnabledTools] = useState<string[]>(initialUiState.enabledTools);
  const [search, setSearch] = useState(initialUiState.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialUiState.search.trim());
  const [selectedTool, setSelectedTool] = useState(initialUiState.selectedTool);
  const [taskPeriod, setTaskPeriod] = useState<AgentHistoryTaskPeriod>(initialUiState.taskPeriod);

  const [selectedId, setSelectedId] = useState(initialUiState.selectedId);
  const [detail, setDetail] = useState<AgentHistorySessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const sessionMaterializedKey = useRef('');
  const promptMaterializedKey = useRef('');
  const filterResetReady = useRef(false);
  const skipNextFilterReset = useRef(false);
  const manualRefreshPending = useRef(false);

  useLayoutEffect(() => {
    agentHistoryUiStateStore.save({
      tab,
      filterTool,
      filterUser,
      search,
      sessionPage,
      promptPage,
      selectedId,
      selectedTool,
      enabledTools,
      live,
      taskPeriod,
    });
  }, [enabledTools, filterTool, filterUser, live, promptPage, search, selectedId, selectedTool, sessionPage, tab, taskPeriod]);

  const loadSessionPage = useCallback(async () => {
    setSessionLoading(true);
    setError(null);
    const scope = `sessions|tool=${filterTool}|user=${filterUser}|q=${debouncedSearch}|page=${sessionPage}`;
    try {
      const cachedPage = agentHistoryPageTableStore.read<AgentHistorySessionIdItem>(scope);
      const cached = validCachedPage(cachedPage) ? cachedPage : null;
      const cachedGeneratedAt = normalizeGeneratedAt(cached?.meta?.generatedAt);
      const res = await pycoreApi.getAgentHistorySessionIdPages({
        tool: filterTool || undefined,
        user: filterUser || undefined,
        q: debouncedSearch || undefined,
        page: sessionPage,
        pageSize: PAGE_SIZE,
        sinceRevision: cached?.meta && cachedGeneratedAt ? cached.revision : undefined,
      });
      if (!res.success || !res.data) {
        setError(res.error || t('agentHistory.loadError'));
        return;
      }
      if (!res.data.unchanged) {
        const nextHeader = {
          generatedAt: normalizeGeneratedAt(res.data.generated_at),
          tools: res.data.tools || [],
          users: res.data.users || [],
          counts: res.data.counts || {},
        };
        setHeader(nextHeader);
      }
      let table = cached;
      if (!res.data.unchanged || !table) {
        table = {
          revision: res.data.revision,
          total: res.data.total,
          items: res.data.items || [],
          meta: {
            generatedAt: normalizeGeneratedAt(res.data.generated_at),
            tools: res.data.tools || [],
            users: res.data.users || [],
            counts: res.data.counts || {},
          },
          updatedAt: Date.now(),
        };
        agentHistoryPageTableStore.write(scope, table);
      } else if (table.meta) {
        setHeader({
          generatedAt: normalizeGeneratedAt(table.meta.generatedAt),
          tools: Array.isArray(table.meta.tools) ? table.meta.tools.map(String) : [],
          users: Array.isArray(table.meta.users) ? table.meta.users.map(String) : [],
          counts: (table.meta.counts || {}) as Record<string, number>,
        });
      }
      setSessionTotal(table.total);
      const materializedKey = `${scope}|${table.revision}`;
      if (res.data.unchanged && sessionMaterializedKey.current === materializedKey) {
        return;
      }
      const ids = table.items.map((item) => item.id);
      if (ids.length === 0) {
        setSessionRows([]);
        sessionMaterializedKey.current = materializedKey;
        return;
      }
      const rows = await pycoreApi.getAgentHistorySessionPage(ids);
      if (rows.success && rows.data) {
        setSessionRows(rows.data.items || []);
        sessionMaterializedKey.current = materializedKey;
      } else {
        setError(rows.error || t('agentHistory.loadError'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('agentHistory.loadError'));
    } finally {
      setSessionLoading(false);
    }
  }, [debouncedSearch, filterTool, filterUser, sessionPage, t]);

  const loadPromptPage = useCallback(async () => {
    setPromptLoading(true);
    setError(null);
    const tools = filterTool ? undefined : enabledTools;
    const scope = `prompts|tool=${filterTool}|user=${filterUser}|q=${debouncedSearch}|tools=${(tools || []).join(',')}|page=${promptPage}`;
    try {
      const cachedPage = agentHistoryPageTableStore.read<AgentHistoryPromptIdItem>(scope);
      const cached = validCachedPage(cachedPage) ? cachedPage : null;
      const cachedGeneratedAt = normalizeGeneratedAt(cached?.meta?.generatedAt);
      const res = await pycoreApi.getAgentHistoryPromptIdPages({
        tool: filterTool || undefined,
        user: filterUser || undefined,
        q: debouncedSearch || undefined,
        tools,
        page: promptPage,
        pageSize: PAGE_SIZE,
        sinceRevision: cached?.meta && cachedGeneratedAt ? cached.revision : undefined,
      });
      if (!res.success || !res.data) {
        setError(res.error || t('agentHistory.loadError'));
        return;
      }
      if (!res.data.unchanged) {
        setHeader({
          generatedAt: normalizeGeneratedAt(res.data.generated_at),
          tools: res.data.tools || [],
          users: res.data.users || [],
          counts: res.data.counts || {},
        });
      }
      let table = cached;
      if (!res.data.unchanged || !table) {
        table = {
          revision: res.data.revision,
          total: res.data.total,
          items: res.data.items || [],
          meta: {
            generatedAt: normalizeGeneratedAt(res.data.generated_at),
            tools: res.data.tools || [],
            users: res.data.users || [],
            counts: res.data.counts || {},
          },
          updatedAt: Date.now(),
        };
        agentHistoryPageTableStore.write(scope, table);
      } else if (table.meta) {
        setHeader({
          generatedAt: normalizeGeneratedAt(table.meta.generatedAt),
          tools: Array.isArray(table.meta.tools) ? table.meta.tools.map(String) : [],
          users: Array.isArray(table.meta.users) ? table.meta.users.map(String) : [],
          counts: (table.meta.counts || {}) as Record<string, number>,
        });
      }
      setPromptTotal(table.total);
      const materializedKey = `${scope}|${table.revision}`;
      if (res.data.unchanged && promptMaterializedKey.current === materializedKey) {
        return;
      }
      const ids = table.items.map((item) => item.id);
      if (ids.length === 0) {
        setPrompts([]);
        promptMaterializedKey.current = materializedKey;
        return;
      }
      const rows = await pycoreApi.getAgentHistoryPromptPage(ids);
      if (rows.success && rows.data) {
        setPrompts(rows.data.items || []);
        promptMaterializedKey.current = materializedKey;
      } else {
        setError(rows.error || t('agentHistory.loadError'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('agentHistory.loadError'));
    } finally {
      setPromptLoading(false);
    }
  }, [debouncedSearch, enabledTools, filterTool, filterUser, promptPage, t]);

  useEffect(() => {
    connectPycoreHttp();
  }, []);

  useEffect(() => {
    if (tab === 'sessions') void loadSessionPage();
  }, [tab, loadSessionPage]);

  useEffect(() => {
    if (tab === 'prompts') void loadPromptPage();
  }, [tab, loadPromptPage]);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const off = pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.agentHistorySessionsChanged, () => {
      if (!live && !manualRefreshPending.current) return;
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        manualRefreshPending.current = false;
        if (tab === 'prompts') void loadPromptPage();
        else void loadSessionPage();
      }, 250);
    });
    return () => {
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      off();
    };
  }, [live, tab, loadSessionPage, loadPromptPage]);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => {
    if (!filterResetReady.current) {
      filterResetReady.current = true;
      return;
    }
    if (skipNextFilterReset.current) {
      skipNextFilterReset.current = false;
      return;
    }
    setSessionPage(1);
    setPromptPage(1);
  }, [debouncedSearch, enabledTools, filterTool, filterUser]);

  const handleEnabledToolsChange = useCallback((tools: string[], initialHydration = false) => {
    setEnabledTools((current) => {
      if (current.join('\u0000') === tools.join('\u0000')) return current;
      if (initialHydration) skipNextFilterReset.current = true;
      return tools;
    });
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    manualRefreshPending.current = true;
    try {
      const res = await pycoreApi.refreshAgentHistory();
      if (!res.success) {
        manualRefreshPending.current = false;
        setError(res.error || t('agentHistory.loadError'));
      }
    } catch (e) {
      manualRefreshPending.current = false;
      setError(e instanceof Error ? e.message : t('agentHistory.loadError'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelect = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await pycoreApi.getAgentHistorySession(id);
      if (res.success && res.data) {
        setDetail(res.data);
      } else {
        setDetailError(res.error || tk('loadError'));
      }
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : tk('loadError'));
    } finally {
      setDetailLoading(false);
    }
  }, [tk]);

  useEffect(() => {
    if (initialUiState.selectedId) void handleSelect(initialUiState.selectedId);
  }, [handleSelect, initialUiState.selectedId]);

  const handlePromptSaved = (id: string, text: string) => {
    setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, text, edited: true } : p)));
    if (detail) {
      setDetail({
        ...detail,
        prompts: detail.prompts.map((p) => (p.id === id ? { ...p, text, edited: true } : p)),
      });
    }
  };

  const sessionTotalPages = Math.max(1, Math.ceil(sessionTotal / PAGE_SIZE));
  const promptTotalPages = Math.max(1, Math.ceil(promptTotal / PAGE_SIZE));

  const promptLabels = {
    copy: tk('copy'),
    copied: tk('copied'),
    edit: tk('edit'),
    save: tk('save'),
    cancel: tk('cancel'),
    edited: tk('edited'),
  };

  const renderPager = (page: number, totalPages: number, setPage: (next: number) => void) => (
    <div className="flex items-center justify-center gap-2 pt-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => setPage(Math.max(1, page - 1))}
        className="px-3 py-1 rounded border text-sm disabled:opacity-40"
      >
        {tk('prev')}
      </button>
      <span className="text-xs text-slate-500">{page} / {totalPages}</span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => setPage(Math.min(totalPages, page + 1))}
        className="px-3 py-1 rounded border text-sm disabled:opacity-40"
      >
        {tk('next')}
      </button>
    </div>
  );

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

      {header.generatedAt && (
        <div className="text-xs font-mono text-slate-400">
          {tk('updated')}: {header.generatedAt}
          <span className="ml-3">
            {header.counts?.sessions ?? sessionTotal} {tk('sessionCount')}
            {' · '}
            {header.counts?.prompts ?? promptTotal} {tk('promptCount')}
          </span>
        </div>
      )}

      <PcAgentHistoryConfigPanel
        tk={tk}
        selectedTool={selectedTool}
        restoredEnabledTools={enabledTools}
        storeRevision={header.generatedAt}
        onEnabledToolsChange={handleEnabledToolsChange}
        onSelectedToolChange={setSelectedTool}
        taskPeriod={taskPeriod}
        onTaskPeriodChange={setTaskPeriod}
      />

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
          {header.tools.map((tool) => (
            <option key={tool} value={tool}>{toolLabel(tool)}</option>
          ))}
        </select>
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
        >
          <option value="">{tk('allUsers')}</option>
          {header.users.map((u) => (
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

      {error && sessionRows.length === 0 && prompts.length === 0 ? (
        <div className="text-sm text-red-500 py-8 text-center">{error}</div>
      ) : tab === 'sessions' ? (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
          <div className="flex flex-col min-h-0">
            <div className="flex-1 overflow-auto space-y-2 pr-1">
              {sessionLoading && sessionRows.length === 0 ? (
                <div className="text-sm text-slate-500 py-8 text-center">{tk('loading')}</div>
              ) : sessionRows.length === 0 ? (
                <div className="text-sm text-slate-500 py-8 text-center">{tk('empty')}</div>
              ) : (
                sessionRows.map((s) => (
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
            {sessionTotalPages > 1 && renderPager(sessionPage, sessionTotalPages, setSessionPage)}
          </div>
          <div className="overflow-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] p-4 min-h-[240px]">
            {detailLoading ? (
              <div className="text-sm text-slate-500">{tk('loading')}</div>
            ) : detailError ? (
              <div className="text-sm text-red-500">{detailError}</div>
            ) : detail ? (
              <SessionDetailView detail={detail} subagentLabel={tk('subagent')} />
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
            {promptLoading && prompts.length === 0 ? (
              <div className="text-sm text-slate-500 py-8 text-center">{tk('loading')}</div>
            ) : prompts.length === 0 ? (
              <div className="text-sm text-slate-500 py-8 text-center">{tk('empty')}</div>
            ) : (
              prompts.map((p) => (
                <PcAgentHistoryPromptItem key={p.id} p={p} labels={promptLabels} onSaved={handlePromptSaved} />
              ))
            )}
          </div>
          {promptTotalPages > 1 && renderPager(promptPage, promptTotalPages, setPromptPage)}
        </div>
      )}
    </div>
  );
};

export default PcAgentHistoryPage;
