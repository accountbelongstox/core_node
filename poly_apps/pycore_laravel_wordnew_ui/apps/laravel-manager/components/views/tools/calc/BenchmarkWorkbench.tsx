/** In-browser performance benchmark: real micro-benchmarks timed with performance.now and shown as ops/s bars. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Square, Zap } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { BENCH_TASKS, measureTask, type BenchOutcome } from './benchmarkTasks';
import { Bench, Btn, Card, Lcd, MUTED_TEXT, Seg, Stat, prefillInput, useAccent, useRecordUse } from './calcKit';

type Status = 'idle' | 'queued' | 'running' | 'done';

const BUDGETS = [250, 500, 1000] as const;
const DEFAULT_BUDGET = 500;

const compact = (n: number, locale: string): string => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: n < 100 ? 1 : 0 }).format(n);

const BenchmarkWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { budget: DEFAULT_BUDGET }), [lastRun]);
  const [budget, setBudget] = useState<number>(BUDGETS.includes(initial.budget as typeof BUDGETS[number]) ? initial.budget : DEFAULT_BUDGET);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(BENCH_TASKS.map((task) => task.key)));
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [results, setResults] = useState<Record<string, BenchOutcome>>({});
  const [running, setRunning] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => () => { cancelled.current = true; }, []);

  const toggle = (key: string): void => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  const start = async (): Promise<void> => {
    const queue = BENCH_TASKS.filter((task) => selected.has(task.key));
    if (!queue.length || running) return;
    cancelled.current = false;
    setRunning(true);
    setResults({});
    setStatus(Object.fromEntries(queue.map((task) => [task.key, 'queued' as Status])));
    const collected: Record<string, BenchOutcome> = {};
    for (const task of queue) {
      if (cancelled.current) break;
      setStatus((prev) => ({ ...prev, [task.key]: 'running' }));
      try {
        const outcome = await measureTask(task, budget, () => cancelled.current);
        if (!outcome) break;
        collected[task.key] = outcome;
        setResults((prev) => ({ ...prev, [task.key]: outcome }));
        setStatus((prev) => ({ ...prev, [task.key]: 'done' }));
      } catch {
        setStatus((prev) => ({ ...prev, [task.key]: 'idle' }));
      }
    }
    if (!cancelled.current && Object.keys(collected).length) {
      record({ budget }, Object.fromEntries(Object.entries(collected).map(([key, r]) => [key, Math.round(r.opsPerSecond)])));
    }
    setRunning(false);
  };

  const stop = (): void => { cancelled.current = true; };

  const completed = Object.values(results);
  const maxLog = Math.max(1, ...completed.map((r) => Math.log10(r.opsPerSecond + 1)));
  const index = completed.length ? Math.exp(completed.reduce((sum, r) => sum + Math.log(r.opsPerSecond), 0) / completed.length) : 0;
  const doneCount = Object.values(status).filter((s) => s === 'done').length;
  const queuedCount = Object.keys(status).length;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 0;

  return (
    <Bench accent="math">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Lcd className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider opacity-60">{t('toolsCalc.benchmark.index')}</p>
          <p className="text-5xl font-bold sm:text-6xl">{completed.length ? compact(index, i18n.language) : '—'}</p>
          <p className="text-xs opacity-70">{running ? t('toolsCalc.benchmark.running', { done: doneCount, total: queuedCount }) : t('toolsCalc.benchmark.index_hint')}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className={`h-full ${a.bar} transition-[width] duration-300`} style={{ width: queuedCount ? `${(doneCount / queuedCount) * 100}%` : '0%' }} />
          </div>
        </Lcd>
        <Card title={t('toolsCalc.benchmark.setup')} icon={<Zap className="h-3.5 w-3.5" />}>
          <div className="space-y-3">
            <div>
              <p className={`mb-1 text-[11px] font-bold uppercase tracking-wider ${MUTED_TEXT}`}>{t('toolsCalc.benchmark.budget')}</p>
              <Seg value={budget} onChange={setBudget} ariaLabel={t('toolsCalc.benchmark.budget')} options={BUDGETS.map((b) => ({ value: b, label: b >= 1000 ? `${b / 1000} s` : `${b} ms` }))} />
            </div>
            <div className="flex flex-wrap gap-2">
              {running
                ? <Btn onClick={stop} icon={<Square className="h-3.5 w-3.5" />}>{t('toolsCalc.benchmark.stop')}</Btn>
                : <Btn onClick={() => { void start(); }} disabled={selected.size === 0} icon={<Play className="h-3.5 w-3.5" />}>{t('toolsCalc.benchmark.run')}</Btn>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={t('toolsCalc.benchmark.cores')} value={cores || '—'} />
              <Stat label={t('toolsCalc.benchmark.tasks')} value={`${selected.size}/${BENCH_TASKS.length}`} />
            </div>
          </div>
        </Card>
      </div>

      <Card title={t('toolsCalc.benchmark.results')} aside={<span className={`text-[11px] ${MUTED_TEXT}`}>{t('toolsCalc.benchmark.log_scale')}</span>}>
        <ul className="space-y-2">
          {BENCH_TASKS.map((task) => {
            const result = results[task.key];
            const state = status[task.key] ?? 'idle';
            const width = result ? (Math.log10(result.opsPerSecond + 1) / maxLog) * 100 : 0;
            return (
              <li key={task.key} className={`rounded-xl border px-3 py-2 transition ${state === 'running' ? `${a.border} ${a.tint}` : 'border-slate-200 dark:border-slate-800'} ${selected.has(task.key) ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={selected.has(task.key)} disabled={running} onChange={() => toggle(task.key)} aria-label={t(`toolsCalc.benchmark.task.${task.key}.name`)} className={`h-4 w-4 cursor-pointer ${a.range}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{t(`toolsCalc.benchmark.task.${task.key}.name`)}</p>
                    <p className={`truncate text-[11px] ${MUTED_TEXT}`}>{t(`toolsCalc.benchmark.task.${task.key}.description`)}</p>
                  </div>
                  <div className="shrink-0 text-right font-mono">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{result ? `${compact(result.opsPerSecond, i18n.language)} ${t('toolsCalc.benchmark.ops')}` : state === 'running' ? '…' : state === 'queued' ? t('toolsCalc.benchmark.queued') : '—'}</p>
                    {result && <p className={`text-[10px] ${MUTED_TEXT}`}>{result.avgMs < 1 ? `${(result.avgMs * 1000).toFixed(1)} µs` : `${result.avgMs.toFixed(2)} ms`}</p>}
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className={`h-full rounded-full ${a.bar} transition-[width] duration-500 ${state === 'running' ? 'animate-pulse' : ''}`} style={{ width: state === 'running' ? '100%' : `${width}%`, opacity: state === 'running' ? 0.35 : 1 }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </Bench>
  );
};

export default BenchmarkWorkbench;
