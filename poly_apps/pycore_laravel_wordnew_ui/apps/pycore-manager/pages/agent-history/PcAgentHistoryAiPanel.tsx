import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Cpu,
  Gauge,
  History,
  X,
} from 'lucide-react';
import { useAgentHistoryRuntime } from '@/apps/pycore-manager/api';
import type { AgentHistoryTaskPeriod } from '../../persistence/AgentHistoryUiStateStore';

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function formatLatency(value: unknown, tk: (key: string) => string): string {
  if (value === null || value === undefined || value === '') return tk('noData');
  const latency = Number(value);
  return Number.isFinite(latency) ? `${Math.round(latency)} ms` : tk('noData');
}

function formatTimestamp(value: unknown): string {
  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : String(value || '');
}

function statusClass(status: string): string {
  if (status === 'completed') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  if (status === 'failed') return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300';
  if (status === 'running') return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300';
  return 'border-slate-300 dark:border-white/10 text-slate-500';
}

function taskKey(task: Record<string, any>): string {
  return [task.ts, task.source, task.model, task.runtime].map((value) => String(value || '')).join(':');
}

const PcAgentHistoryAiPanel: React.FC<{
  tk: (key: string) => string;
  taskPeriod: AgentHistoryTaskPeriod;
  onTaskPeriodChange: (period: AgentHistoryTaskPeriod) => void;
}> = ({ tk, taskPeriod, onTaskPeriodChange }) => {
  const { aiDashboard } = useAgentHistoryRuntime();
  const dashboard = asRecord(aiDashboard);
  const rate = asRecord(dashboard.rate);
  const limits = asRecord(rate.limits);
  const rateUsage = asRecord(rate.usage);
  const usage = asRecord(dashboard.usage);
  const todayUsage = asRecord(usage.today);
  const historyUsage = asRecord(usage.history);
  const dayUsed = Math.max(0, Number(rateUsage.day || 0));
  const dayLimit = Math.max(0, Number(limits.rpd || 0));
  const minuteUsed = Math.max(0, Number(rateUsage.minute || 0));
  const minuteLimit = Math.max(0, Number(limits.rpm || 0));
  const quotaPercent = dayLimit > 0 ? Math.min(100, Math.round((dayUsed / dayLimit) * 100)) : 0;
  const quotaPaused = dayLimit > 0 && dayUsed >= dayLimit;
  const tasks = Array.isArray(dashboard.tasks) ? dashboard.tasks : [];
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTaskKey, setSelectedTaskKey] = useState('');

  const visibleTasks = useMemo(() => {
    if (taskPeriod === 'history') return tasks;
    const day = String(dashboard.day || '');
    return tasks.filter((task) => String(task.iso || '').startsWith(day));
  }, [dashboard.day, taskPeriod, tasks]);
  const periodTotal = taskPeriod === 'today'
    ? Number(dashboard.today_task_total || 0)
    : Number(dashboard.task_total || 0);
  const selectedTask = visibleTasks.find((task) => taskKey(task) === selectedTaskKey) || null;

  const openTasks = (period: AgentHistoryTaskPeriod) => {
    onTaskPeriodChange(period);
    setSelectedTaskKey('');
    setModalOpen(true);
  };

  return (
    <>
      <section className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-black/10 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" />
            <div>
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">{tk('aiUsageTitle')}</h3>
              <p className="text-[11px] text-slate-500">
                OpenRouter · {String(dashboard.model || 'openrouter/free')}
              </p>
            </div>
          </div>
          <span className={`text-[11px] font-mono ${quotaPaused ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-300'}`}>
            {quotaPaused ? tk('quotaPaused') : tk('ok')}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span className="inline-flex items-center gap-1"><Gauge className="w-3 h-3" />{tk('dailyQuota')}</span>
            <span>{dayUsed}/{dayLimit || 1000} · {Math.max(0, (dayLimit || 1000) - dayUsed)} {tk('remaining')}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full ${quotaPaused ? 'bg-rose-500' : 'bg-indigo-500'}`}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            {tk('rpm')}: {minuteUsed}/{minuteLimit || 20}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => openTasks('today')}
            className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 text-left hover:border-indigo-500/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />{tk('todayLoad')}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
              {Number(todayUsage.requests || 0)} <span className="text-[11px] font-normal text-slate-500">{tk('requests')}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {tk('tasks')}: {Number(dashboard.today_task_total || 0)} · {tk('succeeded')}: {Number(todayUsage.succeeded || 0)} · {tk('failed')}: {Number(todayUsage.failed || 0)} · {formatLatency(todayUsage.average_latency_ms, tk)}
            </p>
          </button>
          <button
            type="button"
            onClick={() => openTasks('history')}
            className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] p-3 text-left hover:border-indigo-500/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <History className="w-3.5 h-3.5 text-slate-500" />{tk('historyLoad')}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
              {Number(historyUsage.requests || 0)} <span className="text-[11px] font-normal text-slate-500">{tk('recordedRequests')}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {tk('tasks')}: {Number(dashboard.task_total || 0)} · {tk('succeeded')}: {Number(historyUsage.succeeded || 0)} · {tk('failed')}: {Number(historyUsage.failed || 0)} · {formatLatency(historyUsage.average_latency_ms, tk)}
            </p>
          </button>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5" onMouseDown={() => setModalOpen(false)}>
          <div className="w-full max-w-6xl max-h-[88vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{tk('processingTasks')}</h3>
                <p className="text-[11px] text-slate-500">{taskPeriod === 'today' ? tk('todayLoad') : tk('historyLoad')} · {tk('shown')}: {visibleTasks.length}/{periodTotal}</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} aria-label={tk('close')} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="grid min-h-[420px] max-h-[calc(88vh-62px)] grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="overflow-y-auto border-b md:border-b-0 md:border-r border-slate-200 dark:border-white/10 p-3 space-y-2">
                {visibleTasks.length === 0 && <p className="p-3 text-xs text-slate-500">{tk('tasksEmpty')}</p>}
                {visibleTasks.map((task) => {
                  const key = taskKey(task);
                  const status = task.success ? 'completed' : 'failed';
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setSelectedTaskKey(key)}
                      className={`w-full rounded-lg border p-2.5 text-left transition-colors ${selectedTaskKey === key ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-200 dark:border-white/10 hover:border-indigo-500/40'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">{String(task.source || '') === 'agent_history_translate' ? tk('englishTask') : tk('chineseTask')}</span>
                        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] ${statusClass(status)}`}>{task.success ? tk('succeeded') : tk('failed')}</span>
                      </div>
                      <p className="mt-1 text-[10px] font-mono text-slate-500">{formatTimestamp(task.iso)}</p>
                      <p className="mt-1 truncate text-[10px] text-slate-400">{String(task.model || dashboard.model || '')} · {formatLatency(task.latency_ms, tk)}</p>
                    </button>
                  );
                })}
              </aside>

              <main className="overflow-y-auto p-4">
                {!selectedTask && <div className="flex h-full items-center justify-center text-xs text-slate-500">{tk('pickTask')}</div>}
                {selectedTask && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-100 dark:bg-white/5 p-2"><span className="block text-[10px] text-slate-500">{tk('requestType')}</span>{String(selectedTask.source || '') === 'agent_history_translate' ? tk('englishTask') : tk('chineseTask')}</div>
                      <div className="rounded-lg bg-slate-100 dark:bg-white/5 p-2"><span className="block text-[10px] text-slate-500">{tk('taskStatus')}</span>{selectedTask.success ? tk('succeeded') : tk('failed')}</div>
                      <div className="rounded-lg bg-slate-100 dark:bg-white/5 p-2"><span className="block text-[10px] text-slate-500">{tk('latency')}</span>{formatLatency(selectedTask.latency_ms, tk)}</div>
                      <div className="rounded-lg bg-slate-100 dark:bg-white/5 p-2"><span className="block text-[10px] text-slate-500">{tk('updated')}</span>{formatTimestamp(selectedTask.iso)}</div>
                    </div>

                    <section>
                      <h4 className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">{tk('taskDetail')}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-slate-200 dark:border-white/10 p-3"><span className="block text-[10px] text-slate-500">{tk('provider')}</span>{String(selectedTask.provider || 'openrouter')}</div>
                        <div className="rounded-lg border border-slate-200 dark:border-white/10 p-3"><span className="block text-[10px] text-slate-500">{tk('model')}</span><span className="break-all font-mono">{String(selectedTask.model || dashboard.model || '')}</span></div>
                        <div className="rounded-lg border border-slate-200 dark:border-white/10 p-3"><span className="block text-[10px] text-slate-500">{tk('runtime')}</span>{String(selectedTask.runtime || '')}</div>
                        <div className="rounded-lg border border-slate-200 dark:border-white/10 p-3"><span className="block text-[10px] text-slate-500">{tk('requestSource')}</span><span className="break-all font-mono">{String(selectedTask.source || '')}</span></div>
                      </div>
                    </section>
                    {selectedTask.error && (
                      <section>
                        <h4 className="mb-2 text-xs font-semibold text-rose-600 dark:text-rose-300">{tk('taskError')}</h4>
                        <pre className="whitespace-pre-wrap break-all rounded-lg bg-rose-500/10 p-3 text-[11px] text-rose-600 dark:text-rose-300">{String(selectedTask.error)}</pre>
                      </section>
                    )}
                  </div>
                )}
              </main>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PcAgentHistoryAiPanel;
