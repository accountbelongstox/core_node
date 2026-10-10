/** Top-bar CPU / memory / GPU / battery bars of the machine selected in the terminal node tabs, polled every 2 s. */
import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PYCORE_HTTP_ROUTES } from '@/apps/pycore-manager/api';
import type { SystemResources } from '@/apps/pycore-manager/api';
import { useIsMobile } from '../hooks/useIsMobile';
import { useSelectedPycoreNode, type SelectedPycoreNode } from '../hooks/useSelectedPycoreNode';

const POLL_INTERVAL_MS = 2000;
const REQUEST_CEILING_MS = 10_000;
const PERCENT_MAX = 100;
const MB_PER_GB = 1024;
/** Load curves keep the last 20 minutes, in memory only (gone on reload). */
const HISTORY_WINDOW_MS = 20 * 60 * 1000;
const SPARK_WIDTH = 200;
const SPARK_HEIGHT = 32;

// One colour per resource (not per load level), so the three bars are told apart at a glance.
const RESOURCE_COLORS: Record<'cpu' | 'mem' | 'gpu' | 'battery', { bar: string; text: string }> = {
  cpu: { bar: 'bg-sky-500', text: 'text-sky-500' },
  mem: { bar: 'bg-violet-500', text: 'text-violet-500' },
  gpu: { bar: 'bg-amber-500', text: 'text-amber-500' },
  battery: { bar: 'bg-emerald-500', text: 'text-emerald-500' },
};

interface ResourceBar {
  key: string;
  kind: keyof typeof RESOURCE_COLORS;
  label: string;
  detail: string;
  percent: number;
}

interface HistoryPoint {
  at: number;
  percent: number;
}

/** Module-level so the curves survive the panel closing and the top bar re-mounting; keyed per machine. */
const loadHistory = new Map<string, HistoryPoint[]>();

function historyKey(nodeKey: string, barKey: string): string {
  return `${nodeKey}:${barKey}`;
}

function recordHistory(nodeKey: string, bars: ResourceBar[], at: number): void {
  const cutoff = at - HISTORY_WINDOW_MS;
  for (const bar of bars) {
    const key = historyKey(nodeKey, bar.key);
    const points = (loadHistory.get(key) ?? []).filter((point) => point.at >= cutoff);
    points.push({ at, percent: bar.percent });
    loadHistory.set(key, points);
  }
}

function clampPercent(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(PERCENT_MAX, Math.max(0, number)) : 0;
}

function gigabytes(megabytes: number | undefined): string {
  return `${((megabytes || 0) / MB_PER_GB).toFixed(1)} GB`;
}

