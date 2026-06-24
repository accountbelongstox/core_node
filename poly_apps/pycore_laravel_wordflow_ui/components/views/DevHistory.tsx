import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw,
  MessageSquareText,
  ListTree,
  User as UserIcon,
  Bot,
  Wrench,
  Brain,
  Search,
  Cpu
} from 'lucide-react';
import { Language } from '../../types';
import { api } from '../../core/api';
import type {
  DevHistoryIndex,
  DevHistorySessionSummary,
  DevHistorySessionDetail,
  DevHistoryPrompt,
  DevHistoryTurn
} from '../../core/api/modules/DevHistoryAPI';

interface DevHistoryProps {
  lang?: Language;
}

type TabId = 'sessions' | 'prompts';

const TOOL_LABELS: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini',
  cursor: 'Cursor'
};

const TOOL_BADGE: Record<string, string> = {
  claude: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30',
  codex: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
  gemini: 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30',
  cursor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
};

const ROLE_STYLE: Record<string, { ring: string; label: string; icon: React.ReactNode }> = {
  user: { ring: 'border-l-indigo-500', label: 'USER', icon: <UserIcon size={13} /> },
  assistant: { ring: 'border-l-emerald-500', label: 'ASSISTANT', icon: <Bot size={13} /> },
  thinking: { ring: 'border-l-slate-400', label: 'THINKING', icon: <Brain size={13} /> },
  tool_use: { ring: 'border-l-amber-500', label: 'TOOL', icon: <Wrench size={13} /> },
  tool_result: { ring: 'border-l-cyan-500', label: 'RESULT', icon: <Cpu size={13} /> },
  system: { ring: 'border-l-slate-400', label: 'SYSTEM', icon: <Cpu size={13} /> }
};

const toolLabel = (tool: string): string => TOOL_LABELS[tool] || tool;

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

  const [prompts, setPrompts] = useState<DevHistoryPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);

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
      limit: 1000
    });
    if (res.success && res.data) {
      setPrompts(res.data.items || []);
    } else {
      setPrompts([]);
    }
    setPromptsLoading(false);
  }, [filterTool, filterUser]);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  useEffect(() => {
    if (tab === 'prompts') {
      loadPrompts();
    }
  }, [tab, loadPrompts]);

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
    setDetailLoading(true);
    const res = await api.devHistory.getSession(id);
    if (res.success && res.data) {
      setDetail(res.data);
    }
    setDetailLoading(false);
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

  const filteredPrompts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prompts;
    return prompts.filter((p) => p.text.toLowerCase().includes(q));
  }, [prompts, search]);

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
      active
        ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/40'
        : 'bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-transparent hover:border-indigo-500/30'
    }`;

  const toolPill = (tool: string) =>
    `inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
      TOOL_BADGE[tool] || 'bg-slate-500/15 text-slate-500 border-slate-500/30'
    }`;

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
                    toolPill={toolPill}
                  />
                ))
              )}
            </div>

            {/* Session detail */}
            <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 overflow-y-auto">
              {detailLoading ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">…</div>
              ) : detail ? (
                <SessionDetailView detail={detail} subagentLabel={tk('subagent')} toolPill={toolPill} />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">{tk('selectSession')}</div>
              )}
            </div>
          </div>
        ) : (
          /* Prompts tab */
          <div className="h-full rounded-xl border border-black/5 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 overflow-y-auto">
            {promptsLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">…</div>
            ) : filteredPrompts.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">{tk('empty')}</div>
            ) : (
              <ul className="divide-y divide-black/5 dark:divide-white/10">
                {filteredPrompts.map((p, i) => (
                  <li key={`${p.session_id}-${i}`} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400">
                      <span className={toolPill(p.tool)}>{toolLabel(p.tool)}</span>
                      <UserIcon size={11} /> {p.os_user}
                      <span className="truncate">· {p.project}</span>
                      <span className="ml-auto">{p.time}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words line-clamp-6">
                      {p.text}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const SessionRow: React.FC<{
  s: DevHistorySessionSummary;
  active: boolean;
  subagentLabel: string;
  onClick: () => void;
  toolPill: (tool: string) => string;
}> = ({ s, active, subagentLabel, onClick, toolPill }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-2.5 border-b border-black/5 dark:border-white/10 transition-colors ${
      active ? 'bg-indigo-500/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
    }`}
  >
    <div className="flex items-center gap-2 mb-1">
      <span className={toolPill(s.tool)}>{toolLabel(s.tool)}</span>
      {s.has_subagent && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-500/30">
          {subagentLabel}
        </span>
      )}
      <span className="ml-auto text-[10px] text-slate-400">{s.started_at}</span>
    </div>
    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
      {s.title || s.project || s.raw_id}
    </div>
    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
      <UserIcon size={11} /> {s.os_user}
      <span className="ml-auto">
        {s.prompt_count} · {s.message_count}
      </span>
    </div>
  </button>
);

const SessionDetailView: React.FC<{
  detail: DevHistorySessionDetail;
  subagentLabel: string;
  toolPill: (tool: string) => string;
}> = ({ detail, subagentLabel, toolPill }) => (
  <div className="flex flex-col h-full">
    <div className="px-4 py-3 border-b border-black/5 dark:border-white/10 sticky top-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur">
      <div className="flex items-center gap-2 mb-1">
        <span className={toolPill(detail.tool)}>{toolLabel(detail.tool)}</span>
        <UserIcon size={12} className="text-slate-400" />
        <span className="text-xs text-slate-500">{detail.os_user}</span>
        {detail.has_subagent && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-500/30">
            {subagentLabel}
          </span>
        )}
      </div>
      <div className="text-sm font-semibold text-slate-800 dark:text-white truncate">
        {detail.title || detail.project || detail.raw_id}
      </div>
      <div className="text-[11px] text-slate-400 truncate">{detail.project}</div>
    </div>

    <div className="p-3 space-y-2">
      {detail.turns.map((turn, i) => (
        <TurnView key={i} turn={turn} subagentLabel={subagentLabel} />
      ))}
    </div>
  </div>
);

const TurnView: React.FC<{ turn: DevHistoryTurn; subagentLabel: string }> = ({ turn, subagentLabel }) => {
  const style = ROLE_STYLE[turn.role] || ROLE_STYLE.system;
  return (
    <div className={`pl-3 border-l-2 ${style.ring}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-slate-400 mb-0.5">
        {style.icon}
        {style.label}
        {turn.name ? <span className="text-amber-500">· {turn.name}</span> : null}
        {turn.model ? <span className="text-slate-400">· {turn.model}</span> : null}
        {turn.is_subagent && (
          <span className="text-fuchsia-500">· {subagentLabel}</span>
        )}
        {turn.time ? <span className="ml-auto font-normal">{turn.time}</span> : null}
      </div>
      <p
        className={`text-xs whitespace-pre-wrap break-words ${
          turn.role === 'thinking' ? 'italic text-slate-400' : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        {turn.text}
      </p>
    </div>
  );
};

export default DevHistory;
