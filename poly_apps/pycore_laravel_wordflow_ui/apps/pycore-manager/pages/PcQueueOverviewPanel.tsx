/**
 * PcQueueOverviewPanel — Queue Center Overview tab.
 * GET /api/local/queue/overview + hub task-center reachability.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutGrid, Loader2, AlertTriangle, Wifi, WifiOff, Globe, Cpu, Sparkles, Chrome,
  Users, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { PcQueueOverview, PcQueueCategory, PcQueueWorker, PcQueueHandler } from '../../../core/api-libs/pycore';
import type { QueueCenterPanelProps } from '../utils/pcQueueCenterTypes';
import { useQueueCenterHub, laravelLiveSyncOffline, laravelEndpointMismatch, workerEndpointMismatch } from '../hooks/useQueueCenterHub';

const HANDLER_STYLE: Record<PcQueueHandler, { chip: string; Icon: React.FC<{ className?: string }> }> = {
  chrome: { chip: 'bg-amber-500/15 text-amber-500', Icon: Chrome },
  pycore: { chip: 'bg-indigo-500/15 text-indigo-500', Icon: Cpu },
  ai: { chip: 'bg-violet-500/15 text-violet-500', Icon: Sparkles },
  any: { chip: 'bg-sky-500/15 text-sky-500', Icon: Users },
};

const PcQueueOverviewPanel: React.FC<QueueCenterPanelProps> = () => {
  const { t } = useTranslation('pc');
  const hub = useQueueCenterHub();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Data and errors come from the same generated Queue Center snapshot.
  const raw = hub.overview as any;
  const data: PcQueueOverview | null =
    (raw && raw.success !== false && Array.isArray(raw.categories)) ? (raw as PcQueueOverview) : null;
  const loading = hub.loading;
  const err = hub.sliceErrors.overview ?? (!hub.pycoreReachable ? hub.error : null);

  /*
   * [gpt-5.3-codex-spark:LEGACY-START]
   * Previous implementation reported overview pending summary to the page:
   * const cats = (ov && Array.isArray(ov.categories)) ? ov.categories : null;
   * const pending = cats ? cats.reduce((s: number, c: any) => s + (c.pending || 0), 0) : null;
   * onMeta?.({ count: pending, loading: hub.loading });
   * [gpt-5.3-codex-spark:LEGACY-END]
   */

  if (!data) {
    return (
      <section className="pc-glass p-6 text-xs text-slate-500 flex items-center gap-2">
        {loading
          ? (<><Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> {t('queueCenter.overview.loading')}</>)
          : (<><AlertTriangle className="w-4 h-4 text-amber-400" /> {err || t('queueCenter.overview.unavailable')}</>)}
      </section>
    );
  }

  const categories = data.categories ?? [];
  const workers = data.workers ?? [];
  // Reachability comes ONLY from the hub's task-center fields — the cached
  // snapshot above may be days old and must never supply the flag.
  const laravelReachable = hub.laravelReachable === true;
  const liveSyncOffline = laravelLiveSyncOffline(hub);
  const endpointMismatch = laravelEndpointMismatch(hub);
  const workerMismatch = workerEndpointMismatch(hub);

  const num = (n: number, cls: string, label: string) => (
    <span className="inline-flex flex-col items-center px-2 py-1 rounded-lg bg-slate-500/5">
      <span className={`text-sm font-mono font-bold ${n > 0 ? cls : 'text-slate-400'}`}>{n}</span>
      <span className="text-[9px] uppercase tracking-wide text-slate-400">{label}</span>
    </span>
  );

  return (
    <div className="space-y-4">
      {err && (
        <section className="pc-glass p-3 text-[11px] text-rose-500 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">{err}</span>
        </section>
      )}
      {/* header + reachability */}
      <section className="pc-glass p-4 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <LayoutGrid className="w-4 h-4 text-indigo-500 shrink-0" />
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('queueCenter.overview.title')}</h2>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${
            laravelReachable ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
            {laravelReachable ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {laravelReachable ? t('queueCenter.overview.reachable') : t('queueCenter.overview.backendOffline')}
          </span>
          {hub.timestamp && (
            <span className="ml-auto text-[10px] font-mono text-slate-400" title={hub.timestamp}>
              {t('queueCenter.overview.generatedAt', { time: new Date(hub.timestamp).toLocaleTimeString() })}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('queueCenter.overview.hint')}</p>
        {!laravelReachable && liveSyncOffline && (
          <p className="text-[11px] text-amber-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Laravel live sync paused — showing cached snapshot.
            {hub.laravelStoredEndpoint ? ` Selected endpoint: ${hub.laravelStoredEndpoint}.` : ''}
          </p>
        )}
        {workerMismatch && (
          <p className="text-[11px] text-amber-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {t('queueCenter.endpointMismatch')}
            <span className="font-mono text-[10px] text-slate-500">
              ({hub.workerApiUrl} → {hub.laravelActiveEndpoint})
            </span>
          </p>
        )}
        {endpointMismatch && !workerMismatch && (
          <p className="text-[11px] text-sky-500">
            Active Laravel endpoint: {hub.laravelActiveEndpoint}
            {hub.laravelStoredEndpoint ? ` (Settings selected ${hub.laravelStoredEndpoint})` : ''}
          </p>
        )}
      </section>

      {/* category cards */}
      {categories.length === 0 ? (
        <section className="pc-glass p-6 text-xs text-slate-500">{t('queueCenter.overview.empty')}</section>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {categories.map((c: PcQueueCategory) => {
            const hs = HANDLER_STYLE[c.handler] ?? HANDLER_STYLE.pycore;
            const HIcon = hs.Icon;
            const langs = c.by_language ? Object.entries(c.by_language).filter(([, n]) => n > 0) : [];
            const samples = c.sample ?? [];
            const isOpen = !!expanded[c.key];
            return (
              <div key={c.key} className="rounded-2xl p-3 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 space-y-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={c.label}>{c.label}</span>
                  <span className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0 ${hs.chip}`}
                    title={t(`queueCenter.overview.handlerTitle.${c.handler}` as const)}>
                    <HIcon className="w-3 h-3" /> {t(`queueCenter.overview.handler.${c.handler}` as const)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {num(c.pending, 'text-sky-500', t('queueCenter.overview.pending'))}
                  {num(c.processing, 'text-amber-500', t('queueCenter.overview.processing'))}
                  {num(c.leased, 'text-violet-500', t('queueCenter.overview.leased'))}
                  {num(c.total, 'text-slate-600 dark:text-slate-300', t('queueCenter.overview.total'))}
                </div>
                {langs.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="text-[9px] uppercase tracking-wide text-slate-400">{t('queueCenter.overview.byLanguage')}</div>
                    <div className="flex flex-wrap gap-1">
                      {langs.map(([lang, n]) => (
                        <span key={lang} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-500/10 text-[10px] font-mono text-slate-500">
                          <Globe className="w-2.5 h-2.5 text-slate-400" />{lang}<b className="text-slate-700 dark:text-slate-300">{n}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {samples.length > 0 && (
                  <div>
                    <button onClick={() => setExpanded((p) => ({ ...p, [c.key]: !isOpen }))}
                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-400 transition">
                      {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {isOpen ? t('queueCenter.overview.hideSamples') : t('queueCenter.overview.showSamples')} ({samples.length})
                    </button>
                    {isOpen && (
                      <ul className="mt-1 space-y-0.5">
                        {samples.map((s, i) => (
                          <li key={i} className="text-[10px] font-mono text-slate-500 truncate"
                            title={s.word || s.title || s.source_key || String(s.id ?? '')}>
                            • {s.word || s.title || s.source_key || String(s.id ?? '—')}
                            {s.language ? <span className="text-slate-400"> · {s.language}</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* workers registry */}
      <section className="pc-glass p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500 shrink-0" />
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('queueCenter.workers.title')}</h2>
          <span className="text-[11px] text-slate-400">{t('queueCenter.workers.hint')}</span>
        </div>
        {workers.length === 0 ? (
          <p className="text-xs text-slate-500">{t('queueCenter.workers.none')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {workers.map((w: PcQueueWorker) => {
              const WIcon = w.kind === 'chrome' ? Chrome : Cpu;
              return (
                <div key={w.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5">
                  <WIcon className={`w-3.5 h-3.5 ${w.kind === 'chrome' ? 'text-amber-500' : 'text-indigo-500'}`} />
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[10rem]" title={w.id}>{w.id}</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${
                    w.online ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${w.online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {w.online ? t('queueCenter.workers.online') : t('queueCenter.workers.offline')}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {t('queueCenter.workers.claimed')} <b className="text-violet-500">{w.claimed}</b>
                  </span>
                  {w.processor_types?.length > 0 && (
                    <span className="text-[9px] font-mono text-slate-400 truncate max-w-[12rem]" title={w.processor_types.join(', ')}>
                      {t('queueCenter.workers.processes')}: {w.processor_types.join(', ')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default PcQueueOverviewPanel;