const LoadCurve: React.FC<{ points: HistoryPoint[]; colorClass: string; now: number }> = ({ points, colorClass, now }) => {
  const start = now - HISTORY_WINDOW_MS;
  const coordinates = points.map((point) => {
    const x = ((point.at - start) / HISTORY_WINDOW_MS) * SPARK_WIDTH;
    const y = SPARK_HEIGHT - (point.percent / PERCENT_MAX) * SPARK_HEIGHT;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const first = coordinates[0]?.split(',')[0] ?? '0';
  const last = coordinates[coordinates.length - 1]?.split(',')[0] ?? '0';
  return (
    <svg
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      preserveAspectRatio="none"
      className={`h-8 w-full rounded bg-slate-500/10 ${colorClass}`}
      aria-hidden="true"
    >
      {coordinates.length > 1 && (
        <>
          <polygon
            points={`${first},${SPARK_HEIGHT} ${coordinates.join(' ')} ${last},${SPARK_HEIGHT}`}
            fill="currentColor"
            fillOpacity={0.15}
          />
          <polyline points={coordinates.join(' ')} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  );
};

const PcHeaderResourceBars: React.FC = () => {
  const node = useSelectedPycoreNode();
  return <PcHeaderNodeResourceBars key={node.key} node={node} />;
};

const PcHeaderNodeResourceBars: React.FC<{ node: SelectedPycoreNode }> = ({ node }) => {
  const { t } = useTranslation('pc');
  const isMobile = useIsMobile();
  const [resources, setResources] = useState<SystemResources | null>(null);
  const [failed, setFailed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sampledAt, setSampledAt] = useState(() => Date.now());
  const [retryVersion, setRetryVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { http } = node.client;

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const poll = () => {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      http.requestPycoreHttp(PYCORE_HTTP_ROUTES.systemResourcesSystemResources, {}, REQUEST_CEILING_MS)
        .then((result) => {
          if (!alive) return;
          if (result && typeof result.cpu_percent === 'number' && result.mem) {
            setResources({ cpu_percent: result.cpu_percent, cpu: result.cpu, mem: result.mem, battery: result.battery ?? null, gpus: result.gpus || [] });
            setSampledAt(Date.now());
            setFailed(false);
          } else {
            setFailed(true);
          }
        })
        .catch(() => { if (alive) setFailed(true); })
        .finally(() => { inFlight = false; });
    };
    poll();
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', poll);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [http, retryVersion]);

  useEffect(() => {
    if (!detailsOpen) return undefined;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setDetailsOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [detailsOpen]);

  const gpus = resources?.gpus ?? [];
  const cpu = resources?.cpu;
  const battery = resources?.battery;
  const bars: ResourceBar[] = [
    {
      key: 'cpu',
      kind: 'cpu',
      label: t('aiHub.live.cpu'),
      detail: cpu?.name
        ? `${cpu.name}${cpu.logical_cores ? ` · ${t('systemBars.threads', { count: cpu.logical_cores })}` : ''}`
        : '',
      percent: clampPercent(resources?.cpu_percent),
    },
    {
      key: 'mem',
      kind: 'mem',
      label: t('aiHub.live.memory'),
      detail: resources ? `${gigabytes(resources.mem.used_mb)} / ${gigabytes(resources.mem.total_mb)}` : '',
      percent: clampPercent(resources?.mem?.percent),
    },
    ...(battery
      ? [{
        key: 'battery',
        kind: 'battery',
        label: t('systemBars.battery'),
        detail: t(battery.charging ? 'systemBars.charging' : 'systemBars.discharging'),
        percent: clampPercent(battery.percent),
      } as ResourceBar]
      : []),
    ...gpus.map((gpu, position): ResourceBar => ({
      key: `gpu${gpu.index ?? position}`,
      kind: 'gpu',
      label: gpus.length > 1 ? `${t('aiHub.live.gpu')}${gpu.index ?? position}` : t('aiHub.live.gpu'),
      detail: `${gpu.name} · ${gigabytes(gpu.mem_used_mb)} / ${gigabytes(gpu.mem_total_mb)}`,
      percent: clampPercent(gpu.util_percent),
    })),
  ];

  useEffect(() => {
    if (resources) recordHistory(node.key, bars, sampledAt);
    // Record once per sample; `bars` is derived from `resources`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampledAt]);

  const summary = resources
    ? bars.map((bar) => `${bar.label} ${Math.round(bar.percent)}%`).join(' · ')
    : t(failed ? 'systemBars.unavailable' : 'systemBars.loading');
  const heading = node.label ? `${t('systemBars.title')} · ${node.label}` : t('systemBars.title');

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setDetailsOpen((value) => !value)}
        title={`${heading}: ${summary}`}
        aria-label={`${heading}: ${summary}`}
        aria-expanded={detailsOpen}
        className={`flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/60 bg-slate-100/40 px-2 transition hover:bg-slate-200/50 dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.05] ${
          failed && !resources ? 'opacity-50' : ''
        }`}
      >
        {bars.map((bar) => (
          <span key={bar.key} className="flex items-center gap-1">
            <span className="relative flex h-5 w-1.5 overflow-hidden rounded-full bg-slate-500/20">
              <span
                className={`absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-500 ${RESOURCE_COLORS[bar.kind].bar}`}
                style={{ height: `${bar.percent}%` }}
              />
            </span>
            {!isMobile && (
              <span className="flex flex-col items-start leading-none">
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{bar.label}</span>
                <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300">{Math.round(bar.percent)}%</span>
              </span>
            )}
          </span>
        ))}
      </button>
      {detailsOpen && (
        <div className={`${isMobile ? 'fixed inset-x-2 top-14' : 'absolute left-0 top-full mt-2 w-80'} z-50 rounded-xl border border-slate-200/80 bg-white p-2.5 text-[11px] shadow-xl dark:border-white/10 dark:bg-slate-900`}>
          <p className="mb-2 flex items-center justify-between gap-2 font-bold text-slate-500 dark:text-slate-400">
            <span className="min-w-0 truncate">{heading}</span>
            <span className="shrink-0 font-normal text-[10px] text-slate-400">{t('systemBars.window')}</span>
          </p>
          {resources ? (
            <ul className="space-y-2.5">
              {bars.map((bar) => (
                <li key={bar.key} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${RESOURCE_COLORS[bar.kind].bar}`} />
                    <span className="shrink-0 font-semibold text-slate-600 dark:text-slate-300">{bar.label}</span>
                    <span className="min-w-0 flex-1 truncate text-[10px] text-slate-400" title={bar.detail}>{bar.detail}</span>
                    <span className="shrink-0 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">{Math.round(bar.percent)}%</span>
                  </div>
                  <LoadCurve points={loadHistory.get(historyKey(node.key, bar.key)) ?? []} colorClass={RESOURCE_COLORS[bar.kind].text} now={sampledAt} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center justify-between gap-2 text-slate-500">
              <p>{summary}</p>
              {failed && (
                <button
                  type="button"
                  onClick={() => { setFailed(false); setRetryVersion((value) => value + 1); }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-500/10 px-2 py-1 font-semibold text-indigo-500 hover:bg-indigo-500/20"
                >
                  <RefreshCw className="h-3 w-3" />
                  {t('systemBars.retry')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PcHeaderResourceBars;
