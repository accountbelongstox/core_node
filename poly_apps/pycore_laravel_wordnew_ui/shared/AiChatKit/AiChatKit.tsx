/**
 * AiChatKit — the shared AI chat framework for all three ends.
 *
 * One reusable component (markdown rendering, multi-turn history, optional
 * provider/model selection) that plugs into any end via an AiChatAdapter. The
 * adapter owns transport; this owns the UI + history. Theme-agnostic
 * (Tailwind utilities + global .dark), so it looks at home under Nexus, Pycore,
 * or Iris.
 *
 * Optional adapter capabilities (all additive — plain text adapters keep the
 * original behavior):
 *   supportsAttachments      image attach / paste controls; attachments ride
 *                            on the outgoing message and AiChatSendOptions.
 *   supportsPromptCache      a cache toggle; cached answers are badged.
 *   listConversations /      server-conversation mode: a conversation rail
 *   loadConversation /       backed by the adapter's persistence replaces the
 *   deleteConversation       localStorage history.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, Loader2, Trash2, Bot, User, ImagePlus, X, Zap, ZapOff,
  MessageSquarePlus, MessagesSquare,
} from 'lucide-react';
import type {
  AiChatAdapter, AiChatAttachmentRef, AiChatConversationMeta, AiChatProvider, AiChatUiMessage,
} from '../../core/contracts/ai';
import { AICHAT_HISTORY_EVENT, loadHistory, saveHistory } from './aiChatHistory';

interface AiChatKitProps {
  adapter: AiChatAdapter;
  className?: string;
  /** Invoked after every completed send (success or failure) — e.g. to refresh
   *  gateway activity / prompt-cache panels next to the chat. */
  onAfterSend?: () => void;
}

/** Max images per message and per-image byte budget (mirrors the gateway). */
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

interface PendingImage extends AiChatAttachmentRef {
  /** Local object/data URL for the composer preview chip. */
  preview: string;
}

