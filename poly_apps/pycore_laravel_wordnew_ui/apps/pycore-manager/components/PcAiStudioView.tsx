/**
 * PcAiStudioView — the "Image Studio" sub-view: a CHAT-STYLE generation surface.
 *
 * The former PcAiImagePage, reimagined as a conversation. The user types a
 * prompt and hits Send; the prompt appears as a user bubble and the result
 * streams in as an assistant message:
 *   - Image mode → an image card (provider / model / latency, click to enlarge,
 *     reuse prompt, download, delete-from-history).
 *   - Text mode  → a text bubble from the unified gateway (aiAuto).
 * A toggle switches the same chat surface between Image and Text.
 *
 * Past image generations are pulled from the SHARED image history endpoint and
 * shown as earlier "messages" (oldest → newest), so the conversation opens with
 * the real backlog. Deleting an image message removes it from the shared store.
 *
 * Local state + pycoreApi + lucide-react + Tailwind / `.pc-glass` only.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image as ImageIcon, MessageSquare, Send, RefreshCcw, Trash2, AlertTriangle,
  Download, RotateCcw, Wand2, Sparkles, User, Bot, Eraser,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import { fetchPycoreBlobUrl } from '../../../core/api-libs/pycore/PycoreBlob';
import type { AiProvider, ImageHistoryEntry } from '../../../core/api-libs/pycore';
import { logInfo, logSuccess, logError } from '../../../core/logstore/logStore';
import { PcImageLightbox } from './PcAiShared';
import { PcBlobImage } from './PcBlobMedia';

const LOG_SRC = 'pc-ai-studio';
const SIZE_OPTIONS = ['1:1', '16:9', '9:16', '4:3'] as const;
type SizeOption = (typeof SIZE_OPTIONS)[number];
type StudioMode = 'image' | 'text';

/** One conversation entry. Prompt → user bubble; result → assistant bubble. */
interface StudioMsg {
  id: string;
  role: 'user' | 'assistant';
  kind: 'text' | 'image' | 'pending' | 'error';
  text: string;
  /** image fields (kind === 'image'). */
  imageSrc?: string;
  /** When the image lives in the shared history store, its id (for delete). */
  historyId?: string;
  provider?: string;
  model?: string;
  latency_ms?: number | null;
  /** True for the seeded history backlog (vs a just-generated message). */
  fromHistory?: boolean;
}

const OriginPill: React.FC<{ provider?: string; model?: string; latency_ms?: number | null }> =
  ({ provider, model, latency_ms }) => (
    <span className="text-[10px] font-mono text-slate-400 truncate">
      {provider || '—'}{model ? ` · ${model}` : ''}
      {latency_ms != null ? ` · ${Math.round(latency_ms)} ms` : ''}
    </span>
  );

