/**
 * WfNewApiCenterPanel - Settings summary of the API center: one row per
 * backend service (Laravel API, pycore API) with its selected entry and
 * status; a row opens the API center on that service.
 */
import React, { useEffect, useState } from 'react';
import { ChevronRight, Loader2, Server, Wifi, WifiOff } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import {
  WORDNEW_API_SERVICES,
  useWordNewApiService,
  type WordNewApiService,
  type WordNewApiServiceId,
} from '../../api/center/WordNewApiCenter';
import { WfNewApiCenterDialog } from './WfNewApiCenterDialog';
import { API_STATE_CHIP } from './apiCenterStyles';
import { WfNewCopyButton } from '../WfNewCopyButton';

interface Props {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const ServiceRow: React.FC<{ service: WordNewApiService; onOpen: () => void; trans: Props['trans'] }> = ({ service, onOpen, trans }) => {
  const snapshot = useWordNewApiService(service);
  const selected = snapshot.entries.find((entry) => entry.selected);
  const spinning = snapshot.state === 'checking' || snapshot.state === 'reconnecting';
  const Icon = spinning ? Loader2 : snapshot.state === 'online' ? Wifi : WifiOff;
  useEffect(() => { service.start(); }, [service]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className="w-full flex cursor-pointer items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200 dark:border-white/5 hover:border-indigo-500/40 transition-all text-left group"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100">{trans(service.titleKey)}</p>
        <div className="mt-0.5 flex items-start gap-1">
          <p className="min-w-0 flex-1 break-all text-[11px] font-mono text-zinc-500 dark:text-zinc-400">{snapshot.selectedUrl || trans('apiCenter.noneSelected')}</p>
          {snapshot.selectedUrl && <WfNewCopyButton value={snapshot.selectedUrl} trans={trans} className="-mt-0.5" />}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full ${API_STATE_CHIP[snapshot.state]}`}>
          <Icon className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`} />
          {snapshot.state === 'online' && selected?.latencyMs != null
            ? trans('api.statusOnline', { ms: selected.latencyMs })
            : trans(`apiCenter.service.${snapshot.state}`)}
        </span>
        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
};

export const WfNewApiCenterPanel: React.FC<Props> = ({ activeTheme, trans }) => {
  const [openService, setOpenService] = useState<WordNewApiServiceId | null>(null);

  return (
    <section className={`p-6 rounded-3xl ${activeTheme.cardClass} shadow-sm space-y-3`}>
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500 shrink-0">
          <Server className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold font-mono uppercase tracking-wider text-indigo-500 dark:text-indigo-400">{trans('apiCenter.title')}</h3>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-1">{trans('api.tapHint')}</p>
        </div>
      </div>
      {WORDNEW_API_SERVICES.map((service) => (
        <ServiceRow key={service.id} service={service} onOpen={() => setOpenService(service.id)} trans={trans} />
      ))}
      <WfNewApiCenterDialog
        open={openService !== null}
        initialService={openService ?? 'laravel'}
        onClose={() => setOpenService(null)}
        activeTheme={activeTheme}
        trans={trans}
      />
    </section>
  );
};
