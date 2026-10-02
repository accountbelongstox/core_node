/**
 * AiPromptCachePanel — the gateway-local prompt cache of the AI chat surface.
 *
 * Read/clear view over GET /api/local/ai/prompt-cache: totals (entries, hits,
 * misses, hit rate), per-provider counters and the most recent cached prompts
 * (excerpts only — cached bodies never leave the server). A cache hit answers
 * a repeated prompt without spending provider quota; Anthropic additionally
 * caches provider-side (reported as cache tokens in chat usage).
 *
 * Refreshes on mount, on Refresh, and whenever `refreshKey` changes (the AI
 * Management page bumps it after every chat turn).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Zap, RefreshCcw, AlertTriangle, Trash2, DatabaseZap, Timer,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { useTranslation } from '@/apps/laravel-manager/i18n';
import { useToast } from '../admin';
import type { AiPromptCacheStats } from '@/apps/laravel-manager/api';
import ToolWrapper from '@/shared/ui/ToolWrapper';
import { commonClasses } from '@/shared/styles/theme';
import { AiToolAlert } from '@/shared/ui/AiToolUi';

interface AiPromptCachePanelProps {
  /** Bump to trigger a reload (e.g. after a chat send). */
  refreshKey?: number;
}

const AiPromptCachePanel: React.FC<AiPromptCachePanelProps> = ({ refreshKey = 0 }) => {
  const toast = useToast();
  const { t } = useTranslation();
  const [data, setData] = useState<AiPromptCacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.aiManagement.getPromptCache();
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.error || t('uiAi.prompt_cache.unavailable'));
      }
    } catch (e: any) {
      setError(e?.message || t('uiAi.prompt_cache.unavailable'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const clear = useCallback(async () => {
    setClearing(true);
    try {
      const res = await api.aiManagement.clearPromptCache();
      if (res.success && res.data?.success) {
        toast.success(t('uiAi.prompt_cache.toast.cleared'), t('uiAi.prompt_cache.toast.title'));
        await load();
      } else {
        toast.error(res.error || t('uiAi.prompt_cache.toast.clear_failed'), t('uiAi.prompt_cache.toast.title'));
      }
    } catch (e: any) {
      toast.error(e?.message || t('uiAi.prompt_cache.toast.clear_failed'), t('uiAi.prompt_cache.toast.title'));
    } finally {
      setClearing(false);
    }
  }, [load, toast, t]);

  const fmtAge = (ts: number): string => {
    const s = Math.max(0, Date.now() / 1000 - ts);
    if (s < 90) return t('uiAi.prompt_cache.age_seconds', { count: Math.ceil(s) });
    if (s < 5400) return t('uiAi.prompt_cache.age_minutes', { count: Math.ceil(s / 60) });
    if (s < 172800) return t('uiAi.prompt_cache.age_hours', { count: Math.ceil(s / 3600) });
    return t('uiAi.prompt_cache.age_days', { count: Math.ceil(s / 86400) });
  };

  const perProvider = Object.entries(data?.per_provider ?? {});

  return (
    <ToolWrapper
      title={t('uiAi.prompt_cache.title')}
      icon={Zap}
      gradient="emerald"
      description={t('uiAi.prompt_cache.description')}
      actions={
        <>
          <button
            onClick={() => void load()}
            disabled={loading}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('uiAi.prompt_cache.refresh')}
          </button>
          <button
            onClick={() => void clear()}
            disabled={clearing || !data || data.entries === 0}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
          >
            <Trash2 className={`w-3.5 h-3.5 ${clearing ? 'animate-pulse' : ''}`} />
            {t('uiAi.prompt_cache.clear')}
          </button>
        </>
      }
    >
      <div className="space-y-4 sm:space-y-5">
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
            <RefreshCcw className="w-4 h-4 animate-spin text-slate-400" /> {t('uiAi.prompt_cache.loading')}
          </div>
        ) : data && (
          <>
            {/* totals */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: t('uiAi.prompt_cache.stat_entries'), value: data.entries },
                { label: t('uiAi.prompt_cache.stat_hits'), value: data.hits },
                { label: t('uiAi.prompt_cache.stat_misses'), value: data.misses },
                { label: t('uiAi.prompt_cache.stat_hit_rate'), value: data.hit_rate != null ? `${Math.round(data.hit_rate * 100)}%` : '—' },
              ].map((s) => (
                <span
                  key={s.label}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono
                             bg-emerald-500/8 border border-emerald-400/20 text-slate-600 dark:text-slate-300"
                >
                  <DatabaseZap className="w-3 h-3 text-emerald-500" />
                  <span className="uppercase tracking-wide text-[9px] text-slate-400">{s.label}</span>
                  <span className="font-bold">{s.value}</span>
                </span>
              ))}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-400">
                <Timer className="w-3 h-3" /> {t('uiAi.prompt_cache.ttl', { hours: Math.round(data.ttl_s / 3600) })}
              </span>
            </div>

            {/* per-provider counters */}
            {perProvider.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {perProvider.map(([name, st]) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono
                               bg-slate-500/8 border border-slate-400/20 text-slate-500 dark:text-slate-400"
                    title={t('uiAi.prompt_cache.provider_title', { name, entries: st.entries ?? 0, hits: st.hits ?? 0, misses: st.misses ?? 0 })}
                  >
                    <span className="font-bold text-slate-600 dark:text-slate-300">{name}</span>
                    <span>{t('uiAi.prompt_cache.chip_entries', { count: st.entries ?? 0 })}</span>·
                    <span className="text-emerald-500">{t('uiAi.prompt_cache.chip_hits', { count: st.hits ?? 0 })}</span>·
                    <span>{t('uiAi.prompt_cache.chip_miss', { count: st.misses ?? 0 })}</span>
                  </span>
                ))}
              </div>
            )}

            {/* recent entries (excerpts only) */}
            {data.recent.length === 0 ? (
              <p className="text-[11px] italic text-slate-400">
                {t('uiAi.prompt_cache.empty')}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {data.recent.map((e) => (
                  <li
                    key={e.key}
                    className="rounded-xl px-3 py-2 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate font-mono">
                        {e.resolved_provider || e.provider}
                        <span className="text-slate-400 font-normal">/{e.model || '-'}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0 text-[9px] font-mono text-slate-400">
                        {e.hits > 0 && <span className="text-emerald-500 font-semibold">{t('uiAi.prompt_cache.entry_hits', { count: e.hits })}</span>}
                        <span>{fmtAge(e.ts)}</span>
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={e.prompt}>
                      {e.prompt}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </ToolWrapper>
  );
};

export default AiPromptCachePanel;
