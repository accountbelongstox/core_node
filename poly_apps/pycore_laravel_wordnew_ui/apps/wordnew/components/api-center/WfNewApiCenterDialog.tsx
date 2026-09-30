/**
 * WfNewApiCenterDialog - the API center: one tab per backend service
 * (Laravel API, pycore API), each rendered from the service contract.
 * Shared overlay framework (<Portal/> + OVERLAY_Z), Escape closes.
 */
import React, { useEffect, useState } from 'react';
import { Server, X } from 'lucide-react';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_Z, OVERLAY_CONTAINER, OVERLAY_BACKDROP } from '@/shared/styles/overlay';
import type { ElementTheme } from '../../WfNewThemes';
import {
  WORDNEW_API_SERVICES,
  useWordNewApiService,
  wordNewApiService,
  type WordNewApiService,
  type WordNewApiServiceId,
} from '../../api/center/WordNewApiCenter';
import { WfNewApiServiceSection } from './WfNewApiServiceSection';
import { API_STATE_DOT } from './apiCenterStyles';

interface Props {
  open: boolean;
  onClose: () => void;
  initialService?: WordNewApiServiceId;
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const ServiceTab: React.FC<{
  service: WordNewApiService;
  active: boolean;
  onSelect: () => void;
  trans: Props['trans'];
}> = ({ service, active, onSelect, trans }) => {
  const snapshot = useWordNewApiService(service);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
        active ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-slate-200 dark:border-white/10 text-zinc-500 hover:bg-slate-500/5'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${API_STATE_DOT[snapshot.state]}`} aria-hidden />
      {trans(service.titleKey)}
    </button>
  );
};

export const WfNewApiCenterDialog: React.FC<Props> = ({ open, onClose, initialService = 'laravel', activeTheme, trans }) => {
  const [serviceId, setServiceId] = useState<WordNewApiServiceId>(initialService);

  useEffect(() => {
    if (open) setServiceId(initialService);
  }, [open, initialService]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal}`}>
        <div className={`absolute inset-0 ${OVERLAY_BACKDROP}`} onClick={onClose} />
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
            <div className="flex flex-wrap gap-2" role="tablist">
              {WORDNEW_API_SERVICES.map((service) => (
                <ServiceTab key={service.id} service={service} active={service.id === serviceId} onSelect={() => setServiceId(service.id)} trans={trans} />
              ))}
            </div>
          </div>
          <div className="p-6" role="tabpanel">
            <WfNewApiServiceSection service={wordNewApiService(serviceId)} activeTheme={activeTheme} trans={trans} />
          </div>
        </div>
      </div>
    </Portal>
  );
};
