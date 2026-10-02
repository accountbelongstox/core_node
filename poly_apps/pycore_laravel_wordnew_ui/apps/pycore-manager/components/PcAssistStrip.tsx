/** Pycore → Laravel capability control-plane status. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, Check, Handshake, Loader2, Play, Power, RefreshCw, WifiOff,
} from 'lucide-react';
import type { AssistCapabilities, AssistStatus } from '@/apps/pycore-manager/api';
import {
  laravelEndpointMismatch, laravelLiveSyncOffline, useQueueCenterHub, workerEndpointMismatch,
} from '../hooks/useQueueCenterHub';
import { pcCaughtErrorMessage, pcErrorCodeText, pcFailureMessage } from '../utils/pcErrorCodes';

type AssistCapKey = keyof AssistCapabilities;
const ADVANCED_CAPABILITIES: AssistCapKey[] = ['subtitle', 'stt'];

const isAssistStatus = (value: unknown): value is AssistStatus =>
  Boolean(value && typeof (value as AssistStatus).enabled === 'boolean'
    && (value as AssistStatus).capabilities);

export const PcAssistStrip: React.FC = () => {
  const { t } = useTranslation('pc');
  const hub = useQueueCenterHub();
  const status = isAssistStatus(hub.assist) ? hub.assist : null;
  const loading = hub.loading;
  const liveSyncOffline = laravelLiveSyncOffline(hub);
  const endpointMismatch = laravelEndpointMismatch(hub);
  const workerMismatch = workerEndpointMismatch(hub);
  const [runningCycle, setRunningCycle] = useState(false);
  const [capabilityBusy, setCapabilityBusy] = useState(false);
  const [optimistic, setOptimistic] = useState<Partial<Record<AssistCapKey, boolean>>>({});
  const [message, setMessage] = useState<{ failed: boolean; text: string } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const runCycle = useCallback(async () => {
    if (runningCycle) return;
    setRunningCycle(true);
    setMessage(null);
    try {
      const response = await hub.runAssistCycle();
      if (!mounted.current) return;
      setMessage(response.ok
        ? { failed: false, text: t('queueCenter.assist.triggered', { count: response.processed ?? 0 }) }
        : { failed: true, text: t('queueCenter.assist.runFailed', { reason: pcFailureMessage(response, t('queueCenter.assist.unavailable')) }) });
    } catch (error: unknown) {
      if (mounted.current) setMessage({ failed: true, text: t('queueCenter.assist.runFailed', { reason: pcCaughtErrorMessage(error, t('queueCenter.assist.unreachable')) }) });
    } finally {
      if (mounted.current) setRunningCycle(false);
    }
  }, [hub, runningCycle, t]);

  const toggleCapability = useCallback(async (capability: AssistCapKey) => {
    if (!status || capabilityBusy) return;
    const next = !(optimistic[capability] ?? status.capabilities[capability]);
    setCapabilityBusy(true);
    setMessage(null);
    setOptimistic((held) => ({ ...held, [capability]: next }));
    try {
      await hub.setAssistCapability(capability, next);
    } catch (error: unknown) {
      if (mounted.current) setMessage({ failed: true, text: t('queueCenter.assist.toggleFailed', { reason: pcCaughtErrorMessage(error, t('queueCenter.assist.unreachable')) }) });
    } finally {
      if (mounted.current) {
        setOptimistic((held) => { const { [capability]: _settled, ...rest } = held; return rest; });
        setCapabilityBusy(false);
      }
    }
  }, [capabilityBusy, hub, optimistic, status, t]);

  if (!status) {
    return (
      <section className="pc-glass p-3 flex items-center gap-2 text-xs text-slate-500">
        <Handshake className="w-4 h-4 text-rose-400 shrink-0" />
        <span className="font-bold text-slate-600 dark:text-slate-300">{t('queueCenter.assist.title')}</span>
        <span className="truncate">{hub.error ? pcErrorCodeText(hub.error) : t('queueCenter.assist.loading')}</span>
        <button type="button" onClick={() => hub.refreshHub()} disabled={loading}
          className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-rose-500/10 text-rose-500 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </section>
    );
  }

  return (
    <section className="pc-glass p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Handshake className="w-4 h-4 text-rose-400 shrink-0" />
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('queueCenter.assist.title')}</span>
        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
          status.enabled ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400'}`}>
          {status.enabled ? t('queueCenter.assist.enabled') : t('queueCenter.assist.disabled')}
        </span>
        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
          status.running ? 'bg-sky-500/15 text-sky-500' : 'bg-slate-500/15 text-slate-400'}`}>
          {status.running ? t('queueCenter.assist.workersActive') : t('queueCenter.assist.workersIdle')}
        </span>
        {status.endpoint?.base_url && (
          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[18rem]"
            title={status.endpoint.base_url}>→ {status.endpoint.base_url}</span>
        )}
        {liveSyncOffline && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500">
            <WifiOff className="w-3 h-3" /> {t('queueCenter.assist.liveSyncPaused')}
          </span>
        )}
        {workerMismatch && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500"
            title={`${hub.workerApiUrl} → ${hub.laravelActiveEndpoint}`}>
            <AlertTriangle className="w-3 h-3" />
            {t('queueCenter.endpointMismatch')}
          </span>
        )}
        {endpointMismatch && !workerMismatch && (
          <span className="text-[10px] font-mono text-sky-500 truncate max-w-[18rem]"
            title={t('queueCenter.assist.selectedActive', { selected: hub.laravelStoredEndpoint, active: hub.laravelActiveEndpoint })}>
            {t('queueCenter.assist.activeEndpoint', { active: hub.laravelActiveEndpoint })}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={runCycle} disabled={!status.enabled || runningCycle}
            title={t('queueCenter.assist.runWorkersTitle')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold pc-glass text-rose-500 disabled:opacity-50">
            {runningCycle
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Play className="w-3.5 h-3.5" />}
            {t('queueCenter.assist.runWorkers')}
          </button>
          <button type="button" onClick={() => hub.refreshHub()} disabled={loading}
            className="p-1.5 rounded-lg pc-glass text-rose-500 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
          {t('queueCenter.assist.capabilities')}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {ADVANCED_CAPABILITIES.map((capability) => {
            const on = Boolean(optimistic[capability] ?? status.capabilities[capability]);
            return (
              <button type="button" key={capability}
                onClick={() => void toggleCapability(capability)} disabled={capabilityBusy}
                title={t(`queueCenter.assist.cap.${capability}` as const)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold disabled:opacity-50 ${
                  on ? 'bg-emerald-500/15 text-emerald-500' : 'pc-glass text-slate-500'}`}>
                {on ? <Check className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                <span className="truncate">{t(`queueCenter.assist.cap.${capability}` as const)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {message && (
        <p className={`text-[11px] ${message.failed ? 'text-rose-500' : 'text-slate-500'}`}>
          {message.failed && <AlertTriangle className="w-3 h-3 inline mr-1" />}
          {message.text}
        </p>
      )}
    </section>
  );
};

export default PcAssistStrip;
