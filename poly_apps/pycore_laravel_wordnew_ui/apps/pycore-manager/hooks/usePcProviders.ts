/**
 * usePcProviders — the AI provider grid state: catalog (no quota spent), the
 * cached availability probe (mirrored through the route-recovery store), live
 * rate budgets, gateway key rotation, "test all" and per-key cooldown reset.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  pycoreApi, pycoreEventBus, pycoreRouteRecoveryStore, usePycoreCapability,
  PYCORE_BROWSER_EVENTS, PYCORE_EVENT_TOPICS, PYCORE_HTTP_DEFAULTS, PYCORE_HTTP_ROUTES,
} from '@/apps/pycore-manager/api';
import type { AiGatewayStatus, AiProvider, AiRateLimitsResponse } from '@/apps/pycore-manager/api';
import { appendChatMessages } from '../../../shared/AiChatKit/aiChatHistory';
import type { AiChatUiMessage } from '../../../core/contracts/ai';
import { logError, logSuccess } from '../../../core/logstore/logStore';
import { useTopicDrivenRefresh } from './useTopicDrivenRefresh';
import { usePcRefreshSignal } from './usePcRefreshSignal';

const LOG_SRC = 'pc-ai-providers';
const PROBE_CACHE_PARAMS = { refresh: 0 };
const CHAT_HISTORY_ID = 'pycore';
const MODELS_PREVIEW = 1;

export type ProviderSortField = 'original' | 'name' | 'availability' | 'speed';
export type ProviderSortDir = 'asc' | 'desc';
export type ProviderLoadError = 'unreachable' | 'missing' | 'probe' | null;

export function mergeGatewayKeyStatus(providers: AiProvider[], gateway: AiGatewayStatus | null): AiProvider[] {
  const gatewayProviders = Array.isArray(gateway?.providers)
    ? gateway.providers as Array<Pick<AiProvider, 'name' | 'key_count' | 'keys' | 'image_keys'>>
    : [];
  const byName = new Map(gatewayProviders.map((provider) => [provider.name, provider]));
  if (byName.size === 0) return providers;
  return providers.map((provider) => {
    const live = byName.get(provider.name);
    return live ? { ...provider, key_count: live.key_count, keys: live.keys, image_keys: live.image_keys } : provider;
  });
}

export function availabilityRank(provider: AiProvider): number {
  if (!provider.configured) return 4;
  if (provider.rate_limited) return 1;
  if (!provider.tested) return 3;
  return provider.available ? 0 : 2;
}

export function modelsLabel(provider: AiProvider): string {
  const models = provider.models ?? [];
  if (models.length === 0) return '-';
  if (models.length === MODELS_PREVIEW) return models[0];
  return `${models[0]} +${models.length - MODELS_PREVIEW}`;
}

function sortProviders(list: AiProvider[], field: ProviderSortField, dir: ProviderSortDir): AiProvider[] {
  if (field === 'original') return list;
  const sign = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    if (field === 'name') return sign * a.name.localeCompare(b.name);
    if (field === 'availability') return sign * (availabilityRank(a) - availabilityRank(b));
    const latencyA = a.tested && a.latency_ms != null ? a.latency_ms : Number.POSITIVE_INFINITY;
    const latencyB = b.tested && b.latency_ms != null ? b.latency_ms : Number.POSITIVE_INFINITY;
    return sign * (latencyA - latencyB);
  });
}

export function usePcProviders(refreshSignal?: number) {
  const { t } = useTranslation('pc');
  const { aiGateway, refresh: refreshCapabilityStatus, retry: retryCapabilityStatus } = usePycoreCapability();
  const gatewayRef = useRef<AiGatewayStatus | null>(aiGateway);
  const [providers, setProviders] = useState<AiProvider[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ProviderLoadError>(null);
  const [testingAll, setTestingAll] = useState(false);
  const [resetting, setResetting] = useState<Record<string, Set<string>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [sortField, setSortField] = useState<ProviderSortField>('original');
  const [sortDir, setSortDir] = useState<ProviderSortDir>('asc');

  const mergeProviders = useCallback((incoming: AiProvider[]) => {
    setProviders((previous) => {
      const order = previous ?? [];
      const byName = new Map(incoming.map((provider) => [provider.name, provider]));
      const merged = order.map((provider) => byName.get(provider.name) ?? provider);
      incoming.forEach((provider) => {
        if (!order.some((existing) => existing.name === provider.name)) merged.push(provider);
      });
      return merged;
    });
  }, []);

  const cacheProbe = useCallback((answer: { providers?: AiProvider[]; boot_id?: string | null } | null) => {
    if (!Array.isArray(answer?.providers) || answer.providers.length === 0) return;
    pycoreRouteRecoveryStore.write(PYCORE_HTTP_ROUTES.aiProbeProbe, PROBE_CACHE_PARAMS, {
      providers: answer.providers,
      boot_id: answer.boot_id ?? null,
    });
  }, []);

  const probeCached = useCallback(async () => {
    try {
      const answer = await pycoreApi.probeAi(false);
      if (Array.isArray(answer?.providers)) {
        mergeProviders(answer.providers);
        cacheProbe(answer);
      }
    } catch { /* keep the last probe */ }
  }, [mergeProviders, cacheProbe]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const answer = await pycoreApi.getAiCatalog();
      if (Array.isArray(answer?.providers)) {
        setProviders(mergeGatewayKeyStatus(answer.providers, gatewayRef.current));
        setError(null);
      } else {
        setProviders(null);
        setError('missing');
      }
    } catch {
      setError('unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRates = useCallback(async () => {
    try {
      const answer = (await pycoreApi.getAiRateLimits()) as AiRateLimitsResponse | null;
      const byName = new Map((answer?.providers ?? []).map((rate) => [rate.provider, rate]));
      if (byName.size === 0) return;
      setProviders((previous) => previous?.map((provider) => {
        const rate = byName.get(provider.name);
        return rate ? { ...provider, rate } : provider;
      }) ?? previous);
    } catch { /* keep the last rates */ }
  }, []);

  useEffect(() => {
    const cached = pycoreRouteRecoveryStore.read<{ providers?: AiProvider[] }>(PYCORE_HTTP_ROUTES.aiProbeProbe, PROBE_CACHE_PARAMS);
    if (Array.isArray(cached?.data?.providers) && cached.data.providers.length > 0) mergeProviders(cached.data.providers);
    void loadCatalog().then(() => probeCached());
    return pycoreEventBus.subscribe(PYCORE_BROWSER_EVENTS.httpEventServerRestarted, () => { void probeCached(); });
  }, [loadCatalog, mergeProviders, probeCached]);

  useEffect(() => {
    gatewayRef.current = aiGateway;
    setProviders((current) => (current ? mergeGatewayKeyStatus(current, aiGateway) : current));
  }, [aiGateway]);

  usePcRefreshSignal(refreshSignal, async () => {
    await loadCatalog();
    await retryCapabilityStatus();
  });

  useTopicDrivenRefresh(
    [PYCORE_EVENT_TOPICS.operationChanged],
    async () => {
      await refreshRates();
      await refreshCapabilityStatus();
    },
    { fallbackMs: PYCORE_HTTP_DEFAULTS.fallbackPollMs },
  );

  const probeLog = useCallback((provider: AiProvider): AiChatUiMessage => {
    const status = !provider.configured
      ? t('aiHub.providers.probeLog.notConfigured')
      : provider.rate_limited
        ? t('aiHub.providers.probeLog.rateLimited')
        : !provider.tested
          ? t('aiHub.providers.probeLog.notTested')
          : provider.available
            ? t('aiHub.providers.probeLog.available', { ms: Math.round(provider.latency_ms ?? 0) })
            : t('aiHub.providers.probeLog.unavailable');
    const lines = [
      `**${t('aiHub.providers.probeLog.title', { name: provider.name })}**`,
      '',
      `${t('aiHub.providers.probeLog.status')}: ${status}`,
      `${t('aiHub.providers.probeLog.models')}: ${modelsLabel(provider)}`,
    ];
    if (provider.key_masked) lines.push(`${t('aiHub.providers.probeLog.key')}: ${provider.key_masked}`);
    if (provider.limits) lines.push(`${t('aiHub.providers.probeLog.limits')}: ${provider.limits}`);
    return {
      role: 'assistant',
      content: lines.join('\n'),
      meta: { provider: provider.name, nickname: `probe/${provider.name}`, latency_ms: provider.latency_ms ?? null },
    };
  }, [t]);

  const testAll = useCallback(async () => {
    setTestingAll(true);
    try {
      const answer = await pycoreApi.probeAi(true);
      if (Array.isArray(answer?.providers)) {
        mergeProviders(answer.providers);
        appendChatMessages(CHAT_HISTORY_ID, answer.providers.map(probeLog));
        cacheProbe(answer);
      }
      setError(answer?.error ? 'probe' : null);
    } catch {
      setError('probe');
    } finally {
      setTestingAll(false);
    }
  }, [mergeProviders, cacheProbe, probeLog]);

  const resetCooldown = useCallback(async (provider: string, image: boolean, index: number) => {
    const slotKey = `${image ? 'image' : 'text'}:${index}`;
    const mark = (present: boolean) => setResetting((previous) => {
      const next = new Set(previous[provider] ?? []);
      if (present) next.add(slotKey); else next.delete(slotKey);
      return { ...previous, [provider]: next };
    });
    mark(true);
    setNotice(null);
    try {
      const answer = await pycoreApi.resetKeyCooldown({ provider, index, image });
      if (answer?.success) {
        setNotice(t('aiHub.providers.cooldownReset'));
        logSuccess(LOG_SRC, `cooldown cleared ${provider} ${slotKey}`);
        await refreshCapabilityStatus();
      } else {
        setNotice(t('aiHub.providers.cooldownResetFailed'));
        logError(LOG_SRC, `cooldown clear failed ${provider} ${slotKey}`);
      }
    } catch {
      setNotice(t('aiHub.providers.cooldownResetFailed'));
      logError(LOG_SRC, `cooldown clear failed ${provider} ${slotKey}`);
    } finally {
      mark(false);
    }
  }, [t, refreshCapabilityStatus]);

  const toggleSort = useCallback((field: Exclude<ProviderSortField, 'original'>) => {
    if (sortField === field) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  const resetSort = useCallback(() => {
    setSortField('original');
    setSortDir('asc');
  }, []);

  return {
    providers: providers ? sortProviders(providers, sortField, sortDir) : null,
    loading, error, notice, testingAll, resetting,
    sortField, sortDir, toggleSort, resetSort,
    testAll, resetCooldown, reload: loadCatalog,
  };
}
