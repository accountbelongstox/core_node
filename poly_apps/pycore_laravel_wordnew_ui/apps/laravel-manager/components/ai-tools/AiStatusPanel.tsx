/**
 * AiStatusPanel — provider availability + live AI test, for the AI Tools panel.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, RefreshCcw, CheckCircle2, AlertTriangle, MinusCircle,
  Timer, KeyRound, BrainCircuit, Send, ArrowRight,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { useTranslation } from '@/apps/laravel-manager/i18n';
import type {
  AiProviderStatus, AiStatusResponse, AiTestResult,
} from '@/apps/laravel-manager/api';
import ToolWrapper from '@/shared/ui/ToolWrapper';
import { commonClasses } from '@/shared/styles/theme';
import { AI_BODY, AI_GRID_2, AiBentoCard, AiToolAlert } from '@/shared/ui/AiToolUi';

type Availability = 'available' | 'unavailable' | 'unconfigured';

function availabilityOf(p: AiProviderStatus): Availability {
  if (!p.configured) return 'unconfigured';
  return p.available ? 'available' : 'unavailable';
}

const BADGE: Record<Availability, { cls: string; Icon: React.FC<{ className?: string }>; label: string }> = {
  available: { cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', Icon: CheckCircle2, label: 'uiAi.status.badge.available' },
  unavailable: { cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', Icon: AlertTriangle, label: 'uiAi.status.badge.unavailable' },
  unconfigured: { cls: 'bg-slate-500/15 text-slate-500 dark:text-slate-400', Icon: MinusCircle, label: 'uiAi.status.badge.unconfigured' },
};

const DEFAULT_PROMPT = 'Reply with the single word: ok';

const selectCls =
  `${commonClasses.input} !py-2 text-xs font-mono disabled:opacity-50`;

const AiStatusPanel: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AiStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chosenModel, setChosenModel] = useState<Record<string, string>>({});

  const [testProvider, setTestProvider] = useState<string>('');
  const [testModel, setTestModel] = useState<string>('');
  const [testPrompt, setTestPrompt] = useState<string>(DEFAULT_PROMPT);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const providers = status?.providers ?? [];
  const configuredProviders = providers.filter((p) => p.configured);

  const seedSelections = useCallback((snap: AiStatusResponse) => {
    setChosenModel((prev) => {
      const next = { ...prev };
      for (const p of snap.providers) {
        if (!next[p.name] && p.models && p.models.length > 0) next[p.name] = p.models[0];
      }
      return next;
    });
    setTestProvider((prev) => {
      if (prev && snap.providers.some((p) => p.name === prev)) return prev;
      const first = snap.providers.find((p) => p.configured) ?? snap.providers[0];
      return first?.name ?? '';
    });
  }, []);

  const load = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.aiStatus.getAiStatus(refresh);
      if (res.success && res.data) {
        setStatus(res.data);
        setError(null);
        seedSelections(res.data);
      } else {
        setError(res.error || t('uiAi.status.unavailable'));
      }
    } catch (e: any) {
      setError(e?.message || t('uiAi.status.unreachable'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seedSelections, t]);

  useEffect(() => { load(false); }, [load]);

  useEffect(() => {
    if (!testProvider) return;
    const p = providers.find((x) => x.name === testProvider);
    if (!p) return;
    const preferred = chosenModel[testProvider] || (p.models?.[0] ?? '');
    setTestModel((prev) => {
      if (prev && p.models?.includes(prev)) return prev;
      return preferred;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testProvider, status]);

  const runTest = useCallback(async () => {
    if (!testProvider) return;
    setTesting(true);
    setTestError(null);
    try {
      const res = await api.aiStatus.testAi({
        provider: testProvider,
        model: testModel || undefined,
        prompt: (testPrompt || '').trim() || DEFAULT_PROMPT,
      });
      if (res.success && res.data) {
        setTestResult(res.data);
        if (res.data.success === false) {
          setTestError(res.data.error || t('uiAi.status.model_failure'));
        }
      } else {
        const inner = (res.data as AiTestResult | null)?.error;
        setTestResult((res.data as AiTestResult) ?? null);
        setTestError(inner || res.error || t('uiAi.status.test_failed'));
      }
    } catch (e: any) {
      setTestError(e?.message || t('uiAi.status.test_request_failed'));
    } finally {
      setTesting(false);
    }
  }, [testProvider, testModel, testPrompt, t]);

  const selectedTestProvider = providers.find((p) => p.name === testProvider);

  const badge = (p: AiProviderStatus) => {
    const meta = BADGE[availabilityOf(p)];
    const { Icon } = meta;
    return (
      <span
        className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${meta.cls}`}
        title={p.error || undefined}
      >
        <Icon className="w-3 h-3" /> {t(meta.label)}
      </span>
    );
  };

  return (
    <ToolWrapper
      title={t('uiAi.status.title')}
      icon={Activity}
      gradient="indigo"
      description={t('uiAi.status.description')}
      actions={
        <>
          {status && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 hidden sm:inline">
              {t(status.cached ? 'uiAi.status.cached_meta' : 'uiAi.status.live_meta', { ms: Math.round(status.age_ms) })}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {t('uiAi.status.refresh')}
          </button>
        </>
      }
    >
      <div className={AI_BODY}>
        {error && (
          <AiToolAlert variant="warning">
            <span className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </span>
          </AiToolAlert>
        )}

        {status && status.fallback_chain?.length > 0 && (
          <AiBentoCard title={t('uiAi.status.fallback_chain')}>
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              {status.fallback_chain.map((name, i) => (
                <React.Fragment key={`${name}-${i}`}>
                  {i > 0 && <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />}
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono
                    bg-slate-900/[0.04] dark:bg-white/[0.05] text-slate-600 dark:text-slate-300
                    border border-slate-200/70 dark:border-white/5">
                    <span className="text-slate-400 dark:text-slate-500">{i + 1}</span>{name}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </AiBentoCard>
        )}

        {loading && providers.length === 0 ? (
          <div className="text-xs text-slate-500 py-10 text-center flex flex-col items-center gap-2">
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" /> {t('uiAi.status.probing')}
          </div>
        ) : providers.length === 0 ? (
          <AiBentoCard>
            <p className="text-xs text-slate-500 text-center py-6">{t('uiAi.status.no_providers')}</p>
          </AiBentoCard>
        ) : (
          <div className={AI_GRID_2}>
            {providers.map((p) => (
              <AiBentoCard key={p.name}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{p.name}</span>
                    {badge(p)}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                    <span className="inline-flex items-center gap-1" title={t('uiAi.status.key_masked_title')}>
                      <KeyRound className="w-3 h-3" /><span className="font-mono">{p.key_masked || '-'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1" title={t('uiAi.status.models_available_title')}>
                      <BrainCircuit className="w-3 h-3" /><span className="font-mono">{p.models?.length ?? 0}</span>
                    </span>
                    <span className="inline-flex items-center gap-1" title={t('uiAi.status.probe_latency_title')}>
                      <Timer className="w-3 h-3" />
                      <span className="font-mono">{p.latency_ms != null ? `${Math.round(p.latency_ms)} ms` : '-'}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
                      {t('uiAi.status.model')}
                    </span>
                    <select
                      value={chosenModel[p.name] ?? ''}
                      disabled={!p.models || p.models.length === 0}
                      onChange={(e) => setChosenModel((m) => ({ ...m, [p.name]: e.target.value }))}
                      className={`${selectCls} flex-1 min-w-0`}
                      title={t('uiAi.status.switch_model_title')}
                    >
                      {(!p.models || p.models.length === 0) && <option value="">{t('uiAi.status.no_models')}</option>}
                      {(p.models ?? []).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </AiBentoCard>
            ))}
          </div>
        )}

        <AiBentoCard title={t('uiAi.status.realtime_test')}>
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('uiAi.status.realtime_intro')}
            </p>

            <div className={AI_GRID_2}>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('uiAi.status.provider')}</span>
                <select
                  value={testProvider}
                  onChange={(e) => setTestProvider(e.target.value)}
                  className={selectCls}
                  disabled={configuredProviders.length === 0}
                >
                  {configuredProviders.length === 0 && <option value="">{t('uiAi.status.no_configured_providers')}</option>}
                  {configuredProviders.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('uiAi.status.model')}</span>
                <select
                  value={testModel}
                  onChange={(e) => setTestModel(e.target.value)}
                  className={selectCls}
                  disabled={!selectedTestProvider || (selectedTestProvider.models?.length ?? 0) === 0}
                >
                  {(!selectedTestProvider || (selectedTestProvider.models?.length ?? 0) === 0) && (
                    <option value="">{t('uiAi.status.default_model')}</option>
                  )}
                  {(selectedTestProvider?.models ?? []).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('uiAi.status.prompt')}</span>
              <textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                rows={2}
                placeholder={DEFAULT_PROMPT}
                className={`${commonClasses.input} text-xs resize-y`}
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={runTest}
                disabled={testing || !testProvider}
                className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
              >
                {testing ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {testing ? t('uiAi.status.testing') : t('uiAi.status.test')}
              </button>
              {testResult && !testError && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    testResult.success ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  }`}>
                    {testResult.success ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {testResult.success ? t('uiAi.status.result_ok') : t('uiAi.status.result_fail')}
                  </span>
                  {testResult.latency_ms != null && <span><Timer className="inline w-3 h-3 mr-0.5" />{Math.round(testResult.latency_ms)} ms</span>}
                  {testResult.model && <span className="opacity-70">{testResult.model}</span>}
                </span>
              )}
            </div>

            {testError && (
              <AiToolAlert>
                <span className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="break-words">{testError}</span>
                </span>
              </AiToolAlert>
            )}

            {testResult && testResult.response && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">{t('uiAi.status.response')}</div>
                <pre className="whitespace-pre-wrap break-words text-xs font-mono rounded-xl p-3 border
                  bg-slate-900/[0.03] dark:bg-white/[0.03] border-slate-200/70 dark:border-white/5 text-slate-700 dark:text-slate-200">
{testResult.response}
                </pre>
              </div>
            )}
          </div>
        </AiBentoCard>
      </div>
    </ToolWrapper>
  );
};

export default AiStatusPanel;
