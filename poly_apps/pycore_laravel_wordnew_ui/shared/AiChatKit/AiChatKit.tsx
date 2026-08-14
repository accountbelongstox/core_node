/**
 * AiChatKit — the shared AI chat framework for all three ends.
 *
 * One reusable component (markdown rendering, multi-turn history, optional
 * provider/model selection) that plugs into any end via an AiChatAdapter. The
 * adapter owns transport; this owns the UI + local history. Theme-agnostic
 * (Tailwind utilities + global .dark), so it looks at home under Nexus, Pycore,
 * or Iris.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Loader2, Trash2, Bot, User } from 'lucide-react';
import type { AiChatAdapter, AiChatProvider, AiChatUiMessage } from '../../core/contracts/ai';
import { AICHAT_HISTORY_EVENT, loadHistory, saveHistory } from './aiChatHistory';

interface AiChatKitProps {
  adapter: AiChatAdapter;
  className?: string;
}

export const AiChatKit: React.FC<AiChatKitProps> = ({ adapter, className }) => {
  const [messages, setMessages] = useState<AiChatUiMessage[]>(() => loadHistory(adapter.id));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<AiChatProvider[]>([]);
  const [provider, setProvider] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset to the selected adapter's own history when the adapter changes.
  useEffect(() => {
    setMessages(loadHistory(adapter.id));
    setError(null);
    setProviders([]);
    setProvider('');
    setModel('');
    if (adapter.listProviders) {
      adapter.listProviders()
        .then((list) => {
          setProviders(list);
          const firstPick = list.find((p) => p.available !== false) ?? list[0];
          if (firstPick) setProvider(firstPick.id);
        })
        .catch(() => { /* provider list is optional */ });
    }
  }, [adapter]);

  // Pick up probe/log lines appended from other pages while chat is open.
  useEffect(() => {
    const onHistoryUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ adapterId?: string; messages?: AiChatUiMessage[] }>).detail;
      if (detail?.adapterId === adapter.id && Array.isArray(detail.messages)) {
        setMessages(detail.messages);
      }
    };
    window.addEventListener(AICHAT_HISTORY_EVENT, onHistoryUpdate);
    return () => window.removeEventListener(AICHAT_HISTORY_EVENT, onHistoryUpdate);
  }, [adapter.id]);

  useEffect(() => {
    saveHistory(adapter.id, messages);
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, adapter.id]);

  const activeProvider = providers.find((p) => p.id === provider);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    const next: AiChatUiMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const result = await adapter.send(next, { provider, model });
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: result.text,
        meta: result.meta,
      }]);
    } catch (e: any) {
      const msg = e && e.message ? e.message : 'Request failed';
      setError(msg);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `⚠️ ${msg}`,
        meta: provider ? { provider, model: model || undefined, nickname: model ? `${provider}/${model}` : provider } : undefined,
      }]);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, adapter, provider, model]);

  const clear = useCallback(() => {
    setMessages([]);
    saveHistory(adapter.id, []);
  }, [adapter.id]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* Toolbar: provider/model selectors (only when the adapter advertises
          providers) + the always-available clear-conversation control. Adapters
          without providers (wordnew / laravel) still get a clear button. */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-xs">
        {providers.length > 0 && (
          <>
            <select
              value={provider}
              onChange={(e) => { setProvider(e.target.value); setModel(''); }}
              className="bg-transparent border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-700 dark:text-slate-200"
            >
              {providers.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  title={p.probeError || undefined}
                  className={p.available === false ? 'text-amber-600' : undefined}
                >
                  {p.label}{p.available === false ? ' (probe failed)' : ''}
                </option>
              ))}
            </select>
            {activeProvider && activeProvider.models && activeProvider.models.length > 0 && (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-transparent border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-700 dark:text-slate-200"
              >
                <option value="">default model</option>
                {activeProvider.models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </>
        )}
        <button
          onClick={clear}
          disabled={messages.length === 0}
          className="ml-auto p-1 text-slate-400 hover:text-rose-500 disabled:opacity-40 disabled:hover:text-slate-400 disabled:cursor-not-allowed"
          title="Clear conversation"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-sm text-slate-400 dark:text-slate-500 mt-8">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-60" />
            Ask {adapter.label} anything.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${m.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              {m.role === 'assistant' && m.meta?.nickname && (
                <span
                  className="text-[10px] font-mono font-semibold text-indigo-500/90 dark:text-indigo-400/90 px-1 truncate max-w-full"
                  title={m.meta.latency_ms != null ? `${Math.round(m.meta.latency_ms)} ms` : undefined}
                >
                  {m.meta.nickname}
                </span>
              )}
              <div className={`rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'}`}>
                {m.role === 'user'
                  ? <span className="whitespace-pre-wrap">{m.content}</span>
                  : <div className="prose prose-sm dark:prose-invert max-w-none aichatkit-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="px-3 py-1 text-xs text-rose-500 border-t border-rose-200 dark:border-rose-900/40">{error}</div>
      )}

      {/* Composer */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={`Message ${adapter.label}…`}
          className="flex-1 resize-none max-h-32 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none px-2 py-2"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="shrink-0 w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white flex items-center justify-center"
          title="Send"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

export default AiChatKit;
