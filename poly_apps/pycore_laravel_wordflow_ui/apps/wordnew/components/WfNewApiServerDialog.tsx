/**
 * WfNewApiServerDialog — full backend-endpoint management + test page.
 *
 * Opened from the compact summary card in Settings. Renders through the shared
 * <Portal/> + OVERLAY_Z scale (the project's overlay framework — never a raw
 * `fixed inset-0 z-50`), reacts to the endpoint store via `useWfNewEndpoints`,
 * and surfaces results through the global `notify` toast system.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Server, RefreshCw, Check, Plus, Trash2, Wifi, WifiOff, X, Activity } from 'lucide-react';
import Portal from '../../../components/shared/Portal';
import { OVERLAY_Z, OVERLAY_CONTAINER, OVERLAY_BACKDROP } from '../../../styles/overlay';
import { notify } from '../../../core/notify/notify';
import { ElementTheme } from '../WfNewTypes';
import { wfNewApi, wfNewEndpoints, useWfNewEndpoints, WFNEW_API_PORT } from '../api';

interface WfNewApiServerDialogProps {
  open: boolean;
  onClose: () => void;
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WfNewApiServerDialog: React.FC<WfNewApiServerDialogProps> = ({ open, onClose, activeTheme, trans }) => {
  const { endpoints, health, currentId, testing } = useWfNewEndpoints();

  const [newHost, setNewHost] = useState('');
  const [newPort, setNewPort] = useState<number>(WFNEW_API_PORT);
  const [probe, setProbe] = useState<{ running: boolean; text: string; ok: boolean | null }>({ running: false, text: '', ok: null });

  // Make sure detection has run at least once when the dialog opens.
  useEffect(() => {
    if (open) void wfNewEndpoints.initialize();
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleTestAll = useCallback(async () => {
    const ok = await wfNewEndpoints.testAll();
    if (ok) notify.success(trans('api.toastHealthy'));
    else notify.warning(trans('api.toastNoneReachable'));
  }, [trans]);

  const handleUse = useCallback((id: string) => {
    if (wfNewEndpoints.setEndpoint(id)) notify.info(trans('api.toastSelected'));
  }, [trans]);

  const handleAdd = useCallback(() => {
    const host = newHost.trim();
    if (!host) { notify.warning(trans('api.toastEnterHost')); return; }
    wfNewEndpoints.addCustomEndpoint({ url: host, port: newPort || WFNEW_API_PORT });
    setNewHost('');
    setNewPort(WFNEW_API_PORT);
    notify.success(trans('api.toastAdded', { target: `${host}:${newPort || WFNEW_API_PORT}` }));
    void wfNewEndpoints.recheckAndFailover();
  }, [newHost, newPort, trans]);

  const handleRemove = useCallback((id: string) => {
    wfNewEndpoints.removeCustomEndpoint(id);
    notify.info(trans('api.toastRemoved'));
    void wfNewEndpoints.recheckAndFailover();
  }, [trans]);

  // Test page: probe the current endpoint's health, then a real data call.
  const handleRunProbe = useCallback(async () => {
    const ep = wfNewEndpoints.getCurrentEndpoint();
    if (!ep) { setProbe({ running: false, text: trans('api.probeNoEp'), ok: false }); return; }
    setProbe({ running: true, text: trans('api.probing', { target: `${ep.url}:${ep.port ?? ''}` }), ok: null });
    const h = await wfNewEndpoints.checkEndpoint(ep);
    if (!h.isHealthy) {
      setProbe({ running: false, ok: false, text: trans('api.probeOffline', { err: h.error ?? 'error', ms: h.responseTime }) });
      return;
    }
    try {
      const groups = await wfNewApi.getWordGroups();
      setProbe({ running: false, ok: true, text: trans('api.probeOk', { ms: h.responseTime, n: groups.length }) });
    } catch (e: any) {
      setProbe({ running: false, ok: false, text: trans('api.probeDataFail', { ms: h.responseTime, msg: e?.message ?? 'error' }) });
    }
  }, [trans]);

  if (!open) return null;

  return (
    <Portal>
      <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal}`}>
        <div className={`absolute inset-0 ${OVERLAY_BACKDROP}`} onClick={onClose} />

        <div className={`relative w-full max-w-2xl max-h-[88vh] overflow-y-auto no-scrollbar rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl ${
          activeTheme.id === 'nordic' ? 'bg-white text-slate-800' : 'bg-slate-900 text-slate-100'
        }`}>
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-white/10 backdrop-blur bg-inherit rounded-t-3xl">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base font-extrabold tracking-tight">{trans('api.dialogTitle')}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTestAll}
                disabled={testing}
                className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full border border-indigo-500/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                {testing ? trans('api.testing') : trans('api.testSelect')}
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-500/10" title={trans('api.close')}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono leading-relaxed">
              {trans('api.autoDesc')}
            </p>

            {/* Endpoint list */}
            <div className="space-y-2">
              {endpoints.map((ep) => {
                const h = health[ep.id];
                const isCurrent = ep.id === currentId;
                const healthy = h?.isHealthy === true;
                const probed = h !== undefined;
                return (
                  <div
                    key={ep.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                      isCurrent ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/2'
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <span
                        className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                          !probed ? 'bg-zinc-400/10 text-zinc-400' : healthy ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                        }`}
                        title={!probed ? trans('api.notTested') : healthy ? trans('api.healthyTitle', { ms: h?.responseTime ?? 0 }) : trans('api.offlineTitle', { err: h?.error ?? 'error' })}
                      >
                        {healthy || !probed ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-bold truncate">
                          {ep.protocol}://{ep.url}{ep.port ? `:${ep.port}` : ''}
                          {isCurrent && <span className="ml-2 text-[9px] uppercase text-indigo-500">{trans('api.inUse')}</span>}
                        </p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                          {ep.description}{probed ? ` · ${healthy ? `${h?.responseTime}ms` : (h?.error ?? 'offline')}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isCurrent && (
                        <button
                          onClick={() => handleUse(ep.id)}
                          className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase bg-white/5 hover:bg-indigo-500/15 text-indigo-500 px-2.5 py-1.5 rounded-lg border border-indigo-500/20 transition-all"
                        >
                          <Check className="w-3 h-3" /> {trans('api.use')}
                        </button>
                      )}
                      {ep.custom && (
                        <button onClick={() => handleRemove(ep.id)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-all" title={trans('api.removeTitle')}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add custom endpoint */}
            <div className="pt-1 border-t border-slate-200 dark:border-white/5 space-y-2">
              <label className="text-[11px] font-black font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                {trans('api.addCustom')}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text" value={newHost} onChange={(e) => setNewHost(e.target.value)}
                  placeholder={trans('api.phHost')}
                  className={`flex-1 py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none ${activeTheme.inputClass}`}
                />
                <input
                  type="number" value={newPort} onChange={(e) => setNewPort(parseInt(e.target.value, 10) || WFNEW_API_PORT)}
                  placeholder={trans('api.phPort')}
                  className={`w-full sm:w-24 py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none ${activeTheme.inputClass}`}
                />
                <button onClick={handleAdd} className="flex items-center justify-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl transition-all">
                  <Plus className="w-3.5 h-3.5" /> {trans('api.add')}
                </button>
              </div>
            </div>

            {/* Test page */}
            <div className="pt-1 border-t border-slate-200 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                  {trans('api.testPage')}
                </label>
                <button
                  onClick={handleRunProbe}
                  disabled={probe.running}
                  className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20 transition-all disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 ${probe.running ? 'animate-pulse' : ''}`} />
                  {probe.running ? trans('api.running') : trans('api.runTest')}
                </button>
              </div>
              <div className={`p-3 rounded-xl text-[11px] font-mono leading-relaxed border ${
                probe.ok === null ? 'border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/2 text-zinc-500'
                  : probe.ok ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                  : 'border-rose-500/30 bg-rose-500/5 text-rose-500'
              }`}>
                {probe.text || trans('api.probeHint')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};
