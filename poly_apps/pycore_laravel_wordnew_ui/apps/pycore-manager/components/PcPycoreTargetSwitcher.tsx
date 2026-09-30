/**
 * PcPycoreTargetSwitcher - header control to point the WHOLE pycore-manager at a
 * chosen pycore node and manage that client.
 *
 * Endpoints (pycoreTarget, explicit kinds):
 *   - This machine: direct :59000, only on a loopback page (K7a).
 *   - Tailnet machines: every live Tailscale machine (discovered, never
 *     static) through its 175 `https://<machine>.ts.net/pycore` mount.
 *   - Relay (https entry): requests ride the paired machine
 *     (PycoreLaravelRelayTransport) and the Relay-scoped roster link offers
 *     machine designation below.
 * Every row shows its backend's live probe (PycoreEndpointProbe); a switch
 * happens only after the chosen backend answers, then the page reloads so the
 * entire UI manages that node. The chip shows the active endpoint's health.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, ChevronDown, Check, Plus, MonitorSmartphone, Radio, Users, AlertTriangle, RefreshCw, Network } from 'lucide-react';
import {
  getPycoreTarget, listPycoreEndpoints, setPycoreTarget, isPycoreRelayMode, isPycoreDirectAccessAllowed,
  normalizePycoreBackendUrl, classifyPycoreBackendUrl,
  getPycoreProbe, probePycoreEndpoint, probePycoreEndpoints, subscribePycoreProbes,
  refreshTailnetPeers, subscribeTailnetPeers,
  getPycoreHealth, PYCORE_HEALTH_EVENT,
  designateLaravelRelayDevice, laravelRelayDeviceId, clearLaravelRelayDevice,
  subscribeLaravelRelayDevice,
  type PycoreEndpoint, type PycoreProbeResult, type PycoreTarget,
} from '@/apps/pycore-manager/api';
import { laravelApi, laravelRelayRoster, type RelayRosterEntry } from '@/core/integrations/laravel';
import { relayCapabilityProviders } from '@/core/contracts/RelayCapabilities';
import { PYCORE_HTTP_PORT } from '@/apps/pycore-manager/api';

interface Props {
  variant?: 'header' | 'block';
}

const SWITCH_PROBE_TIMEOUT_MS = 8_000;

const PROBE_DOT: Record<string, string> = {
  up: 'bg-emerald-500',
  probing: 'bg-amber-400 animate-pulse',
  down: 'bg-rose-500',
  rejected: 'bg-rose-500',
  no_route: 'bg-amber-500',
  relay: 'bg-sky-500',
  unknown: 'bg-slate-400',
};

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export const PcPycoreTargetSwitcher: React.FC<Props> = ({ variant = 'header' }) => {
  const { t } = useTranslation('pc');
  const target = getPycoreTarget();           // read once; switching reloads anyway
  const relayMode = isPycoreRelayMode();
  const directAllowed = isPycoreDirectAccessAllowed();

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [endpoints, setEndpoints] = useState<PycoreEndpoint[]>(() => listPycoreEndpoints());
  const [probes, setProbes] = useState<Record<string, PycoreProbeResult | null>>({});
  const [health, setHealth] = useState(getPycoreHealth());
  const [switching, setSwitching] = useState('');
  const [notice, setNotice] = useState('');
  const [roster, setRoster] = useState<RelayRosterEntry[]>([]);
  const [designated, setDesignated] = useState<string | null>(laravelRelayDeviceId());
  const [claimCode, setClaimCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimNotice, setClaimNotice] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  const activeEndpoint = endpoints.find((endpoint) => endpoint.url === target.url);
  const label = activeEndpoint?.label || hostOf(target.url);

  const readProbes = useCallback((list: PycoreEndpoint[]) => {
    setProbes(Object.fromEntries(list.map((endpoint) => [endpoint.url, getPycoreProbe(endpoint.url)])));
  }, []);

  const recheckAll = useCallback(() => {
    void refreshTailnetPeers().then(() => {
      const list = listPycoreEndpoints();
      setEndpoints(list);
      readProbes(list);
      void probePycoreEndpoints(list);
    });
  }, [readProbes]);

  // Active endpoint health (chip dot + identity line).
  useEffect(() => {
    const onHealth = () => setHealth(getPycoreHealth());
    window.addEventListener(PYCORE_HEALTH_EVENT, onHealth);
    return () => window.removeEventListener(PYCORE_HEALTH_EVENT, onHealth);
  }, []);

  // Probe table and live tailnet list keep every row in step with its backend.
  useEffect(() => {
    const stopProbes = subscribePycoreProbes((probeUrl, result) => {
      setProbes((previous) => ({ ...previous, [probeUrl]: result }));
    });
    const stopPeers = subscribeTailnetPeers(() => setEndpoints(listPycoreEndpoints()));
    void refreshTailnetPeers();
    return () => {
      stopProbes();
      stopPeers();
    };
  }, []);

  useEffect(() => {
    if (open) recheckAll();
  }, [open, recheckAll]);

  // Relay-only roster link: registry truth + presence deltas (PART_3 §3.4).
  useEffect(() => {
    if (!relayMode) {
      setRoster([]);
      return undefined;
    }
    const stop = laravelRelayRoster.onChange((entries) => {
      setRoster(entries);
      const preferredDeviceId = laravelRelayRoster.preferredDeviceId();
      if (!laravelRelayDeviceId() && preferredDeviceId) {
        void designateLaravelRelayDevice(preferredDeviceId)
          .catch(() => undefined);
      }
    });
    const stopSelection = subscribeLaravelRelayDevice(setDesignated);
    laravelRelayRoster.start();
    setRoster(laravelRelayRoster.list());
    return () => {
      stop();
      stopSelection();
      laravelRelayRoster.stop();
    };
  }, [relayMode]);

  // Close the popover on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  /** Switch only to a backend that answers now (relay entries: roster decides). */
  const switchTo = (next: PycoreTarget) => {
    if (switching) return;
    setNotice('');
    if (next.url === target.url) return;
    if (next.kind === 'relay') {
      if (!setPycoreTarget(next.url)) setNotice(t('pycoreTarget.rejected'));
      return;
    }
    setSwitching(next.url);
    void probePycoreEndpoint(next, SWITCH_PROBE_TIMEOUT_MS).then((result) => {
      setSwitching('');
      if (result.state !== 'up') {
        setNotice(t('pycoreTarget.switchBlocked', { host: hostOf(next.url), state: t(`pycoreTarget.state.${result.state}`) }));
        return;
      }
      if (!setPycoreTarget(next.url)) setNotice(t('pycoreTarget.rejected'));
    });
  };

  const goUrl = (input: string) => {
    const normalized = normalizePycoreBackendUrl(input);
    const kind = normalized ? classifyPycoreBackendUrl(normalized) : null;
    if (!normalized || !kind) {
      setNotice(t('pycoreTarget.rejected'));
      return;
    }
    switchTo({ kind, url: normalized });
  };

  const designate = (machineId: string) => {
    void designateLaravelRelayDevice(machineId)
      .then((pair) => setDesignated(pair.device_id))
      .catch(() => undefined); // roster stays; the pair badge explains the failure
  };
  const undesignate = () => {
    void clearLaravelRelayDevice()
      .then(() => setDesignated(null))
      .catch(() => undefined);
  };
  const claimEnrollment = () => {
    const code = claimCode.trim();
    if (!code || claiming) return;
    setClaiming(true);
    setClaimNotice('');
    void laravelApi.relayClaimEnrollment(code)
      .then(async (device) => {
        setClaimCode('');
        setClaimNotice(t('relayTarget.enrollmentSuccess'));
        await laravelRelayRoster.refresh(true);
        const pairing = await designateLaravelRelayDevice(device.device_id);
        setDesignated(pairing.device_id);
      })
      .catch(() => setClaimNotice(t('relayTarget.enrollmentFailed')))
      .finally(() => setClaiming(false));
  };

  const onlineMachines = roster.filter((entry) => entry.online);
  const providers = relayCapabilityProviders();
  const thisMachine = endpoints.filter((endpoint) => endpoint.source === 'this_machine');
  const tailnet = endpoints.filter((endpoint) => endpoint.source === 'tailnet');
  const relays = endpoints.filter((endpoint) => endpoint.kind === 'relay');
  const recent = endpoints.filter((endpoint) => endpoint.source === 'recent' || (endpoint.source === 'host_key' && endpoint.kind !== 'relay'));
  const healthDot = health.up === true ? PROBE_DOT.up : health.up === false ? PROBE_DOT.down
    : health.reachability === 'probing' ? PROBE_DOT.probing : PROBE_DOT.unknown;

  const chipIcon = target.kind === 'relay' ? <Radio className="w-3.5 h-3.5" />
    : target.kind === 'proxy' ? <Network className="w-3.5 h-3.5" />
      : <MonitorSmartphone className="w-3.5 h-3.5" />;

  const probeText = (endpoint: PycoreEndpoint, probe: PycoreProbeResult | null): string => {
    if (switching === endpoint.url) return t('pycoreTarget.switching');
    if (endpoint.kind === 'relay') return t('pycoreTarget.state.relay');
    if (!probe) return endpoint.tailnetOnline === false ? t('pycoreTarget.tailnetOffline') : t('pycoreTarget.state.unknown');
    if (probe.state === 'up') {
      return t('pycoreTarget.stateUp', { ms: probe.ms ?? '-', host: probe.hostname || hostOf(endpoint.url) });
    }
    return t(`pycoreTarget.state.${probe.state}`);
  };

  const renderEndpoint = (endpoint: PycoreEndpoint) => {
    const probe = probes[endpoint.url] ?? null;
    const active = endpoint.url === target.url;
    const dot = switching === endpoint.url ? PROBE_DOT.probing
      : endpoint.kind === 'relay' ? PROBE_DOT.relay
        : PROBE_DOT[probe?.state ?? 'unknown'];
    const icon = endpoint.kind === 'relay' ? <Radio className="w-4 h-4 text-emerald-500" />
      : endpoint.kind === 'proxy' ? <Network className="w-4 h-4 text-sky-500" />
        : <MonitorSmartphone className="w-4 h-4 text-indigo-500" />;
    const kindTitle = t(`pycoreTarget.kind.${endpoint.kind}`);
    return (
      <button
        key={endpoint.url}
        onClick={() => switchTo(endpoint)}
        disabled={Boolean(switching)}
        title={`${kindTitle} · ${endpoint.url}`}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all disabled:cursor-wait ${
          active
            ? 'border-indigo-500 bg-indigo-500/5'
            : 'border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5'
        }`}
      >
        <span className="flex flex-col items-start text-slate-700 dark:text-slate-200 min-w-0">
          <span className="flex items-center gap-2 text-xs truncate">
            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
            {icon}
            <span className="truncate">
              {endpoint.source === 'relay_origin' ? t('pycoreTarget.relayOrigin') : endpoint.label}
            </span>
            {endpoint.tailnetSelf && (
              <span className="px-1 rounded text-[9px] font-bold uppercase bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                {t('pycoreTarget.selfBadge')}
              </span>
            )}
            {endpoint.os && <span className="text-[9px] font-mono text-slate-400">{endpoint.os}</span>}
          </span>
          <span className="text-[10px] font-mono text-slate-400 pl-4 truncate max-w-full">
            {hostOf(endpoint.url)} · {probeText(endpoint, probe)}
          </span>
        </span>
        {active && <Check className="w-4 h-4 text-indigo-500 shrink-0" />}
      </button>
    );
  };

  return (
    <div ref={rootRef} className={`relative ${variant === 'block' ? 'w-full' : ''}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={t('pycoreTarget.chipTitle')}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-mono font-bold transition-all ${
          relayMode
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : target.kind === 'proxy'
              ? 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400'
              : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${healthDot}`} />
        {chipIcon}
        <span className="max-w-[140px] truncate">pycore: {label}</span>
        {relayMode && (
          <span
            className={`px-1.5 rounded text-[9px] font-bold uppercase ${
              designated ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
            }`}
            title={designated ? t('pycoreTarget.pairedWith', { device: designated }) : t('pycoreTarget.noDesignation')}
          >
            {designated ? t('pycoreTarget.paired') : t('pycoreTarget.unpaired')}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 z-50 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-3 space-y-3 text-sm max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono uppercase tracking-wide text-slate-400">
            <span className="flex items-center gap-2"><Server className="w-3.5 h-3.5" /> {t('pycoreTarget.heading')}</span>
            <button
              onClick={recheckAll}
              title={t('pycoreTarget.recheck')}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-white/5 px-3 py-2 text-[10px] font-mono text-slate-500 dark:text-slate-400 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${healthDot}`} />
              <span className="truncate">{target.url}</span>
            </div>
            <div className="pl-4">
              {health.up === true
                ? t('pycoreTarget.activeUp', { host: health.hostname || '-', instance: (health.instanceId || '-').slice(0, 8), ms: health.responseTime ?? '-' })
                : t(`pycoreTarget.activeState.${health.reachability}`)}
            </div>
          </div>

          {(!directAllowed && target.kind === 'direct') && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{t('pycoreTarget.relayOnly')}</span>
            </div>
          )}
          {notice && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-[10px] leading-relaxed text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {thisMachine.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wide text-slate-400 px-1">{t('pycoreTarget.thisMachine')}</div>
              {thisMachine.map(renderEndpoint)}
            </div>
          )}

          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wide text-slate-400 px-1">{t('pycoreTarget.tailnetHeading')}</div>
            {tailnet.length > 0
              ? tailnet.map(renderEndpoint)
              : <p className="text-[10px] text-slate-400 leading-relaxed px-1">{t('pycoreTarget.tailnetEmpty')}</p>}
          </div>

          {relays.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wide text-slate-400 px-1">{t('pycoreTarget.relayHeading')}</div>
              {relays.map(renderEndpoint)}
            </div>
          )}

          {recent.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wide text-slate-400 px-1">{t('pycoreTarget.recent')}</div>
              {recent.map(renderEndpoint)}
            </div>
          )}

          {/* Relay scheme section: roster + designation (PART_3 §3.4). */}
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-white/5">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wide text-slate-400 px-1">
              <Users className="w-3.5 h-3.5" /> {t('relayTarget.machineCount', { count: onlineMachines.length })}
            </div>
            <div className="space-y-1 rounded-xl border border-slate-200 dark:border-white/5 p-2">
              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {t('relayTarget.enrollmentTitle')}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={claimCode}
                  onChange={(event) => setClaimCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') claimEnrollment();
                  }}
                  placeholder={t('relayTarget.enrollmentPlaceholder')}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-[10px] font-mono"
                />
                <button
                  onClick={claimEnrollment}
                  disabled={!claimCode.trim() || claiming}
                  className="rounded-lg bg-indigo-600 px-2 py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
                >
                  {claiming ? t('relayTarget.enrollmentClaiming') : t('relayTarget.enrollmentClaim')}
                </button>
              </div>
              {claimNotice && <p className="text-[10px] text-slate-500">{claimNotice}</p>}
            </div>
            {roster.length === 0 && (
              <p className="text-[10px] text-slate-400 leading-relaxed px-1">
                {t('relayTarget.rosterEmpty')}
              </p>
            )}
            {roster.map((entry) => {
              const isDesignated = designated === entry.device_id;
              return (
                <div
                  key={entry.device_id}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
                    isDesignated
                      ? 'border-emerald-500 bg-emerald-500/5'
                      : 'border-slate-200 dark:border-white/5'
                  }`}
                >
                  <span className="flex flex-col items-start text-slate-700 dark:text-slate-200 min-w-0">
                    <span className="flex items-center gap-2 text-xs truncate">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${entry.online ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        title={entry.online ? t('relayTarget.heartbeatFresh') : t('relayTarget.heartbeatStale')}
                      />
                      {entry.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 pl-4 truncate">
                      {entry.device_id} · {entry.online ? t('relayTarget.online') : t('relayTarget.offline')}
                    </span>
                  </span>
                  {isDesignated ? (
                    <button
                      onClick={undesignate}
                      className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                      title={t('relayTarget.dropDesignation')}
                    >
                      {t('relayTarget.paired')}
                    </button>
                  ) : (
                    <button
                      onClick={() => designate(entry.device_id)}
                      className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                      title={t('relayTarget.designate')}
                    >
                      {t('relayTarget.designate')}
                    </button>
                  )}
                </div>
              );
            })}
            {!relayMode && (
              <p className="text-[10px] text-slate-400 leading-relaxed px-1">
                {t('relayTarget.relayInfo')}
              </p>
            )}
            {relayMode && !designated && roster.length > 0 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-300 leading-relaxed px-1">
                {t('relayTarget.noMachineDesignated')}
              </p>
            )}
            {relayMode && designated && onlineMachines.length === 0 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-300 leading-relaxed px-1">
                {t('relayTarget.offlineQueued', { device: designated })}
              </p>
            )}
          </div>

          {/* Declared capability providers (rendered, NOT wired - PART_3 §3.1). */}
          {providers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {providers.map((provider) => (
                <span
                  key={provider.id}
                  title={t('pycoreTarget.providerTitle', {
                    providerClass: provider.providerClass,
                    provides: provider.provides.join(', ') || t('pycoreTarget.providerNothing'),
                    state: t(provider.implemented ? 'pycoreTarget.providerImplemented' : 'pycoreTarget.providerDeclared'),
                  })}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                    provider.implemented
                      ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                      : 'border-slate-300/60 dark:border-white/10 text-slate-400'
                  }`}
                >
                  {provider.id}
                </span>
              ))}
            </div>
          )}

          {/* Add / connect a backend */}
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-white/5">
            <label className="text-[10px] font-mono uppercase tracking-wide text-slate-400 block">
              {t('pycoreTarget.connectLabel')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') goUrl(url); }}
                placeholder={t(directAllowed ? 'pycoreTarget.connectPlaceholder' : 'pycoreTarget.connectPlaceholderRelay', { port: PYCORE_HTTP_PORT })}
                className="flex-1 py-2 px-3 text-xs font-mono rounded-lg outline-none bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              />
              <button
                onClick={() => goUrl(url)}
                disabled={Boolean(switching)}
                className="flex items-center gap-1 text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg disabled:opacity-40"
              >
                {switching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} {t('pycoreTarget.go')}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              {t('pycoreTarget.help', { port: PYCORE_HTTP_PORT })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PcPycoreTargetSwitcher;
