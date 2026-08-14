/**
 * AiImageGenPanel — image generation test for the AI Tools console.
 *
 * Prompt + size + optional provider/model → POST /api/local/ai/image. Renders
 * the returned image from a `data:${mime};base64,${image_base64}` URI and shows
 * which provider/model produced it plus the latency. Every successful
 * generation is auto-recorded to the shared cross-runtime history, so there is
 * no explicit "save" — it shows up in the Image History tool.
 *
 * Provider choices are seeded from the instant catalog (image-capable providers
 * first). A prompt can be pre-filled by the Image History "reuse prompt" action
 * via imageGenBridge.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ImagePlus, RefreshCcw, Sparkles, AlertTriangle, Timer, Download,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { useToast } from '../admin';
import { appendLog } from '@/core/logstore/logStore';
import type { AiProvider, AiImageResult } from '@/apps/laravel-manager/api';
import ToolWrapper from '@/shared/ui/ToolWrapper';
import { commonClasses } from '@/shared/styles/theme';
import { AiBentoCard, AiToolAlert } from '@/shared/ui/AiToolUi';
import { takePendingPrompt, subscribeReusePrompt } from './imageGenBridge';

const selectCls = `${commonClasses.select} !py-2 text-xs font-mono disabled:opacity-50`;

/** Aspect-ratio sizes accepted by the unified image contract. */
const SIZES = [
  { id: '1:1', label: 'Square (1:1)' },
  { id: '16:9', label: 'Landscape (16:9)' },
  { id: '9:16', label: 'Portrait (9:16)' },
  { id: '4:3', label: 'Standard (4:3)' },
];

const AiImageGenPanel: React.FC = () => {
  const toast = useToast();

  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1:1');
  const [provider, setProvider] = useState('auto');
  const [model, setModel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<AiImageResult | null>(null);
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

  // Pick up a prompt queued by the Image History "reuse prompt" action.
  useEffect(() => {
    const queued = takePendingPrompt();
    if (queued) setPrompt(queued);
    return subscribeReusePrompt((p) => setPrompt(p));
  }, []);

  // Image-capable, configured providers first; "auto" always available.
  const imageProviders = useMemo(
    () => providers.filter((p) => p.image && p.configured),
    [providers],
  );

  const selectedProvider = useMemo(
    () => imageProviders.find((p) => p.name === provider) ?? null,
    [imageProviders, provider],
  );

  const generate = useCallback(async () => {
    const text = prompt.trim();
    if (!text || generating) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    appendLog('info', 'ai', `Image gen → ${provider}/${model || 'default'} (${size}) : ${text.slice(0, 80)}`);
    try {
      const res = await api.aiManagement.image({
        prompt: text,
        size,
        provider: provider !== 'auto' ? provider : undefined,
        model: model || undefined,
        source: 'ai-tools',
      });
      if (res.success && res.data && res.data.success && res.data.image_base64) {
        setResult(res.data);
        appendLog('success', 'ai',
          `Image generated via ${res.data.provider}/${res.data.model} (${Math.round(res.data.latency_ms ?? 0)}ms) · saved to history`);
        toast.success(`Image generated via ${res.data.provider}`, 'Image gen');
      } else {
        const msg = res.data?.error || res.error || 'Image generation failed';
        setError(msg);
        toast.error(msg, 'Image gen');
        appendLog('error', 'ai', `Image gen failed: ${msg}`);
      }
    } catch (e: any) {
      const msg = e?.message || 'Image generation failed';
      setError(msg);
      toast.error(msg, 'Image gen');
    } finally {
      setGenerating(false);
    }
  }, [prompt, size, provider, model, generating, toast]);

  const dataUri = result ? `data:${result.mime || 'image/png'};base64,${result.image_base64}` : null;

  return (
    <ToolWrapper
      title="Image Gen"
      icon={ImagePlus}
      gradient="violet"
      description="Generate an image through the unified gateway"
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
        <AiBentoCard title="Image Gen">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Describe an image; the gateway routes to an image-capable provider. Every result is auto-saved to the shared Image History.
          </p>

          <div className="space-y-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Prompt</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="A misty mountain lake at sunrise, cinematic, ultra detailed…"
                disabled={generating}
                className={`${commonClasses.textarea} text-xs disabled:opacity-50`}
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Size</span>
                <select value={size} onChange={(e) => setSize(e.target.value)} disabled={generating} className={selectCls}>
                  {SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Provider</span>
                <select
                  value={provider}
                  onChange={(e) => { setProvider(e.target.value); setModel(''); }}
                  disabled={generating}
                  className={selectCls}
                >
                  <option value="auto">Auto (smart dispatch)</option>
                  {imageProviders.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Model</span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={generating || !selectedProvider || (selectedProvider.models?.length ?? 0) === 0}
                  className={selectCls}
                >
                  <option value="">{selectedProvider?.image_model ? `default (${selectedProvider.image_model})` : 'default'}</option>
                  {(selectedProvider?.models ?? []).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void generate()}
                disabled={generating || !prompt.trim()}
                className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
              >
                {generating ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generating ? 'Generating…' : 'Generate'}
              </button>
              {result && (
                <span className="inline-flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-violet-500/15 text-violet-500">
                    {result.provider}/{result.model}
                  </span>
                  {result.latency_ms != null && (
                    <span className="inline-flex items-center gap-1"><Timer className="w-3 h-3" />{Math.round(result.latency_ms)} ms</span>
                  )}
                </span>
              )}
            </div>

            {error && (
              <AiToolAlert>
                <span className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="break-words">{error}</span>
                </span>
              </AiToolAlert>
            )}
          </div>
        </AiBentoCard>

        {dataUri && (
          <AiBentoCard title="Result">
            <div className="flex flex-col items-center gap-3">
              <img
                src={dataUri}
                alt={prompt.slice(0, 120)}
                className="max-h-[60vh] w-auto max-w-full rounded-xl ring-1 ring-slate-200/60 dark:ring-white/10 shadow-sm"
              />
              <a
                href={dataUri}
                download={`ai-image-${Date.now()}.${(result?.mime || 'image/png').split('/')[1] || 'png'}`}
                className={`${commonClasses.button} ${commonClasses.buttonSecondary} text-xs flex items-center gap-1.5`}
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                Auto-saved to the shared Image History.
              </p>
            </div>
          </AiBentoCard>
        )}
      </div>
    </ToolWrapper>
  );
};

export default AiImageGenPanel;
