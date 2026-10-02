/**
 * WfNewApiCenterDialog - the API center: one tab per backend service
 * (Laravel API, pycore API), each rendered from the service contract.
 * Shared ModalShell overlay, Escape closes.
 */
import React, { useEffect, useState } from 'react';
import { Server, X } from 'lucide-react';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import { ModalShell } from '@/shared/ui/ModalShell';
import type { ElementTheme } from '../../WfNewThemes';
import {
  WORDNEW_API_SERVICES,
  useWordNewApiService,
  wordNewApiService,
  type WordNewApiService,
  type WordNewApiServiceId,
} from '../../api/center/WordNewApiCenter';
import { WfNewApiServiceSection } from './WfNewApiServiceSection';
import { ApiStateDot } from './ApiEndpoint';

interface Props {
  open: boolean;
  onClose: () => void;
  initialService?: WordNewApiServiceId;
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const TAB_CLASS = 'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs transition-all';
const TAB_SELECTED = 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300';
const TAB_IDLE = 'border-slate-200 dark:border-white/10 text-zinc-500 hover:bg-slate-500/5';

const ServiceTabLabel: React.FC<{ service: WordNewApiService; trans: Props['trans'] }> = ({ service, trans }) => {
  const snapshot = useWordNewApiService(service);
  return (
    <>
      <ApiStateDot state={snapshot.state} className="h-2 w-2" />
      {trans(service.titleKey)}
    </>
  );
};

export const WfNewApiCenterDialog: React.FC<Props> = ({ open, onClose, initialService = 'laravel', activeTheme, trans }) => {
  const [serviceId, setServiceId] = useState<WordNewApiServiceId>(initialService);

  useEffect(() => {
    if (open) setServiceId(initialService);
  }, [open, initialService]);

  const tabs = WORDNEW_API_SERVICES.map((service) => ({ value: service.id, label: <ServiceTabLabel service={service} trans={trans} /> }));

  return (
    <ModalShell open={open} onClose={onClose} cardClassName={null}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={trans('apiCenter.title')}
        className={`relative w-full max-w-2xl max-h-[88vh] overflow-y-auto no-scrollbar rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl ${
          activeTheme.id === 'nordic' ? 'bg-white text-slate-800' : 'bg-slate-900 text-slate-100'
        }`}
      >
        <div className="sticky top-0 z-10 space-y-3 px-6 py-4 border-b border-slate-200 dark:border-white/10 backdrop-blur bg-inherit rounded-t-3xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base font-extrabold tracking-tight">{trans('apiCenter.title')}</h3>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-500/10" title={trans('api.close')} aria-label={trans('api.close')}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <ChipGroup<WordNewApiServiceId>
            role="tab"
            value={serviceId}
            options={tabs}
            onChange={setServiceId}
            chipClassName={TAB_CLASS}
            selectedClassName={TAB_SELECTED}
            idleClassName={TAB_IDLE}
          />
        </div>
        <div className="p-6" role="tabpanel">
          <WfNewApiServiceSection service={wordNewApiService(serviceId)} activeTheme={activeTheme} trans={trans} />
        </div>
      </div>
    </ModalShell>
  );
};