const PcAiStudioView: React.FC<{ refreshSignal?: number }> = ({ refreshSignal }) => {
  const { t } = useTranslation('pc');

  const [providers, setProviders] = useState<AiProvider[] | null>(null);
  const [mode, setMode] = useState<StudioMode>('image');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<SizeOption>('1:1');
  const [provider, setProvider] = useState(''); // '' = auto
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<StudioMsg[]>([]);
  const [lightbox, setLightbox] = useState<StudioMsg | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const imageProviders = useMemo(
    () => (providers ?? []).filter((p) => p.image),
    [providers],
  );

  const loadCatalog = useCallback(async () => {
    try {
      const r = await pycoreApi.getAiCatalog();
      if (Array.isArray(r?.providers)) {
        setProviders(r.providers);
      } else {
        // getJSON does not throw on non-2xx: a 404 from a STALE pycore arrives
        // as {detail:"Not Found"}. Surface it so the image-provider list isn't
        // silently empty.
        const detail = (r as any)?.detail || (r as any)?.error;
        setProviders(null);
        setError(detail
          ? `${detail} — AI catalog endpoint missing; restart pycore to load it.`
          : t('aiImage.unreachable'));
      }
    } catch { /* network error: keep last */ }
  }, [t]);

  // Seed the conversation backlog from the shared image history (oldest first,
  // so the newest sits at the bottom like a chat). Only image entries exist in
  // this store; text chats are session-only here.
  const loadHistory = useCallback(async () => {
    try {
      const r = await pycoreApi.getImageHistory(50);
      const entries: ImageHistoryEntry[] = Array.isArray(r?.entries) ? r.entries : [];
      // Resolve history files to data URLs over RPC v2 before any image,
      // lightbox, or download element receives them.
      const groups = await Promise.all([...entries].reverse().map(async (e): Promise<StudioMsg[]> => {
        const imageSrc = await fetchPycoreBlobUrl(pycoreApi.imageHistoryFileUrl(e.id));
        return [{
          id: `hist-prompt-${e.id}`,
          role: 'user',
          kind: 'text',
          text: e.prompt || '—',
          fromHistory: true,
        }, {
          id: `hist-img-${e.id}`,
          role: 'assistant',
          kind: 'image',
          text: e.prompt || '',
          imageSrc,
          historyId: e.id,
          provider: e.provider,
          model: e.model,
          latency_ms: e.latency_ms,
          fromHistory: true,
        }];
      }));
      const seeded = groups.flat();
      // Keep any in-session (non-history) messages appended after the backlog.
      setMessages((prev) => {
        const live = prev.filter((m) => !m.fromHistory);
        return [...seeded, ...live];
      });
    } catch (e: any) {
      setError(e?.message || t('aiImage.unreachable'));
    }
  }, [t]);

  useEffect(() => { void loadCatalog(); void loadHistory(); }, [loadCatalog, loadHistory]);

  // External refresh signal from the page header (PcAiPage Refresh button).
  useEffect(() => {
    if (refreshSignal === undefined) return;
    void loadCatalog();
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  // Auto-scroll the conversation to the bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(async () => {
    const text = prompt.trim();
    if (!text || busy) { if (!text) setError(t('aiImage.emptyPrompt')); return; }
    setError(null);
    setBusy(true);
    const stamp = Date.now();
    const userMsg: StudioMsg = { id: `u-${stamp}`, role: 'user', kind: 'text', text };
    const pendingId = `a-${stamp}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: pendingId, role: 'assistant', kind: 'pending', text: '' },
    ]);
    setPrompt('');

    const replacePending = (patch: Partial<StudioMsg>) =>
      setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, ...patch } : m)));

    try {
      if (mode === 'image') {
        logInfo(LOG_SRC, `Generating image: "${text.slice(0, 60)}"…`);
        const r = await pycoreApi.generateImage({
          prompt: text,
          size,
          ...(provider ? { provider } : {}),
          ...(model.trim() ? { model: model.trim() } : {}),
          source: 'pycore-ai-studio',
        });
        if (r?.success && r.image_base64) {
          replacePending({
            kind: 'image',
            text,
            imageSrc: `data:${r.mime || 'image/png'};base64,${r.image_base64}`,
            historyId: r.id,
            provider: r.provider,
            model: r.model,
            latency_ms: r.latency_ms,
          });
          logSuccess(LOG_SRC, `Image generated via ${r.provider} (${Math.round(r.latency_ms ?? 0)} ms).`);
          // The backend auto-records into the shared store; refresh ids/backlog.
          void loadHistory();
        } else {
          const msg = r?.error || t('aiImage.genFailed');
          replacePending({ kind: 'error', text: msg });
          logError(LOG_SRC, `Image generation failed: ${msg}`);
        }
      } else {
        logInfo(LOG_SRC, `Text chat: "${text.slice(0, 60)}"…`);
        const r = await pycoreApi.aiAuto([{ role: 'user', content: text }], 'pycore-ai-studio');
        if (r?.success && r.text) {
          replacePending({
            kind: 'text',
            text: r.text,
            provider: r.provider,
            model: r.model,
            latency_ms: r.latency_ms,
          });
          logSuccess(LOG_SRC, `Reply via ${r.provider} (${Math.round(r.latency_ms ?? 0)} ms).`);
        } else {
          const msg = r?.error || t('aiImage.genFailed');
          replacePending({ kind: 'error', text: msg });
          logError(LOG_SRC, `Chat failed: ${msg}`);
        }
      }
    } catch (e: any) {
      const msg = e?.message || t('aiImage.genFailed');
      replacePending({ kind: 'error', text: msg });
      logError(LOG_SRC, `Studio request failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [prompt, busy, mode, size, provider, model, loadHistory, t]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }, [send]);

  const reusePrompt = useCallback((p: string) => {
    setPrompt(p);
  }, []);

  const handleDelete = useCallback(async (msg: StudioMsg) => {
    if (!msg.historyId) {
      // session-only image (no shared-store id) — just drop the message.
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      return;
    }
    const id = msg.historyId;
    setDeleting((s) => { const n = new Set(s); n.add(id); return n; });
    try {
      const r = await pycoreApi.deleteImageHistory(id);
      if (r?.success) {
        setMessages((prev) => prev.filter((m) => m.historyId !== id));
        setLightbox((p) => (p && p.historyId === id ? null : p));
      }
    } catch { /* keep */ }
    finally {
      setDeleting((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }, []);

  const clearConversation = useCallback(() => {
    if (!window.confirm(t('ai.confirmClearConversation'))) return;
    setMessages([]); // clear the visible conversation (history store untouched)
  }, [t]);

  return (
    <div className="space-y-4 min-w-0 max-w-full">
      {/* image-capable providers strip */}
      <section className="pc-glass p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Sparkles className="w-4 h-4 text-indigo-500" /> {t('aiImage.capableProviders')}
          </h2>
        </div>
        {imageProviders.length === 0 ? (
          <p className="text-[11px] italic text-slate-400">{t('aiImage.noImageProviders')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {imageProviders.map((p) => (
              <span
                key={p.name}
                title={`${p.image_ready ? 'Image generation ready (API key present).' : 'Image-capable, but no API key configured yet.'}${p.image_model ? ` Model: ${p.image_model}` : ''}`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold max-w-[220px] ${
                  p.image_ready
                    ? 'bg-pink-500/15 text-pink-500'
                    : 'border border-pink-400/40 text-pink-400/70'
                }`}>
                <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="font-bold text-slate-700 dark:text-slate-200">{p.name}</span>
                {p.image_model && <span className="truncate font-mono text-[10px] opacity-80">{p.image_model}</span>}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* chat surface */}
      <section className="pc-glass p-4 flex flex-col" style={{ minHeight: '60vh' }}>
        {/* mode toggle + clear */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex rounded-xl pc-glass overflow-hidden">
            {([
              { key: 'image' as const, label: t('ai.modeImage'), Icon: ImageIcon },
              { key: 'text' as const, label: t('ai.modeText'), Icon: MessageSquare },
            ]).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 transition ${
                  mode === key
                    ? 'bg-indigo-500/15 text-indigo-500'
                    : 'text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
                }`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-[11px] text-slate-400">
              {mode === 'image' ? t('ai.modeImageHint') : t('ai.modeTextHint')}
            </span>
            <button
              onClick={clearConversation}
              disabled={messages.length === 0}
              title={t('ai.clearConversation')}
              className="p-2 rounded-xl pc-glass hover:bg-rose-500/10 text-rose-500 transition disabled:opacity-40">
              <Eraser className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* conversation column */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
          {messages.length === 0 ? (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center gap-2 text-slate-400">
              <Wand2 className="w-8 h-8 opacity-50" />
              <p className="text-xs">{t('ai.emptyConversation')}</p>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div key={m.id} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
                  <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                    isUser ? 'bg-indigo-500/15 text-indigo-500' : 'bg-pink-500/15 text-pink-500'
                  }`}>
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`max-w-[80%] min-w-0 ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                      {isUser ? t('ai.you') : t('ai.assistant')}
                      {m.fromHistory && <span className="ml-1 normal-case font-normal opacity-70">· {t('ai.studioFrom')}</span>}
                    </span>

                    {/* pending */}
                    {m.kind === 'pending' && (
                      <div className="rounded-2xl px-3.5 py-2.5 bg-white/50 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 flex items-center gap-2 text-xs text-slate-500">
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                        {mode === 'image' ? t('ai.sending') : t('ai.sendingText')}
                      </div>
                    )}

                    {/* error */}
                    {m.kind === 'error' && (
                      <div className="rounded-2xl px-3.5 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="break-words">{m.text}</span>
                      </div>
                    )}

                    {/* text bubble */}
                    {m.kind === 'text' && (
                      <div className={`rounded-2xl px-3.5 py-2.5 text-sm break-words whitespace-pre-wrap ${
                        isUser
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 text-slate-700 dark:text-slate-200'
                      }`}>
                        {m.text || '—'}
                        {!isUser && (m.provider || m.latency_ms != null) && (
                          <div className="mt-1.5 pt-1.5 border-t border-current/10">
                            <OriginPill provider={m.provider} model={m.model} latency_ms={m.latency_ms} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* image card */}
                    {m.kind === 'image' && m.imageSrc && (
                      <div className="rounded-2xl overflow-hidden bg-white/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5">
                        <button
                          type="button"
                          onClick={() => setLightbox(m)}
                          title={t('aiImage.enlargeTitle')}
                          className="block">
                          <PcBlobImage
                            path={m.imageSrc}
                            alt={m.text}
                            loading="lazy"
                            className="max-h-72 w-auto object-contain"
                          />
                        </button>
                        <div className="p-2.5 flex flex-col gap-1.5">
                          <OriginPill provider={m.provider} model={m.model} latency_ms={m.latency_ms} />
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => reusePrompt(m.text)}
                              title={t('aiImage.reusePromptTitle')}
                              className="flex-1 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition pc-glass hover:bg-indigo-500/10 text-indigo-500">
                              <RotateCcw className="w-3 h-3" /> {t('ai.reuse')}
                            </button>
                            <a
                              href={m.imageSrc}
                              download={`pycore-image-${m.historyId || Date.now()}.png`}
                              title={t('aiImage.download')}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition pc-glass hover:bg-indigo-500/10 text-indigo-500">
                              <Download className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDelete(m)}
                              disabled={m.historyId ? deleting.has(m.historyId) : false}
                              title={t('aiImage.deleteTitle')}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 disabled:opacity-40">
                              {m.historyId && deleting.has(m.historyId)
                                ? <RefreshCcw className="w-3 h-3 animate-spin" />
                                : <Trash2 className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* composer */}
        <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-white/5">
          {error && (
            <div className="mb-2 flex items-start gap-2 text-xs rounded-xl p-2.5 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {/* image-only controls */}
          {mode === 'image' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as SizeOption)}
                title={t('aiImage.size')}
                className="rounded-xl border bg-white/60 dark:bg-white/5 border-slate-300/50 dark:border-white/10 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{t('aiImage.size')}: {s}</option>)}
              </select>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                title={t('aiImage.provider')}
                className="rounded-xl border bg-white/60 dark:bg-white/5 border-slate-300/50 dark:border-white/10 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                <option value="">{t('aiImage.provider')}: {t('aiImage.auto')}</option>
                {imageProviders.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={`${t('aiImage.model')} (${t('aiImage.auto')})`}
                className="rounded-xl border bg-white/60 dark:bg-white/5 border-slate-300/50 dark:border-white/10 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder={mode === 'image' ? t('ai.studioPlaceholderImage') : t('ai.studioPlaceholderText')}
              className="flex-1 rounded-xl border bg-white/60 dark:bg-white/5 border-slate-300/50 dark:border-white/10 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
            />
            <button
              onClick={send}
              disabled={busy || !prompt.trim()}
              className="shrink-0 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50">
              {busy ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {busy ? (mode === 'image' ? t('ai.sending') : t('ai.sendingText')) : t('ai.send')}
            </button>
          </div>
        </div>
      </section>

      {/* enlarge / detail lightbox */}
      <PcImageLightbox
        open={!!lightbox}
        src={lightbox?.imageSrc ?? null}
        alt={lightbox?.text}
        closeLabel={t('aiImage.close')}
        onClose={() => setLightbox(null)}
        caption={lightbox && (
          <>
            <OriginPill provider={lightbox.provider} model={lightbox.model} latency_ms={lightbox.latency_ms} />
            <p className="text-sm text-slate-700 dark:text-slate-200 break-words mt-1">{lightbox.text || '—'}</p>
          </>
        )}
        actions={lightbox && (
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => { reusePrompt(lightbox.text); setLightbox(null); }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition pc-glass hover:bg-indigo-500/10 text-indigo-500">
              <RotateCcw className="w-3.5 h-3.5" /> {t('ai.reuse')}
            </button>
            {lightbox.imageSrc && (
              <a
                href={lightbox.imageSrc}
                download={`pycore-image-${lightbox.historyId || Date.now()}.png`}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition pc-glass hover:bg-indigo-500/10 text-indigo-500">
                <Download className="w-3.5 h-3.5" /> {t('aiImage.download')}
              </a>
            )}
            <button
              type="button"
              onClick={() => handleDelete(lightbox)}
              disabled={lightbox.historyId ? deleting.has(lightbox.historyId) : false}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 disabled:opacity-40">
              <Trash2 className="w-3.5 h-3.5" /> {t('aiImage.delete')}
            </button>
          </div>
        )}
      />
    </div>
  );
};

export default PcAiStudioView;
