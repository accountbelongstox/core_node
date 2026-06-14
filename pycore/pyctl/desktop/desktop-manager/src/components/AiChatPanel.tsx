import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2, Trash2, KeyRound, Timer, AlertTriangle, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApp } from '../state/AppContext';
import { pycoreApi } from '../api/pycore';
import type { AiProvider, AiChatMessage } from '../types';

/**
 * AiChatPanel — a modal chat used to *confirm* an AI provider actually answers.
 *
 * Opened from AiStatusPage when an available provider row is clicked. It sends
 * the conversation to the pycore backend (POST /api/local/ai/chat) and renders
 * the assistant reply as markdown. Model defaults to the provider's first probed
 * model but can be changed from the dropdown.
 */

interface ChatTurn extends AiChatMessage {
  // assistant-only metadata for the footer chip
  model?: string;
  latencyMs?: number | null;
  error?: boolean;
}

export default function AiChatPanel({ provider, onClose }: { provider: AiProvider; onClose: () => void }) {
  const { settings, t } = useApp();
  const dark = settings.theme === 'dark';

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<string>(provider.models?.[0] ?? '');
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep the transcript pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, loading]);

  // Close on Esc; focus the input on open.
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const history: AiChatMessage[] = turns
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.content }));
    const userTurn: ChatTurn = { role: 'user', content: text };

    setTurns((prev) => [...prev, userTurn]);
    setInput('');
    setLoading(true);
    try {
      const res = await pycoreApi.aiChat(provider.name, [...history, { role: 'user', content: text }], model || undefined);
      if (res.success) {
        setTurns((prev) => [...prev, {
          role: 'assistant', content: res.text || '', model: res.model, latencyMs: res.latency_ms,
        }]);
      } else {
        setTurns((prev) => [...prev, {
          role: 'assistant', content: `${t.aiChatError} ${res.error || 'unknown error'}`, error: true,
        }]);
      }
    } catch (e: any) {
      setTurns((prev) => [...prev, {
        role: 'assistant', content: `${t.aiChatError} ${e?.message || 'network error'}`, error: true,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, turns, provider.name, model, t.aiChatError]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const card = dark ? 'bg-slate-900 border-white/10 text-zinc-200' : 'bg-white border-slate-200 text-slate-800';
  const userBubble = 'bg-sky-500 text-white';
  const aiBubble = dark ? 'bg-white/5 text-zinc-200' : 'bg-slate-100 text-slate-800';
  const errBubble = 'bg-rose-500/10 text-rose-500 border border-rose-500/30';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl h-[80vh] max-h-[680px] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${card}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-black/5 dark:border-white/10 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 grid place-items-center shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold truncate">{t.aiChatTitle} · {provider.name}</h3>
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                <KeyRound className="w-3 h-3" />{provider.key_masked || '-'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{t.aiChatHint}</p>
          </div>
          {provider.models?.length > 0 && (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              title={t.aiModel}
              className={`max-w-[40%] text-[11px] font-mono rounded-lg px-2 py-1.5 border outline-none ${
                dark ? 'bg-white/5 border-white/10 text-zinc-300' : 'bg-slate-100 border-slate-300/50 text-slate-600'}`}
            >
              {provider.models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <button onClick={onClose} title="Close"
            className="shrink-0 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {turns.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-400 gap-2">
              <Sparkles className="w-6 h-6 opacity-40" />
              {t.aiChatEmpty}
            </div>
          )}

          {turns.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                m.role === 'user' ? userBubble : m.error ? errBubble : aiBubble}`}>
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                ) : m.error ? (
                  <p className="flex items-start gap-1.5 break-words">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{m.content}
                  </p>
                ) : (
                  <div className="markdown-body break-words [&_p]:my-1 [&_pre]:my-2 [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:bg-black/40 [&_pre]:text-zinc-100 [&_pre]:overflow-x-auto [&_pre]:text-xs [&_code]:font-mono [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-black/10 dark:[&_:not(pre)>code]:bg-white/10 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-sky-500 [&_a]:underline [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_table]:text-xs [&_th]:px-2 [&_td]:px-2 [&_th]:border [&_td]:border [&_th]:border-black/10 [&_td]:border-black/10">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    {(m.model || m.latencyMs != null) && (
                      <div className="mt-1.5 pt-1.5 border-t border-black/5 dark:border-white/10 flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        {m.model && <span className="truncate">{m.model}</span>}
                        {m.latencyMs != null && (
                          <span className="inline-flex items-center gap-0.5"><Timer className="w-2.5 h-2.5" />{Math.round(m.latencyMs)} ms</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className={`rounded-2xl px-3.5 py-2.5 text-sm inline-flex items-center gap-2 ${aiBubble}`}>
                <Loader2 className="w-4 h-4 animate-spin" /> {t.aiChatThinking}
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="px-4 py-3 border-t border-black/5 dark:border-white/10 shrink-0">
          <div className="flex items-end gap-2">
            {turns.length > 0 && (
              <button onClick={() => setTurns([])} title={t.aiChatClear}
                className="shrink-0 p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 transition">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={t.aiChatPlaceholder}
              className={`flex-1 resize-none max-h-32 rounded-xl px-3.5 py-2.5 text-sm outline-none border ${
                dark ? 'bg-white/5 border-white/10 text-zinc-200 placeholder-slate-500'
                     : 'bg-slate-100 border-slate-300/50 text-slate-800 placeholder-slate-400'}`}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold inline-flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t.aiChatSend}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