function readImageFile(file: File): Promise<PendingImage | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.size > MAX_IMAGE_BYTES) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const comma = dataUrl.indexOf(',');
      if (comma < 0) {
        resolve(null);
        return;
      }
      resolve({
        name: file.name,
        mime: file.type,
        data: dataUrl.slice(comma + 1),
        url: dataUrl,
        preview: dataUrl,
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export const AiChatKit: React.FC<AiChatKitProps> = ({ adapter, className, onAfterSend }) => {
  const serverMode = Boolean(adapter.listConversations && adapter.loadConversation);

  const [messages, setMessages] = useState<AiChatUiMessage[]>(() => (serverMode ? [] : loadHistory(adapter.id)));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<AiChatProvider[]>([]);
  const [provider, setProvider] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [useCache, setUseCache] = useState(true);
  const [conversations, setConversations] = useState<AiChatConversationMeta[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshConversations = useCallback(async () => {
    if (!adapter.listConversations) return;
    try {
      setConversations(await adapter.listConversations());
    } catch { /* keep the last good list */ }
  }, [adapter]);

  // Reset to the selected adapter's own history when the adapter changes.
  useEffect(() => {
    setError(null);
    setProviders([]);
    setProvider('');
    setModel('');
    setPendingImages([]);
    setMessages(serverMode ? [] : loadHistory(adapter.id));
    setConversationId(null);
    if (serverMode) {
      void refreshConversations();
    }
    if (adapter.listProviders) {
      adapter.listProviders()
        .then((list) => {
          setProviders(list);
          const firstPick = list.find((p) => p.available !== false) ?? list[0];
          if (firstPick) setProvider(firstPick.id);
        })
        .catch(() => { /* provider list is optional */ });
    }
  }, [adapter, serverMode, refreshConversations]);

  // Pick up probe/log lines appended from other pages while chat is open
  // (local-history adapters only — server mode owns its persistence).
  useEffect(() => {
    if (serverMode) return;
    const onHistoryUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ adapterId?: string; messages?: AiChatUiMessage[] }>).detail;
      if (detail?.adapterId === adapter.id && Array.isArray(detail.messages)) {
        setMessages(detail.messages);
      }
    };
    window.addEventListener(AICHAT_HISTORY_EVENT, onHistoryUpdate);
    return () => window.removeEventListener(AICHAT_HISTORY_EVENT, onHistoryUpdate);
  }, [adapter.id, serverMode]);

  useEffect(() => {
    if (!serverMode) {
      saveHistory(adapter.id, messages);
    }
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, adapter.id, serverMode]);

  const activeProvider = providers.find((p) => p.id === provider);

  const openConversation = useCallback(async (id: string) => {
    if (!adapter.loadConversation) return;
    setConversationId(id);
    setMessages([]);
    setError(null);
    setLoadingConversation(true);
    try {
      setMessages(await adapter.loadConversation(id));
    } catch (e: any) {
      setError(e?.message || 'Failed to load the conversation');
    } finally {
      setLoadingConversation(false);
    }
  }, [adapter]);

  const startNewChat = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setPendingImages([]);
  }, []);

  const removeConversation = useCallback(async (id: string) => {
    if (!adapter.deleteConversation) return;
    try {
      await adapter.deleteConversation(id);
    } catch { /* the list refresh below re-syncs state */ }
    if (conversationId === id) {
      startNewChat();
    }
    void refreshConversations();
  }, [adapter, conversationId, startNewChat, refreshConversations]);

  const addImageFiles = useCallback(async (files: Iterable<File>) => {
    const room = MAX_IMAGES - pendingImages.length;
    if (room <= 0) return;
    const accepted: PendingImage[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      const img = await readImageFile(file);
      if (img) accepted.push(img);
    }
    if (accepted.length > 0) {
      setPendingImages((prev) => [...prev, ...accepted].slice(0, MAX_IMAGES));
    }
  }, [pendingImages.length]);

  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || sending) return;
    setError(null);
    const outgoing: AiChatUiMessage = {
      role: 'user',
      content: text,
      attachments: pendingImages.length > 0 ? pendingImages : undefined,
    };
    const next: AiChatUiMessage[] = [...messages, outgoing];
    setMessages(next);
    setInput('');
    setPendingImages([]);
    setSending(true);
    try {
      const result = await adapter.send(next, {
        provider,
        model,
        attachments: outgoing.attachments,
        useCache,
        conversationId: conversationId ?? undefined,
      });
      if (serverMode) {
        if (result.conversationId && !conversationId) {
          setConversationId(result.conversationId);
        }
        void refreshConversations();
      }
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
      onAfterSend?.();
    }
  }, [input, pendingImages, sending, messages, adapter, provider, model, useCache, conversationId, serverMode, refreshConversations, onAfterSend]);

  const clear = useCallback(() => {
    if (serverMode) {
      startNewChat();
      return;
    }
    setMessages([]);
    saveHistory(adapter.id, []);
  }, [adapter.id, serverMode, startNewChat]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!adapter.supportsAttachments) return;
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) {
      e.preventDefault();
      void addImageFiles(files);
    }
  };

  const usageLine = (m: AiChatUiMessage): string | null => {
    const u = m.meta?.usage;
    if (!u || (u.prompt_tokens == null && u.completion_tokens == null)) return null;
    const parts = [`${u.prompt_tokens ?? '?'} in`, `${u.completion_tokens ?? '?'} out`];
    if (u.cache_read_tokens) parts.push(`${u.cache_read_tokens} cache-read`);
    if (u.cache_write_tokens) parts.push(`${u.cache_write_tokens} cache-write`);
    return parts.join(' · ');
  };

  const messageList = (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
      {messages.length === 0 && !loadingConversation && (
        <div className="text-center text-sm text-slate-400 dark:text-slate-500 mt-8">
          <Bot className="w-8 h-8 mx-auto mb-2 opacity-60" />
          Ask {adapter.label} anything.
          {adapter.supportsAttachments && (
            <div className="text-xs mt-1 opacity-80">Attach or paste images for vision models.</div>
          )}
        </div>
      )}
      {loadingConversation && (
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 mt-8 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading conversation…
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
            {m.attachments && m.attachments.length > 0 && (
              <div className={`flex flex-wrap gap-1.5 ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.attachments.map((a, ai) => (
                  a.url ? (
                    <img
                      key={ai}
                      src={a.url}
                      alt={a.name || `attachment ${ai + 1}`}
                      className="max-w-[160px] max-h-[120px] rounded-xl border border-slate-200 dark:border-slate-700 object-cover"
                    />
                  ) : null
                ))}
              </div>
            )}
            {m.content !== '' && (
              <div className={`rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'}`}>
                {m.role === 'user'
                  ? <span className="whitespace-pre-wrap">{m.content}</span>
                  : <div className="prose prose-sm dark:prose-invert max-w-none aichatkit-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>}
              </div>
            )}
            {m.role === 'assistant' && (m.meta?.cached || usageLine(m)) && (
              <span className="flex items-center gap-2 px-1 text-[9px] font-mono text-slate-400 dark:text-slate-500">
                {m.meta?.cached && (
                  <span className="inline-flex items-center gap-0.5 text-emerald-500 font-semibold uppercase tracking-wide">
                    <Zap className="w-3 h-3" /> prompt cache
                  </span>
                )}
                {usageLine(m)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={`flex h-full ${className || ''}`}>
      {/* Server-conversation rail (only when the adapter persists sessions). */}
      {serverMode && (
        <div className="w-48 shrink-0 border-r border-slate-200 dark:border-slate-700 flex flex-col min-h-0">
          <button
            onClick={startNewChat}
            className="m-2 px-2 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" /> New chat
          </button>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {conversations.length === 0 && (
              <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-4 flex flex-col items-center gap-1">
                <MessagesSquare className="w-4 h-4 opacity-60" /> No conversations yet
              </div>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer text-xs ${
                  c.id === conversationId
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                onClick={() => void openConversation(c.id)}
              >
                <span className="flex-1 min-w-0 truncate" title={c.title}>{c.title || 'Untitled'}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); void removeConversation(c.id); }}
                  className="shrink-0 p-0.5 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete conversation"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col h-full flex-1 min-w-0">
        {/* Toolbar: provider/model selectors (only when the adapter advertises
            providers) + the prompt-cache toggle + the clear/new control. */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-xs">
          {providers.length > 0 && (
            <>
              <select
                value={provider}
                onChange={(e) => { setProvider(e.target.value); setModel(''); }}
                className="bg-transparent border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-700 dark:text-slate-200 max-w-[45%] truncate"
              >
                {providers.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    title={p.probeError || undefined}
                    className={p.available === false ? 'text-amber-600' : undefined}
                  >
                    {p.label}{p.available === false ? ' (unconfigured)' : ''}
                  </option>
                ))}
              </select>
              {activeProvider && activeProvider.models && activeProvider.models.length > 0 && (
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="bg-transparent border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-700 dark:text-slate-200 max-w-[35%] truncate"
                >
                  <option value="">default model</option>
                  {activeProvider.models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
            </>
          )}
          {adapter.supportsPromptCache && (
            <button
              onClick={() => setUseCache((v) => !v)}
              className={`p-1 rounded ${useCache ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-400 hover:text-slate-500'}`}
              title={useCache ? 'Prompt cache ON — repeated prompts skip the provider call' : 'Prompt cache OFF'}
            >
              {useCache ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={clear}
            disabled={messages.length === 0 && !conversationId}
            className="ml-auto p-1 text-slate-400 hover:text-rose-500 disabled:opacity-40 disabled:hover:text-slate-400 disabled:cursor-not-allowed"
            title={serverMode ? 'New conversation' : 'Clear conversation'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {messageList}

        {error && (
          <div className="px-3 py-1 text-xs text-rose-500 border-t border-rose-200 dark:border-rose-900/40">{error}</div>
        )}

        {/* Composer */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-2">
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1 pb-2">
              {pendingImages.map((img, i) => (
                <span key={i} className="relative inline-flex">
                  <img
                    src={img.preview}
                    alt={img.name || `image ${i + 1}`}
                    className="w-12 h-12 rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
                  />
                  <button
                    onClick={() => setPendingImages((prev) => prev.filter((_, pi) => pi !== i))}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-700 text-white flex items-center justify-center hover:bg-rose-500"
                    title="Remove image"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            {adapter.supportsAttachments && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) void addImageFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || pendingImages.length >= MAX_IMAGES}
                  className="shrink-0 w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-indigo-500 hover:border-indigo-400 disabled:opacity-40 flex items-center justify-center"
                  title={pendingImages.length >= MAX_IMAGES ? `Max ${MAX_IMAGES} images` : 'Attach image(s)'}
                >
                  <ImagePlus className="w-4 h-4" />
                </button>
              </>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              rows={1}
              placeholder={`Message ${adapter.label}…`}
              className="flex-1 resize-none max-h-32 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none px-2 py-2"
            />
            <button
              onClick={send}
              disabled={sending || (!input.trim() && pendingImages.length === 0)}
              className="shrink-0 w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white flex items-center justify-center"
              title="Send"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiChatKit;
