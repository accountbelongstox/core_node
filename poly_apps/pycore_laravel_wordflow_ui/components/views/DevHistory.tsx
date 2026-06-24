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
  Cpu,
  Copy,
  Check,
  Pencil,
  Save,
  X
} from 'lucide-react';
import { Language } from '../../types';
import { api } from '../../core/api';
import { apiManager } from '../../services/ApiManager';
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

const PAGE_SIZE = 50;

/** Resolve a Laravel-relative url (e.g. audio) against the active :9000 base. */
const absUrl = (u?: string): string => {
  if (!u) return '';
  if (/^https?:\/\//.test(u)) return u;
  const base = (apiManager.getCurrentBaseUrl && apiManager.getCurrentBaseUrl()) || '';
  return base.replace(/\/$/, '') + u;
};

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

  const toolPill = (tool: string) =>
    `inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
      TOOL_BADGE[tool] || 'bg-slate-500/15 text-slate-500 border-slate-500/30'
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
                    <PromptItem
                      key={p.id || `${p.session_id}-${i}`}
                      p={p}
                      labels={promptLabels}
                      toolPill={toolPill}
                      onSaved={handlePromptSaved}
                    />
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
      {(detail.turns || []).map((turn, i) => (
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

const PromptItem: React.FC<{
  p: DevHistoryPrompt;
  labels: { copy: string; copied: string; edit: string; save: string; cancel: string; edited: string };
  toolPill: (tool: string) => string;
  onSaved: (id: string, text: string) => void;
}> = ({ p, labels, toolPill, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.text);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const startEdit = () => {
    setDraft(p.text);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(p.text);
  };

  const save = async () => {
    setSaving(true);
    const res = await api.devHistory.updatePrompt(p.id, draft);
    setSaving(false);
    if (res.success) {
      onSaved(p.id, draft);
      setEditing(false);
    }
  };

  const btn = 'p-1 rounded text-slate-400 hover:text-indigo-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors';

  return (
    <li className="px-4 py-3 group">
      <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400">
        <span className={toolPill(p.tool)}>{toolLabel(p.tool)}</span>
        <UserIcon size={11} /> {p.os_user}
        <span className="truncate">· {p.project}</span>
        {p.edited && <span className="text-amber-500">({labels.edited})</span>}
        <span className="ml-auto">{p.time}</span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={copy} title={labels.copy} className={btn}>
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          </button>
          {!editing && (
            <button onClick={startEdit} title={labels.edit} className={btn}>
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(14, Math.max(3, draft.split('\n').length + 1))}
            className="w-full text-sm rounded-lg bg-black/5 dark:bg-white/5 border border-indigo-500/30 focus:border-indigo-500/60 outline-none p-2 text-slate-700 dark:text-slate-200 font-mono"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || draft.trim() === ''}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 disabled:opacity-50"
            >
              <Save size={12} /> {labels.save}
            </button>
            <button
              onClick={cancel}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-500 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X size={12} /> {labels.cancel}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words max-h-48 overflow-auto">
          {p.text}
        </p>
      )}

      {p.translation?.english && !editing && (
        <div className="mt-2 pl-2 border-l-2 border-emerald-500/40">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">
            <span>EN</span>
            {p.translation.audio?.url && (
              <audio controls preload="none" src={absUrl(p.translation.audio.url)} className="h-6" />
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
            {p.translation.cleaned || p.translation.english}
          </p>
        </div>
      )}
    </li>
  );
};

export default DevHistory;
