/**
 * WfNewApiCenterPanel - Settings summary of the API center: one row per
 * backend service (Laravel API, pycore API) with its selected entry and
 * status; a row opens the API center on that service.
 */
import React, { useState } from 'react';
import { ChevronRight, Server } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import {
  WORDNEW_API_SERVICES,
  type WordNewApiService,
  type WordNewApiServiceId,
} from '../../api/center/WordNewApiCenter';
import { WfNewApiCenterDialog } from './WfNewApiCenterDialog';
import { WfNewIconCardSection } from './WfNewIconCardSection';
import { ApiServiceStatusBadge, ApiUrlLine, useApiServiceStatus } from './ApiEndpoint';

interface Props {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const ServiceRow: React.FC<{ service: WordNewApiService; onOpen: () => void; trans: Props['trans'] }> = ({ service, onOpen, trans }) => {
  const snapshot = useApiServiceStatus(service);

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
        {snapshot.selectedUrl
          ? <ApiUrlLine url={snapshot.selectedUrl} trans={trans} className="mt-0.5 text-[11px]" />
          : <p className="mt-0.5 break-all text-[11px] font-mono text-zinc-500 dark:text-zinc-400">{trans('apiCenter.noneSelected')}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ApiServiceStatusBadge snapshot={snapshot} trans={trans} />
        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
};

export const WfNewApiCenterPanel: React.FC<Props> = ({ activeTheme, trans }) => {
  const [openService, setOpenService] = useState<WordNewApiServiceId | null>(null);

  return (
    <WfNewIconCardSection icon={Server} title={trans('apiCenter.title')} description={trans('api.tapHint')} theme={activeTheme} mono>
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
    </WfNewIconCardSection>
  );
};
