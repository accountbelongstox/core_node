/**
 * PcLaravelEndpointSwitcher — Laravel-API endpoint switcher for pycore-manager.
 *
 * State lives in PcLaravelEndpointContext so the global top-bar chip and the
 * Settings page share one list/current/health view. Mirrors laravel-manager's
 * ApiEndpointSwitcher UX (health dot + latency, click-to-switch, add/remove,
 * manual re-probe) through the shared browser LaravelAPI library.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Server, Check, RefreshCw, ChevronDown, ChevronUp, Plus, X, WifiOff,
} from 'lucide-react';
import type { LaravelApiEndpoint } from '@/apps/pycore-manager/api';
import { usePcLaravelEndpoint } from '../PcLaravelEndpointContext';

const dotCls = (ep?: LaravelApiEndpoint | null): string => {
  if (!ep || ep.healthy == null) return 'bg-slate-400';
  return ep.healthy
    ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
    : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]';
};

function latencyText(ep: LaravelApiEndpoint, t: (key: string) => string): string {
  if (ep.healthy == null) return t('endpoint.never');
  if (!ep.healthy) return t('endpoint.unhealthy');
  return typeof ep.latency_ms === 'number' ? `${Math.round(ep.latency_ms)}ms` : t('endpoint.healthy');
}

export type PcLaravelEndpointSwitcherVariant = 'embedded' | 'header';

interface Props {
  /** embedded = Settings card; header = global top bar */
  variant?: PcLaravelEndpointSwitcherVariant;
}

const PcLaravelEndpointSwitcher: React.FC<Props> = ({ variant = 'embedded' }) => {
  const { t } = useTranslation('pc');
  const {
    endpoints, current, loading, probing, switching, error, fallback, actionError,
    reload, select, addUrl, removeUrl, reprobe,
  } = usePcLaravelEndpoint();

  const [open, setOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const inHeader = variant === 'header';

  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const handleAdd = async () => {
    const url = newUrl.trim();
    if (!url) return;
    await addUrl(url);
    setNewUrl('');
  };

  if (error && endpoints.length === 0) {
    return (
      <div className={`flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 ${
        inHeader ? 'max-w-md' : 'mb-3'
      }`}>
        <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
        <span className="flex-1 break-words">{t('endpoint.unavailable')} ({error})</span>
        <button type="button" onClick={reload} disabled={loading}
          className="shrink-0 px-2 py-1 text-[11px] font-bold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 transition flex items-center gap-1 disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> {t('endpoint.retry')}
        </button>
      </div>
    );
  }

  const cur = endpoints.find((e) => e.url === current) || null;
  const removable = (ep: LaravelApiEndpoint): boolean =>
    ep.url !== current && ep.custom !== false;

  return (
    <div
      ref={boxRef}
      className={`relative ${inHeader ? '' : 'mb-3'}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-100/40 dark:bg-white/[0.02] hover:bg-slate-200/50 dark:hover:bg-white/[0.05] transition text-left ${
          inHeader
            ? 'max-w-[min(20rem,calc(100vw-var(--shell-dock-right-gutter,264px)-1.5rem))]'
            : 'w-full sm:w-auto'
        }`}
        title={cur ? `${cur.url} · ${latencyText(cur, t)}` : t('endpoint.title')}
      >
        <Server className="w-3.5 h-3.5 text-rose-500 shrink-0" />
        <span className={`w-2 h-2 rounded-full shrink-0 transition-all ${dotCls(cur)}`} />
        <span className="min-w-0 flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('endpoint.title')}</span>
          <span className={`text-xs font-mono text-slate-700 dark:text-slate-200 truncate ${
            inHeader ? 'max-w-[11rem] sm:max-w-[14rem]' : 'max-w-[16rem]'
          }`}>
            {loading && !current ? '…' : (current || t('endpoint.empty'))}
          </span>
        </span>
        {cur && (
          <span className={`shrink-0 text-[10px] font-bold ${
            cur.healthy == null ? 'text-slate-400' : cur.healthy ? 'text-emerald-500' : 'text-rose-500'
          }`}>
            {latencyText(cur, t)}
          </span>
        )}
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      </button>

      {open && (
        // Dropdown opens downward, right-aligned to the chip. PcTopBar already
        // pads right by shellDockRightGutterPx() so the panel stays left of
        // ShellControls (Apps / Home / theme / language).
        <div className={`absolute top-full mt-2 w-full sm:w-96 z-50 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-hidden ${
          inHeader ? 'right-0' : 'left-0'
        }`}>
          <div className="px-3 py-2 flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 bg-slate-100/60 dark:bg-white/[0.03]">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-rose-500" /> {t('endpoint.title')}
            </span>
            <button type="button" onClick={reprobe} disabled={probing || loading}
              className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-white/10 transition flex items-center gap-1 disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${probing ? 'animate-spin' : ''}`} /> {t('endpoint.reprobe')}
            </button>
          </div>

          {fallback && (
            // pycore HTTP (:59000) offline: the list below is the read-only prepared
            // set so the available APIs are still visible. Retry re-attempts the HTTP.
            <div className="px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-1.5">
              <WifiOff className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="flex-1 break-words">{t('endpoint.offlineHint')}</span>
              <button type="button" onClick={reload} disabled={loading}
                className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/15 hover:bg-amber-500/25 transition">
                {t('endpoint.retry')}
              </button>
            </div>
          )}

          <ul className="max-h-64 overflow-y-auto p-1.5 space-y-1">
            {endpoints.length === 0 ? (
              <li className="text-[11px] text-slate-500 py-3 text-center">{t('endpoint.empty')}</li>
            ) : endpoints.map((ep) => {
              const isCurrent = ep.url === current;
              const inFlight = switching === ep.url;
              return (
                <li key={ep.url} className="flex items-center gap-1">
                  <button type="button" onClick={() => { select(ep.url); setOpen(false); }} disabled={!!switching}
                    className={`flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition border ${
                      isCurrent
                        ? 'border-rose-500/30 bg-rose-500/10'
                        : 'border-transparent hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
                    } disabled:opacity-60`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls(ep)}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-mono text-slate-700 dark:text-slate-200 truncate" title={ep.url}>
                        {ep.url}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {inFlight ? t('endpoint.switching') : latencyText(ep, t)}
                        {ep.last_checked ? ` · ${t('endpoint.checked')} ${ep.last_checked}` : ''}
                      </span>
                    </span>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                    {inFlight && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />}
                  </button>
                  {removable(ep) && (
                    <button type="button" onClick={() => removeUrl(ep.url)} title={`${t('endpoint.remove')}: ${ep.url}`}
                      className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="px-3 py-2 border-t border-slate-200/60 dark:border-white/5 bg-slate-100/60 dark:bg-white/[0.03] space-y-1.5">
            <div className="flex items-center gap-1.5">
              <input type="text" value={newUrl} placeholder={t('endpoint.addPlaceholder')}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                className="flex-1 min-w-0 px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/30 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-rose-500/50" />
              <button type="button" onClick={handleAdd} disabled={!newUrl.trim()}
                className="shrink-0 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                <Plus className="w-3 h-3" /> {t('endpoint.add')}
              </button>
            </div>
            {actionError && <p className="text-[11px] text-amber-500 break-words">{actionError}</p>}
            <p className="text-[10px] text-slate-400">{t('endpoint.hint')}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PcLaravelEndpointSwitcher;
