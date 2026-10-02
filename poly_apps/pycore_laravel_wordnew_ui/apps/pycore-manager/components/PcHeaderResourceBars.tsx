/** Top-bar CPU / memory / GPU usage bars of the active pycore host, polled every 2 s. */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { SystemResources } from '@/apps/pycore-manager/api';
import { useIsMobile } from '../hooks/useIsMobile';

const POLL_INTERVAL_MS = 2000;
const PERCENT_MAX = 100;
const WARN_PERCENT = 80;
const CRITICAL_PERCENT = 95;

interface ResourceBar {
  key: string;
  label: string;
  percent: number;
}

function clampPercent(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(PERCENT_MAX, Math.max(0, number)) : 0;
}

function barColor(percent: number): string {
  if (percent >= CRITICAL_PERCENT) return 'bg-rose-500';
  if (percent >= WARN_PERCENT) return 'bg-amber-500';
  return 'bg-emerald-500';
}

const PcHeaderResourceBars: React.FC = () => {
  const { t } = useTranslation('pc');
  const isMobile = useIsMobile();
  const [resources, setResources] = useState<SystemResources | null>(null);
  const [failed, setFailed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const poll = () => {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      pycoreApi.getSystemResources()
        .then((result) => {
          if (!alive) return;
          if (result && typeof result.cpu_percent === 'number' && result.mem) {
            setResources({ cpu_percent: result.cpu_percent, mem: result.mem, gpus: result.gpus || [] });
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
  }, []);

  useEffect(() => {
    if (!detailsOpen) return undefined;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setDetailsOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [detailsOpen]);

  const gpus = resources?.gpus ?? [];
  const bars: ResourceBar[] = [
    { key: 'cpu', label: t('aiHub.live.cpu'), percent: clampPercent(resources?.cpu_percent) },
    { key: 'mem', label: t('aiHub.live.memory'), percent: clampPercent(resources?.mem?.percent) },
    ...gpus.map((gpu, position) => ({
      key: `gpu${gpu.index ?? position}`,
      label: gpus.length > 1 ? `${t('aiHub.live.gpu')}${gpu.index ?? position}` : t('aiHub.live.gpu'),
      percent: clampPercent(gpu.util_percent),
    })),
  ];
  const summary = resources
    ? bars.map((bar) => `${bar.label} ${Math.round(bar.percent)}%`).join(' · ')
    : t(failed ? 'systemBars.unavailable' : 'systemBars.loading');

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setDetailsOpen((value) => !value)}
        title={`${t('systemBars.title')}: ${summary}`}
        aria-label={`${t('systemBars.title')}: ${summary}`}
        aria-expanded={detailsOpen}
        className={`flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/60 bg-slate-100/40 px-2 transition hover:bg-slate-200/50 dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.05] ${
          failed && !resources ? 'opacity-50' : ''
        }`}
      >
        {bars.map((bar) => (
          <span key={bar.key} className="flex items-center gap-1">
            <span className="relative flex h-5 w-1.5 overflow-hidden rounded-full bg-slate-500/20">
              <span
                className={`absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-500 ${barColor(bar.percent)}`}
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
        <div className="absolute right-0 top-full z-50 mt-2 w-max max-w-[16rem] rounded-xl border border-slate-200/80 bg-white p-2.5 text-[11px] shadow-xl dark:border-white/10 dark:bg-slate-900">
          <p className="mb-1.5 font-bold text-slate-500 dark:text-slate-400">{t('systemBars.title')}</p>
          {resources ? (
            <ul className="space-y-1">
              {bars.map((bar) => (
                <li key={bar.key} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-slate-500">{bar.label}</span>
                  <span className="relative h-1.5 w-20 overflow-hidden rounded-full bg-slate-500/20">
                    <span className={`absolute inset-y-0 left-0 rounded-full ${barColor(bar.percent)}`} style={{ width: `${bar.percent}%` }} />
                  </span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{Math.round(bar.percent)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">{summary}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PcHeaderResourceBars;
