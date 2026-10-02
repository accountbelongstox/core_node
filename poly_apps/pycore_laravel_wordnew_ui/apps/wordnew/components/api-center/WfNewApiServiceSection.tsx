/**
 * One API-center service (Laravel or pycore) rendered from the service
 * contract: status, entries (probe, select, remove), user entry, diagnosis.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Check, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { notify } from '@/shared/notify/notify';
import { Pill } from '@/shared/ui/Pill';
import type { ElementTheme } from '../../WfNewThemes';
import { WfNewPycoreLanScan } from './WfNewPycoreLanScan';
import { ApiEntryStateIcon, ApiUrlLine, useApiServiceStatus } from './ApiEndpoint';
import type { WordNewApiDiagnosis, WordNewApiService } from '../../api/center/WordNewApiCenter';

interface Props {
  service: WordNewApiService;
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const ACTION_TONE = {
  indigo: 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  emerald: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
} as const;

const ToneActionButton: React.FC<{ tone: keyof typeof ACTION_TONE; disabled: boolean; onClick: () => void; className?: string; children: React.ReactNode }> = ({ tone, disabled, onClick, className = '', children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition-all disabled:opacity-50 ${ACTION_TONE[tone]} ${className}`}
  >
    {children}
  </button>
);

export const WfNewApiServiceSection: React.FC<Props> = ({ service, activeTheme, trans }) => {
  const snapshot = useApiServiceStatus(service);
  const [entry, setEntry] = useState('');
  const [switching, setSwitching] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<WordNewApiDiagnosis | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  useEffect(() => { setDiagnosis(null); }, [service]);

  const refresh = useCallback(async () => {
    if (await service.refresh()) notify.success(trans('apiCenter.toast.online'));
    else notify.warning(trans('apiCenter.toast.selectedDown'));
  }, [service, trans]);

  const select = useCallback(async (id: string) => {
    if (switching) return;
    setSwitching(id);
    const ok = await service.select(id).finally(() => setSwitching(null));
    if (ok) notify.success(trans('api.toastSwitched'));
    else notify.warning(trans('apiCenter.toast.switchFailed'));
  }, [service, switching, trans]);

  const add = useCallback(() => {
    const value = entry.trim();
    if (!value) return;
    if (!service.add(value)) {
      notify.warning(trans('apiCenter.toast.addInvalid'));
      return;
    }
    setEntry('');
    notify.success(trans('api.toastAdded', { target: value }));
  }, [entry, service, trans]);

  const diagnose = useCallback(async () => {
    setDiagnosing(true);
    setDiagnosis(await service.diagnose().finally(() => setDiagnosing(false)));
  }, [service]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono leading-relaxed">{trans(service.descriptionKey)}</p>
        <ToneActionButton tone="indigo" disabled={snapshot.busy} onClick={() => { void refresh(); }} className="shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${snapshot.busy ? 'animate-spin' : ''}`} />
          {snapshot.busy ? trans('api.testing') : trans('apiCenter.detect')}
        </ToneActionButton>
      </div>

      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        {trans(snapshot.state === 'reconnecting' ? 'apiCenter.reconnectingHint' : 'apiCenter.fixedHint')}
      </p>
      {snapshot.entries.length === 0 ? (
        <p className="text-xs font-mono text-zinc-500">{trans(`apiCenter.${service.id}.empty`)}</p>
      ) : (
        <ul className="space-y-2">
          {snapshot.entries.map((item) => (
            <li
              key={item.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                item.selected ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/2'
              }`}
            >
              <div className="min-w-0 flex items-center gap-2.5">
                <ApiEntryStateIcon state={item.state} title={trans(`apiCenter.state.${item.state}`)} />
                <div className="min-w-0">
                  <p className="text-xs font-mono font-bold flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="break-all">{item.label}</span>
                    <Pill className="font-black uppercase tracking-wider">{trans(item.kindKey)}</Pill>
                    {item.selected && <Pill tone="indigo" className="uppercase">{trans('api.inUse')}</Pill>}
                    {item.temporary && <Pill tone="sky" className="font-black uppercase">{trans('apiCenter.temporary')}</Pill>}
                  </p>
                  <ApiUrlLine url={item.url} trans={trans} className="text-[10px] select-all" />
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                    {item.latencyMs != null ? `${item.latencyMs}ms` : trans(`apiCenter.state.${item.state}`)}
                    {item.detail ? ` · ${item.detail}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!item.selected && (
                  <button
                    type="button"
                    onClick={() => { void select(item.id); }}
                    disabled={switching !== null}
                    className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase bg-white/5 hover:bg-indigo-500/15 text-indigo-500 px-2.5 py-1.5 rounded-lg border border-indigo-500/20 transition-all disabled:opacity-50"
                  >
                    {switching === item.id
                      ? <><RefreshCw className="w-3 h-3 animate-spin" /> {trans('api.statusChecking')}</>
                      : <><Check className="w-3 h-3" /> {trans('api.use')}</>}
                  </button>
                )}
                {item.removable && (
                  <button type="button" onClick={() => service.remove(item.id)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-all" title={trans('api.removeTitle')} aria-label={trans('api.removeTitle')}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {service.id === 'pycore' && <WfNewPycoreLanScan activeTheme={activeTheme} trans={trans} />}

      <form
        className="pt-1 border-t border-slate-200 dark:border-white/5 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <label htmlFor={`api-center-add-${service.id}`} className="text-[11px] font-black font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
          {trans('api.addCustom')}
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id={`api-center-add-${service.id}`}
            type="text"
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            placeholder={trans(service.addPlaceholderKey)}
            className={`flex-1 py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none ${activeTheme.inputClass}`}
          />
          <button type="submit" disabled={!entry.trim()} className="flex items-center justify-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl transition-all disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> {trans('api.add')}
          </button>
        </div>
      </form>

      <div className="pt-1 border-t border-slate-200 dark:border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{trans('api.testPage')}</span>
          <ToneActionButton tone="emerald" disabled={diagnosing} onClick={() => { void diagnose(); }}>
            <Activity className={`w-3.5 h-3.5 ${diagnosing ? 'animate-pulse' : ''}`} />
            {diagnosing ? trans('api.running') : trans('api.runTest')}
          </ToneActionButton>
        </div>
        <div
          aria-live="polite"
          className={`p-3 rounded-xl text-[11px] font-mono leading-relaxed border ${
            diagnosis === null ? 'border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/2 text-zinc-500'
              : diagnosis.ok ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                : 'border-rose-500/30 bg-rose-500/5 text-rose-500'
          }`}
        >
          {diagnosis ? trans(diagnosis.messageKey, diagnosis.params) : trans(service.diagnoseHintKey)}
        </div>
      </div>
    </div>
  );
};
