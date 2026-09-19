import React, { useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Cpu,
  Gauge,
  History,
  TriangleAlert,
} from 'lucide-react';
import { useAgentHistoryRuntime } from '@/apps/pycore-manager/api';
import PcAiUsageRecordsPanel from '../../components/PcAiUsageRecordsPanel';
import type { AgentHistoryTaskPeriod } from '../../persistence/AgentHistoryUiStateStore';

// Usage sources the article pipeline records through chat_once (CN + EN).
const ARTICLE_USAGE_SOURCES = ['agent_history_article', 'agent_history_translate'];

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function formatLatency(value: unknown, tk: (key: string) => string): string {
  if (value === null || value === undefined || value === '') return tk('noData');
  const latency = Number(value);
  return Number.isFinite(latency) ? `${Math.round(latency)} ms` : tk('noData');
}

function formatTimestamp(value: unknown): string {
  const date = typeof value === 'number' ? new Date(value) : new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : String(value || '');
}

function failureLabel(code: unknown, tk: (key: string) => string): string {
  const keys: Record<string, string> = {
    local_rate_limit: 'failureLocalRateLimit',
    dns: 'failureDns',
    connect_timeout: 'failureConnectTimeout',
    connection: 'failureConnection',
    read_timeout: 'failureReadTimeout',
    quota: 'failureQuota',
    rate_limit: 'failureRateLimit',
    authentication: 'failureAuthentication',
    provider_unavailable: 'failureProviderUnavailable',
    empty_response: 'failureEmptyResponse',
  };
  return tk(keys[String(code || '')] || 'failureUnknown');
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
  const cooldown = asRecord(rate.cooldown);
  const [modalOpen, setModalOpen] = useState(false);

  const periodUsage = taskPeriod === 'today' ? todayUsage : historyUsage;

  const openTasks = (period: AgentHistoryTaskPeriod) => {
    onTaskPeriodChange(period);
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
            {tk('rpm')}: {minuteUsed}/{minuteLimit || 20} · {tk('quotaCountedHint')}
          </div>
        </div>

        {(cooldown.until || (Array.isArray(todayUsage.failure_breakdown) && todayUsage.failure_breakdown.length > 0)) && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-200">
            <div className="flex items-center gap-1.5 font-semibold">
              <TriangleAlert className="h-3.5 w-3.5" />
              {cooldown.until ? tk('providerCooldown') : tk('failureDiagnosis')}
            </div>
            {cooldown.until && (
              <p className="mt-1 font-mono">{String(cooldown.code || '')} · {formatTimestamp(Number(cooldown.until) * 1000)}</p>
            )}
            {Array.isArray(todayUsage.failure_breakdown) && todayUsage.failure_breakdown.slice(0, 2).map((failure: Record<string, any>) => (
              <p key={String(failure.code)} className="mt-1">
                {failureLabel(failure.code, tk)}: {Number(failure.count || 0)} · {tk('quotaCounted')}: {Number(failure.quota_counted || 0)}
              </p>
            ))}
          </div>
        )}

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
              {tk('requestAttempts')}: {Number(dashboard.today_task_total || 0)} · {tk('providerSucceeded')}: {Number(todayUsage.succeeded || 0)} · {tk('providerFailed')}: {Number(todayUsage.failed || 0)} · {tk('preDispatch')}: {Number(todayUsage.pre_dispatch_failures || 0)} · {formatLatency(todayUsage.average_latency_ms, tk)}
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
              {tk('requestAttempts')}: {Number(dashboard.task_total || 0)} · {tk('providerSucceeded')}: {Number(historyUsage.succeeded || 0)} · {tk('providerFailed')}: {Number(historyUsage.failed || 0)} · {tk('preDispatch')}: {Number(historyUsage.pre_dispatch_failures || 0)} · {formatLatency(historyUsage.average_latency_ms, tk)}
            </p>
          </button>
        </div>
      </section>

      {/* Paged request records (prompt/response detail, in-flight progress,
          day filter) — the generic panel scoped to the article pipeline's
          OpenRouter sources. */}
      <PcAiUsageRecordsPanel
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tk={tk}
        title={tk('requestAttemptList')}
        provider="openrouter"
        sources={ARTICLE_USAGE_SOURCES}
        defaultDay={taskPeriod === 'today' ? String(dashboard.day || '') : ''}
      />
    </>
  );
};

export default PcAgentHistoryAiPanel;
