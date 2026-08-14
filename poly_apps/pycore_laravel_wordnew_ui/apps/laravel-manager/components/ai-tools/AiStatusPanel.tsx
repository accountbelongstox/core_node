/**
 * AiStatusPanel — provider availability + live AI test, for the AI Tools panel.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, RefreshCcw, CheckCircle2, AlertTriangle, MinusCircle,
  Timer, KeyRound, BrainCircuit, Send, ArrowRight,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
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
  available: { cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', Icon: CheckCircle2, label: 'Available' },
  unavailable: { cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', Icon: AlertTriangle, label: 'Unavailable' },
  unconfigured: { cls: 'bg-slate-500/15 text-slate-500 dark:text-slate-400', Icon: MinusCircle, label: 'Not configured' },
};

const DEFAULT_PROMPT = 'Reply with the single word: ok';

const selectCls =
  `${commonClasses.input} !py-2 text-xs font-mono disabled:opacity-50`;

const AiStatusPanel: React.FC = () => {
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
        setError(res.error || 'AI status unavailable.');
      }
    } catch (e: any) {
      setError(e?.message || 'AI status backend unreachable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seedSelections]);

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
          setTestError(res.data.error || 'The model reported a failure.');
        }
      } else {
        const inner = (res.data as AiTestResult | null)?.error;
        setTestResult((res.data as AiTestResult) ?? null);
        setTestError(inner || res.error || 'AI test failed.');
      }
    } catch (e: any) {
      setTestError(e?.message || 'AI test request failed.');
    } finally {
      setTesting(false);
    }
  }, [testProvider, testModel, testPrompt]);

  const selectedTestProvider = providers.find((p) => p.name === testProvider);

  const badge = (p: AiProviderStatus) => {
    const meta = BADGE[availabilityOf(p)];
    const { Icon } = meta;
    return (
      <span
        className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${meta.cls}`}
        title={p.error || undefined}
      >
        <Icon className="w-3 h-3" /> {meta.label}
      </span>
    );
  };

  return (
    <ToolWrapper
      title="AI Status"
      icon={Activity}
      gradient="indigo"
      description="Providers, keys, models & live test"
      actions={
        <>
          {status && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 hidden sm:inline">
              {status.cached ? 'cached' : 'live'} · {Math.round(status.age_ms)}ms old
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
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
          <AiBentoCard title="Fallback Chain">
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
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" /> Probing providers…
          </div>
        ) : providers.length === 0 ? (
          <AiBentoCard>
            <p className="text-xs text-slate-500 text-center py-6">No AI providers reported.</p>
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
                    <span className="inline-flex items-center gap-1" title="API key (masked)">
                      <KeyRound className="w-3 h-3" /><span className="font-mono">{p.key_masked || '-'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1" title="Models available">
                      <BrainCircuit className="w-3 h-3" /><span className="font-mono">{p.models?.length ?? 0}</span>
                    </span>
                    <span className="inline-flex items-center gap-1" title="Probe latency">
                      <Timer className="w-3 h-3" />
                      <span className="font-mono">{p.latency_ms != null ? `${Math.round(p.latency_ms)} ms` : '-'}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
                      Model
                    </span>
                    <select
                      value={chosenModel[p.name] ?? ''}
                      disabled={!p.models || p.models.length === 0}
                      onChange={(e) => setChosenModel((m) => ({ ...m, [p.name]: e.target.value }))}
                      className={`${selectCls} flex-1 min-w-0`}
                      title="Switch model / version"
                    >
                      {(!p.models || p.models.length === 0) && <option value="">no models</option>}
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

        <AiBentoCard title="Real-time Test">
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Send a prompt to a provider/model and see the live response, latency, and ok/fail.
            </p>

            <div className={AI_GRID_2}>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Provider</span>
                <select
                  value={testProvider}
                  onChange={(e) => setTestProvider(e.target.value)}
                  className={selectCls}
                  disabled={configuredProviders.length === 0}
                >
                  {configuredProviders.length === 0 && <option value="">no configured providers</option>}
                  {configuredProviders.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Model</span>
                <select
                  value={testModel}
                  onChange={(e) => setTestModel(e.target.value)}
                  className={selectCls}
                  disabled={!selectedTestProvider || (selectedTestProvider.models?.length ?? 0) === 0}
                >
                  {(!selectedTestProvider || (selectedTestProvider.models?.length ?? 0) === 0) && (
                    <option value="">default</option>
                  )}
                  {(selectedTestProvider?.models ?? []).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Prompt</span>
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
                {testing ? 'Testing…' : 'Test'}
              </button>
              {testResult && !testError && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    testResult.success ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  }`}>
                    {testResult.success ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {testResult.success ? 'ok' : 'fail'}
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
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">Response</div>
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
