/**
 * AiCapabilitiesPanel — what laravel_main's official AI SDK (laravel/ai) can
 * do, per provider, whether or not a key is configured.
 *
 * One matrix over GET /api/local/ai/capabilities: rows are the SDK providers
 * from config/ai.php (key state, default models), columns are the official
 * feature set (text / vision input / image generation / TTS / STT /
 * embeddings / reranking / files). An unconfigured provider still shows its
 * full capability set — the key column is what turns it on (AI Providers
 * section above). Refreshes on mount and on the Refresh action.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Sparkles, RefreshCcw, AlertTriangle, Check, Minus, KeyRound, Eye,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import type { AiCapabilitiesResponse } from '@/apps/laravel-manager/api';
import ToolWrapper from '@/shared/ui/ToolWrapper';
import { commonClasses } from '@/shared/styles/theme';
import { AiToolAlert } from '@/shared/ui/AiToolUi';

/** Feature columns rendered by the matrix, in display order. */
const COLUMNS: { key: string; label: string }[] = [
  { key: 'text', label: 'Text' },
  { key: 'vision', label: 'Vision' },
  { key: 'images', label: 'Images' },
  { key: 'audio', label: 'TTS' },
  { key: 'transcription', label: 'STT' },
  { key: 'embeddings', label: 'Embed' },
  { key: 'reranking', label: 'Rerank' },
  { key: 'files', label: 'Files' },
];

const AiCapabilitiesPanel: React.FC = () => {
  const [data, setData] = useState<AiCapabilitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.aiManagement.getCapabilities();
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.error || 'capabilities unavailable');
      }
    } catch (e: any) {
      setError(e?.message || 'capabilities unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const has = (caps: string[], key: string): boolean => caps.includes(key);

  return (
    <ToolWrapper
      title="Laravel AI Capabilities"
      icon={Sparkles}
      gradient="violet"
      description="Official Laravel AI SDK feature matrix — available whether or not a key is configured"
      actions={
        <button
          onClick={() => void load()}
          disabled={loading}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      <div className="space-y-4 sm:space-y-5">
        <AiToolAlert variant="info">
          <span className="break-words leading-relaxed">
            This is the official Laravel AI SDK ({data?.sdk || 'laravel/ai'}) surface: agents with
            conversations, vision input, image generation, TTS/STT, embeddings, reranking and files.
            Every provider is listed even without a key — set one in Provider API Keys to enable it.
            The chat interface below dispatches through this SDK with automatic failover.
          </span>
        </AiToolAlert>

        {error && (
          <AiToolAlert variant="warning">
            <span className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </span>
          </AiToolAlert>
        )}

        {loading && !data ? (
          <div className="text-xs text-slate-500 py-6 text-center flex items-center justify-center gap-2">
            <RefreshCcw className="w-4 h-4 animate-spin text-slate-400" /> Loading capabilities…
          </div>
        ) : data && (
          <>
            {/* defaults strip */}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.defaults ?? {}).map(([kind, provider]) => (
                provider ? (
                  <span
                    key={kind}
                    title={`Default ${kind} provider`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium
                               bg-violet-500/8 border border-violet-400/20 text-slate-500 dark:text-slate-400"
                  >
                    <span className="uppercase tracking-wide text-violet-500/90">{kind}</span> → {provider}
                  </span>
                ) : null
              ))}
            </div>

            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-xs border-collapse min-w-[640px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-3 font-semibold">Provider</th>
                    <th className="py-2 pr-3 font-semibold">Key</th>
                    {COLUMNS.map((c) => (
                      <th key={c.key} className="py-2 px-1.5 font-semibold text-center" title={c.label}>{c.label}</th>
                    ))}
                    <th className="py-2 pl-3 font-semibold">Default model</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.providers ?? []).map((p) => (
                    <tr
                      key={p.name}
                      className={`border-t border-slate-200/60 dark:border-white/5 ${!p.configured ? 'opacity-60' : ''}`}
                    >
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-700 dark:text-slate-200">{p.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-500/10 text-slate-400">
                              {p.driver}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          {p.configured ? (
                            <span
                              className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400"
                              title={p.key_masked ?? 'configured'}
                            >
                              <KeyRound className="w-3 h-3" />{p.key_masked ?? 'set'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                              <Minus className="w-3 h-3" /> no key
                            </span>
                          )}
                        </td>
                        {COLUMNS.map((c) => {
                          const on = c.key === 'vision' ? p.accepts_images : has(p.capabilities, c.key);
                          return (
                            <td key={c.key} className="py-2 px-1.5 text-center">
                              {on ? (
                                c.key === 'vision' ? (
                                  <Eye className="w-3.5 h-3.5 inline text-violet-500" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 inline text-emerald-500" />
                                )
                              ) : (
                                <Minus className="w-3.5 h-3.5 inline text-slate-300 dark:text-slate-600" />
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 pl-3 font-mono text-[10px] text-slate-500 dark:text-slate-400 max-w-[220px] truncate" title={p.models?.text ?? ''}>
                          {p.models?.text ?? '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </ToolWrapper>
  );
};

export default AiCapabilitiesPanel;
