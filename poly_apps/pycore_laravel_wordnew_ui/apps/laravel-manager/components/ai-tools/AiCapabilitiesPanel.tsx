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
import { useTranslation } from '@/apps/laravel-manager/i18n';
import ToolWrapper from '@/shared/ui/ToolWrapper';
import { commonClasses } from '@/shared/styles/theme';
import { AiToolAlert } from '@/shared/ui/AiToolUi';

/** Feature columns rendered by the matrix, in display order. */
const COLUMNS: { key: string }[] = [
  { key: 'text' },
  { key: 'vision' },
  { key: 'images' },
  { key: 'audio' },
  { key: 'transcription' },
  { key: 'embeddings' },
  { key: 'reranking' },
  { key: 'files' },
];

const AiCapabilitiesPanel: React.FC = () => {
  const { t } = useTranslation();
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
        setError(res.error || t('uiAi.capabilities.unavailable'));
      }
    } catch (e: any) {
      setError(e?.message || t('uiAi.capabilities.unavailable'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const has = (caps: string[], key: string): boolean => caps.includes(key);

  return (
    <ToolWrapper
      title={t('uiAi.capabilities.title')}
      icon={Sparkles}
      gradient="violet"
      description={t('uiAi.capabilities.description')}
      actions={
        <button
          onClick={() => void load()}
          disabled={loading}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('uiAi.capabilities.refresh')}
        </button>
      }
    >
      <div className="space-y-4 sm:space-y-5">
        <AiToolAlert variant="info">
          <span className="break-words leading-relaxed">
            {t('uiAi.capabilities.info', { sdk: data?.sdk || 'laravel/ai' })}
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
            <RefreshCcw className="w-4 h-4 animate-spin text-slate-400" /> {t('uiAi.capabilities.loading')}
          </div>
        ) : data && (
          <>
            {/* defaults strip */}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.defaults ?? {}).map(([kind, provider]) => (
                provider ? (
                  <span
                    key={kind}
                    title={t('uiAi.capabilities.default_provider_title', { kind })}
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
                    <th className="py-2 pr-3 font-semibold">{t('uiAi.capabilities.col_provider')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('uiAi.capabilities.col_key')}</th>
                    {COLUMNS.map((c) => (
                      <th key={c.key} className="py-2 px-1.5 font-semibold text-center" title={t(`uiAi.capabilities.columns.${c.key}`)}>{t(`uiAi.capabilities.columns.${c.key}`)}</th>
                    ))}
                    <th className="py-2 pl-3 font-semibold">{t('uiAi.capabilities.col_default_model')}</th>
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
                              title={p.key_masked ?? t('uiAi.capabilities.configured')}
                            >
                              <KeyRound className="w-3 h-3" />{p.key_masked ?? t('uiAi.capabilities.key_set')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                              <Minus className="w-3 h-3" /> {t('uiAi.capabilities.no_key')}
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
