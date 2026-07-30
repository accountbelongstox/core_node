import React, { useCallback, useEffect, useRef, useState } from 'react';
import { pycoreApi } from '../../../../core/api-libs/pycore/PycoreApi';
import { TOOL_LABELS } from '../../../../components/views/dev-history/shared';

/** Checkbox order mirrors pycore agent_history_pipeline.config.SUPPORTED_TOOLS. */
const TOOL_ORDER = [
  'agent', 'claude', 'codex', 'cursor', 'gemini',
  'kimi', 'antigravity', 'cline', 'ark-cli',
];

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

/**
 * Per-tool monitor checkboxes. Checked tools are the ones "Auto process
 * history" works on (saved as config.enabled_tools). Checking a tool also
 * probes its newest history source once — green dot when a prompt extracts.
 */
const PcAgentHistoryToolCheckboxes: React.FC<{
  tk: (k: string) => string;
  enabledTools: string[];
  onToggle: (tool: string, checked: boolean) => void;
}> = ({ tk, enabledTools, onToggle }) => {
  const [status, setStatus] = useState<Record<string, TestStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const testedRef = useRef<Set<string>>(new Set());

  const runTest = useCallback(async (tool: string) => {
    setStatus((s) => ({ ...s, [tool]: 'testing' }));
    try {
      const res = await pycoreApi.testAgentHistoryToolExtract(tool);
      const data = res?.data;
      if (res?.success && data?.ok) {
        setStatus((s) => ({ ...s, [tool]: 'ok' }));
        setErrors((e) => ({ ...e, [tool]: '' }));
      } else {
        setStatus((s) => ({ ...s, [tool]: 'fail' }));
        setErrors((e) => ({ ...e, [tool]: String(data?.error || res?.error || 'extract failed') }));
      }
    } catch (err) {
      setStatus((s) => ({ ...s, [tool]: 'fail' }));
      setErrors((e) => ({ ...e, [tool]: err instanceof Error ? err.message : String(err) }));
    }
  }, []);

  // Probe tools that are already checked (page load / config refresh), once each.
  useEffect(() => {
    let cancelled = false;
    const probeEnabledTools = async () => {
      for (const tool of enabledTools) {
        if (cancelled) return;
        if (testedRef.current.has(tool)) continue;
        testedRef.current.add(tool);
        await runTest(tool);
      }
    };
    void probeEnabledTools();
    return () => { cancelled = true; };
  }, [enabledTools, runTest]);

  const handleToggle = (tool: string, checked: boolean) => {
    onToggle(tool, checked);
    if (checked) {
      testedRef.current.add(tool);
      void runTest(tool);
    } else {
      testedRef.current.delete(tool);
      setStatus((s) => ({ ...s, [tool]: 'idle' }));
    }
  };

  const dotCls = (tool: string): string => {
    const st = status[tool] || 'idle';
    if (st === 'ok') return 'bg-emerald-500';
    if (st === 'fail') return 'bg-rose-500';
    if (st === 'testing') return 'bg-amber-400 animate-pulse';
    return 'bg-slate-300 dark:bg-white/20';
  };

  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-500">{tk('monitoredTools')}</div>
      <div className="flex flex-wrap gap-2">
        {TOOL_ORDER.map((tool) => {
          const checked = enabledTools.includes(tool);
          const err = errors[tool];
          return (
            <label
              key={tool}
              title={err || undefined}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                checked
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-slate-800 dark:text-slate-100'
                  : 'border-slate-200 dark:border-white/10 text-slate-500'
              }`}
            >
              <input
                type="checkbox"
                className="accent-indigo-600"
                checked={checked}
                onChange={(e) => handleToggle(tool, e.target.checked)}
              />
              <span>{TOOL_LABELS[tool] || tool}</span>
              {checked && <span className={`inline-block h-2 w-2 rounded-full ${dotCls(tool)}`} />}
            </label>
          );
        })}
      </div>
      {Object.entries(errors).map(([tool, err]) =>
        err && status[tool] === 'fail' ? (
          <div key={tool} className="text-[11px] text-rose-500">
            {TOOL_LABELS[tool] || tool}: {err}
          </div>
        ) : null,
      )}
    </div>
  );
};

export default PcAgentHistoryToolCheckboxes;
