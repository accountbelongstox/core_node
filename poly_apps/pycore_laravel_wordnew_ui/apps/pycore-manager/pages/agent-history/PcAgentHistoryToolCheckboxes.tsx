import React, { useCallback, useEffect, useRef, useState } from 'react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { AgentHistoryToolStatistics } from '@/apps/pycore-manager/api';
import { AGENT_HISTORY_TOOLS, TOOL_LABELS } from './presentation';

type TestStatus = 'idle' | 'testing' | 'ok' | 'empty' | 'fail';

/**
 * Per-tool monitor checkboxes. Checked tools are the ones "Auto process
 * history" works on (saved as config.enabled_tools). Checking a tool also
 * probes its newest history source once — green dot when a prompt extracts.
 */
const PcAgentHistoryToolCheckboxes: React.FC<{
  tk: (k: string) => string;
  enabledTools: string[];
  selectedTool: string;
  refreshRevision?: string;
  onToggle: (tool: string, checked: boolean) => void;
  onSelect: (tool: string) => void;
  onOpenToolHistory?: (tool: string, tab: 'sessions' | 'prompts') => void;
}> = ({ tk, enabledTools, selectedTool, refreshRevision, onToggle, onSelect, onOpenToolHistory }) => {
  const [status, setStatus] = useState<Record<string, TestStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statistics, setStatistics] = useState<Record<string, AgentHistoryToolStatistics>>({});
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [statisticsError, setStatisticsError] = useState('');
  const testedRef = useRef<Set<string>>(new Set());
  const statisticsRequestRef = useRef(0);

  const runTest = useCallback(async (tool: string) => {
    setStatus((s) => ({ ...s, [tool]: 'testing' }));
    try {
      const res = await pycoreApi.testAgentHistoryToolExtract(tool);
      const data = res?.data;
      if (res?.success && data?.ok) {
        setStatus((s) => ({ ...s, [tool]: data.empty ? 'empty' : 'ok' }));
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

  const loadStatistics = useCallback(async (tools: string[]) => {
    if (tools.length === 0) {
      setStatistics({});
      setStatisticsError('');
      setStatisticsLoading(false);
      return;
    }
    const requestNumber = statisticsRequestRef.current + 1;
    statisticsRequestRef.current = requestNumber;
    setStatisticsLoading(true);
    setStatisticsError('');
    try {
      const response = await pycoreApi.getAgentHistoryStatus(tools);
      if (statisticsRequestRef.current !== requestNumber) return;
      if (response.success && response.data?.tool_histories) {
        setStatistics(Object.fromEntries(
          response.data.tool_histories.map((item) => [item.tool, item]),
        ));
      } else {
        setStatistics({});
        setStatisticsError(response.error || tk('loadError'));
      }
    } catch (error) {
      if (statisticsRequestRef.current !== requestNumber) return;
      setStatistics({});
      setStatisticsError(error instanceof Error ? error.message : tk('loadError'));
    } finally {
      if (statisticsRequestRef.current === requestNumber) setStatisticsLoading(false);
    }
  }, [tk]);

  useEffect(() => {
    void loadStatistics(enabledTools);
  }, [enabledTools, loadStatistics, refreshRevision]);

  const handleToggle = (tool: string, checked: boolean) => {
    onSelect(tool);
    onToggle(tool, checked);
    if (checked) {
      testedRef.current.add(tool);
      void runTest(tool);
    } else {
      testedRef.current.delete(tool);
      setStatus((s) => ({ ...s, [tool]: 'idle' }));
    }
  };

  const handleSelect = (tool: string) => {
    onSelect(tool);
  };

  // Every stat number drills into that tool's filtered history: record /
  // session counts open the sessions tab, fragment counts (processed,
  // pending, prompts, replies) open the prompts tab.
  const openHistory = (tool: string, tab: 'sessions' | 'prompts') => {
    onSelect(tool);
    onOpenToolHistory?.(tool, tab);
  };

  const dotCls = (tool: string): string => {
    const st = status[tool] || 'idle';
    if (st === 'ok') return 'bg-emerald-500';
    if (st === 'fail') return 'bg-rose-500';
    if (st === 'testing') return 'bg-amber-400 animate-pulse';
    if (st === 'empty') return 'bg-slate-400';
    return 'bg-slate-300 dark:bg-white/20';
  };

  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-500">{tk('monitoredTools')}</div>
      <div className="flex flex-wrap gap-2">
        {AGENT_HISTORY_TOOLS.map((tool) => {
          const checked = enabledTools.includes(tool);
          const err = errors[tool];
          return (
            <div
              key={tool}
              title={err || undefined}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs select-none transition-colors ${
                selectedTool === tool ? 'ring-2 ring-indigo-500/30 ' : ''
              }${
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
                aria-label={`${tk('monitoredTools')}: ${TOOL_LABELS[tool] || tool}`}
              />
              <button
                type="button"
                onClick={() => handleSelect(tool)}
                className="inline-flex items-center gap-1.5"
              >
                <span>{TOOL_LABELS[tool] || tool}</span>
                {checked && <span className={`inline-block h-2 w-2 rounded-full ${dotCls(tool)}`} />}
              </button>
            </div>
          );
        })}
      </div>
      {statisticsError && (
        <div className="text-[11px] text-rose-500">{statisticsError}</div>
      )}
      {enabledTools.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {enabledTools.map((tool) => {
            const item = statistics[tool];
            const statBtnCls = 'rounded-lg p-2 text-left transition-colors hover:ring-2 hover:ring-indigo-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40';
            return (
              <div
                key={tool}
                className={`rounded-xl border bg-white/60 dark:bg-white/[0.02] p-3 transition-colors ${
                  selectedTool === tool
                    ? 'border-indigo-500/50 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                  <button
                    type="button"
                    onClick={() => handleSelect(tool)}
                    className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-300"
                  >
                    <span>{TOOL_LABELS[tool] || tool}</span>
                  </button>
                  {statisticsLoading && !item && <span className="text-slate-400">{tk('loading')}</span>}
                </div>
                {item && (
                  <>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => openHistory(tool, 'sessions')}
                        title={`${tk('historyRecords')} · ${TOOL_LABELS[tool] || tool}`}
                        className={`${statBtnCls} bg-slate-100 dark:bg-white/5`}
                      >
                        <div className="text-[10px] text-slate-500">{tk('historyRecords')}</div>
                        <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{item.history_records}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openHistory(tool, 'prompts')}
                        title={`${tk('processedRecords')} · ${TOOL_LABELS[tool] || tool}`}
                        className={`${statBtnCls} bg-emerald-500/10`}
                      >
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-300">{tk('processedRecords')}</div>
                        <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{item.processed}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openHistory(tool, 'prompts')}
                        title={`${tk('pendingRecords')} · ${TOOL_LABELS[tool] || tool}`}
                        className={`${statBtnCls} bg-amber-500/10`}
                      >
                        <div className="text-[10px] text-amber-700 dark:text-amber-300">{tk('pendingRecords')}</div>
                        <div className="text-lg font-semibold text-amber-700 dark:text-amber-300">{item.pending}</div>
                      </button>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-1">
                      <button type="button" onClick={() => openHistory(tool, 'sessions')} className="font-mono hover:text-indigo-600 dark:hover:text-indigo-300">
                        {item.sessions} {tk('sessionCount')}
                      </button>
                      <span>·</span>
                      <button type="button" onClick={() => openHistory(tool, 'prompts')} className="font-mono hover:text-indigo-600 dark:hover:text-indigo-300">
                        {item.prompts} {tk('promptCount')}
                      </button>
                      <span>·</span>
                      <button type="button" onClick={() => openHistory(tool, 'prompts')} className="font-mono hover:text-indigo-600 dark:hover:text-indigo-300">
                        {item.replies} {tk('replyCount')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
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
