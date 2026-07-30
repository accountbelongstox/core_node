/**
 * PcLlmEnginesStrip — compact Local LLM engine list for the article config panel.
 * Mirrors the TTS engines UI (PcTtsEnginesStrip) at smaller scope: one row per
 * engine with a status pill (up = available+running, down = installed but not
 * running, setup = missing), default model, priority and a live Test button.
 * Managed server engines (ollama) get a start/stop toggle. Polls status every
 * 10s while mounted. Backend falls back to OpenRouter when no engine is up.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cpu, Loader2, Power, PowerOff } from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { LlmEngine, LlmStatus } from '../../../core/api-libs/pycore';
import { PYCORE_EVENT_TOPICS } from '../../../core/api-libs/pycore/PycoreEventTopics';
import { useTopicDrivenRefresh } from '../hooks/useTopicDrivenRefresh';

const LLM_POLL_MS = 30_000;

type PillState = 'up' | 'down' | 'setup';

const pillState = (e: LlmEngine): PillState => {
  if (e.available && (!e.server_engine || !!e.server_running)) return 'up';
  if (e.installed) return 'down';
  return 'setup';
};

const PILL_CLS: Record<PillState, string> = {
  up: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  down: 'bg-slate-500/10 text-slate-400',
  setup: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
};

const PcLlmEnginesStrip: React.FC<{ tk: (k: string) => string }> = ({ tk }) => {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await pycoreApi.getLlmStatus();
      if (!mounted.current) return;
      if (res.success) {
        setStatus(res);
        setUnavailable(null);
      } else {
        setUnavailable('status unavailable');
      }
    } catch (e) {
      if (mounted.current) setUnavailable(e instanceof Error ? e.message : 'status unavailable');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, [load]);
  useTopicDrivenRefresh([PYCORE_EVENT_TOPICS.operationChanged], load, { fallbackMs: LLM_POLL_MS });

  const runTest = async (engine: string) => {
    setBusy(`test-${engine}`);
    setTestResult(null);
    try {
      const res = await pycoreApi.testLlmEngine({ engine });
      setTestResult(res.success
        ? `${res.engine} · ${res.model}${res.text ? ` — ${res.text}` : ''}`
        : `${engine}: ${res.error || 'failed'}`);
    } catch (e) {
      setTestResult(`${engine}: ${e instanceof Error ? e.message : 'failed'}`);
    } finally {
      setBusy(null);
    }
  };

  const toggleServer = async (engine: string, running: boolean) => {
    setBusy(`srv-${engine}`);
    try {
      await pycoreApi.controlLlmServer({ engine, start: !running });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const engines = status?.engines ?? [];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/40 dark:bg-white/5 p-2.5 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{tk('localLlmTitle')}</span>
        {status && (
          <span className="text-[10px] font-mono text-slate-400">
            active: {status.active || 'openrouter'}
          </span>
        )}
        {unavailable && (
          <span className="text-[10px] text-slate-400 truncate" title={unavailable}>{unavailable}</span>
        )}
      </div>
      {status && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-slate-400">
          <span>auto-start: {status.auto_manage ? 'on use' : 'off'}</span>
          <span>mode: {status.single_active ? 'one at a time' : 'parallel'}</span>
          <span>idle stop: {status.idle_shutdown_s}s</span>
        </div>
      )}
      {engines.map((e) => {
        const pill = pillState(e);
        const testBusy = busy === `test-${e.name}`;
        const srvBusy = busy === `srv-${e.name}`;
        const title = [e.note, e.disabled_reason, e.base_url].filter(Boolean).join(' — ') || e.name;
        return (
          <div key={e.name} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300" title={title}>
            <span className="font-mono font-bold w-24 truncate shrink-0">{e.name}</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${PILL_CLS[pill]}`}>
              {tk(pill)}
            </span>
            <span className="text-slate-400 truncate">{e.default_model || '—'}</span>
            <span className="font-mono text-[9px] text-slate-400 shrink-0">#{e.priority}</span>
            <span className="ml-auto flex items-center gap-1 shrink-0">
              {e.server_engine && e.installed && (
                <button
                  type="button"
                  disabled={srvBusy}
                  onClick={() => { void toggleServer(e.name, !!e.server_running); }}
                  className="p-0.5 rounded hover:bg-indigo-500/10 text-indigo-500 disabled:opacity-40"
                  title={e.server_running ? 'stop' : 'start'}>
                  {srvBusy ? <Loader2 className="w-3 h-3 animate-spin" />
                    : e.server_running ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                </button>
              )}
              <button
                type="button"
                disabled={testBusy || !e.available}
                onClick={() => { void runTest(e.name); }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium border border-slate-300 dark:border-white/10 disabled:opacity-40">
                {testBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                {tk('test')}
              </button>
            </span>
          </div>
        );
      })}
      {testResult && <p className="text-[10px] font-mono text-slate-500 break-words">{testResult}</p>}
      <p className="text-[10px] text-slate-400">{tk('localLlmFallbackHint')}</p>
    </div>
  );
};

export default PcLlmEnginesStrip;
