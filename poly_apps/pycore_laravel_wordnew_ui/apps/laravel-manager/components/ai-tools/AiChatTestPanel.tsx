/**
 * AiChatTestPanel — single-message chat test for the AI Tools console.
 *
 * Reuses the AiManagement chat-test logic over laravel_main's unified AI
 * gateway (POST /api/local/ai/chat): pick "Auto" smart dispatch or force a
 * specific provider, then render the reply plus which provider/model produced
 * it and the latency. The provider list is loaded once from the instant
 * catalog (no probe, no quota spend).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MessageSquare, RefreshCcw, Send, AlertTriangle, Timer,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { useToast } from '../admin';
import { appendLog } from '@/core/logstore/logStore';
import type { AiProvider, AiChatResult } from '@/apps/laravel-manager/api';
import ToolWrapper from '@/shared/ui/ToolWrapper';
import { commonClasses } from '@/shared/styles/theme';
import { AiBentoCard, AiToolAlert } from '@/shared/ui/AiToolUi';

const selectCls = `${commonClasses.select} !py-2 text-xs font-mono disabled:opacity-50`;

const AiChatTestPanel: React.FC = () => {
  const toast = useToast();

  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const [chatProvider, setChatProvider] = useState('auto');
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<AiChatResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.aiManagement.getCatalog();
      if (res.success && res.data && Array.isArray(res.data.providers)) {
        setProviders(res.data.providers);
      }
    } catch { /* keep last */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  const configuredProviders = useMemo(
    () => providers.filter((p) => p.configured).map((p) => p.name),
    [providers],
  );

  const sendChat = useCallback(async () => {
    const message = chatInput.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    setReply(null);
    appendLog('info', 'ai', `Chat test → ${chatProvider} : ${message.slice(0, 80)}`);
    try {
      const res = await api.aiManagement.chat({
        provider: chatProvider,
        message,
        source: 'ai-tools',
      });
      if (res.success && res.data && res.data.success) {
        setReply(res.data);
        appendLog('success', 'ai',
          `Chat reply via ${res.data.provider}/${res.data.model} (${Math.round(res.data.latency_ms ?? 0)}ms)`);
      } else {
        const msg = res.data?.error || res.error || 'Chat request failed';
        const retry = res.data?.retry_after_s;
        setError(retry != null ? `${msg} (retry in ${retry}s)` : msg);
        toast.error(msg, 'Chat test');
        appendLog('error', 'ai', `Chat test failed: ${msg}`);
      }
    } catch (e: any) {
      const msg = e?.message || 'Chat request failed';
      setError(msg);
      toast.error(msg, 'Chat test');
    } finally {
      setSending(false);
    }
  }, [chatInput, chatProvider, sending, toast]);

  return (
    <ToolWrapper
      title="Chat Test"
      icon={MessageSquare}
      gradient="cyan"
      description="Send one message through the unified gateway"
      actions={
        <button
          onClick={() => void loadCatalog()}
          disabled={loading}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Reload providers
        </button>
      }
    >
      <div className="space-y-4 sm:space-y-5">
        <AiBentoCard title="Chat Test">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Send one message through the gateway. Auto uses smart free→balance→paid dispatch; pick a provider to force it.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={chatProvider}
              onChange={(e) => setChatProvider(e.target.value)}
              disabled={sending}
              className={`${selectCls} shrink-0`}
            >
              <option value="auto">Auto (smart dispatch)</option>
              {configuredProviders.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChat(); } }}
              placeholder="Type a test prompt…"
              disabled={sending}
              className={`${commonClasses.input} flex-1 min-w-0 text-xs disabled:opacity-50`}
            />
            <button
              onClick={() => void sendChat()}
              disabled={sending || !chatInput.trim()}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} shrink-0 text-xs flex items-center gap-1.5 disabled:opacity-50`}
            >
              {sending ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>

          {error && (
            <div className="mt-3">
              <AiToolAlert>
                <span className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="break-words">{error}</span>
                </span>
              </AiToolAlert>
            </div>
          )}

          {reply && (
            <div className="mt-3 rounded-xl p-3 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {reply.nickname || reply.provider}
                  <span className="text-slate-400 font-normal font-mono"> · {reply.provider}/{reply.model}</span>
                </span>
                {reply.latency_ms != null && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 shrink-0">
                    <Timer className="w-3 h-3" />{Math.round(reply.latency_ms)} ms
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                {reply.text}
              </p>
            </div>
          )}
        </AiBentoCard>
      </div>
    </ToolWrapper>
  );
};

export default AiChatTestPanel;
