/**
 * PcNetworkRouterPage — status and control of the pycore machine's network router (NAT gateway):
 * service state, configuration, active links, ports, per relay port scopes (fair share, IP bindings), DHCP clients,
 * start/stop/restart, detailed status and logs.
 * Everything is read from pycore (ui/network_router/*); the shell CLI stays the only owner of the gateway logic.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Loader2, Play, RefreshCw, RotateCw, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { NetworkRouterAction, NetworkRouterConfig, NetworkRouterService, NetworkRouterStatus } from '@/apps/pycore-manager/api';
import { copyTextToSystemClipboard } from '../../../core/browser/SystemClipboard';
import { formatTimestamp } from '../../../core/utils/formatters';
import { PcLocalizedError, pcCaughtErrorMessage, pcErrorCodeText, pcFailureMessage } from '../utils/pcErrorCodes';

const POLL_MS = 5_000;
const COPIED_RESET_MS = 1_500;
const STOP_CONFIRM_MS = 4_000;
const MS_PER_SECOND = 1_000;
const SYSTEM_WAN_NONE = 'none';
const MODE_PAIRS = 'pairs';
const DHCP_OFF = 'no';
const SETTING_YES = 'yes';
const UNSET_NUMBER = '0';
const RUNNING_STATE = 'running';
const ABSENT_STATE = 'absent';

const stateClass = (state: string): string => {
  if (state === RUNNING_STATE) return 'text-emerald-600 dark:text-emerald-400';
  return state === ABSENT_STATE ? 'text-slate-400' : 'text-amber-600 dark:text-amber-400';
};

const CopyValue: React.FC<{ value: string }> = ({ value }) => {
  const { t } = useTranslation('pc');
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    if (!(await copyTextToSystemClipboard(value))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }, [value]);
  return (
    <div className="flex items-start gap-2">
      <code className="flex-1 break-all rounded-xl bg-slate-500/10 px-3 py-2 text-xs font-mono">{value}</code>
      <button type="button" onClick={copy} disabled={!value}
        className="shrink-0 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs pc-glass disabled:opacity-40">
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? t('networkRouter.copied') : t('networkRouter.copy')}
      </button>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-0.5 min-w-0">
    <p className="text-[11px] text-slate-500">{label}</p>
    <div className="text-sm break-words">{children}</div>
  </div>
);

const ServiceState: React.FC<{ service: NetworkRouterService | null }> = ({ service }) => {
  const { t } = useTranslation('pc');
  if (!service) return <span className="text-slate-400">-</span>;
  return <span className={`font-semibold ${stateClass(service.state)}`}>{t(`networkRouter.state.${service.state}`)}</span>;
};

const ConfigSection: React.FC<{ status: NetworkRouterStatus }> = ({ status }) => {
  const { t } = useTranslation('pc');
  const config: NetworkRouterConfig | null = status.config;
  const orAuto = (value?: string) => value || t('networkRouter.config.auto');
  return (
    <section className="pc-glass p-4 space-y-3">
      <h2 className="text-sm font-semibold">{t('networkRouter.config.title')}</h2>
      {!config && <p className="text-xs text-slate-500">{t('networkRouter.config.missing')}</p>}
      {config && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('networkRouter.config.mode')}>
            {config.ROUTE_MODE === MODE_PAIRS ? t('networkRouter.config.modePairs') : t('networkRouter.config.modeSingle')}
          </Field>
          {config.ROUTE_MODE === MODE_PAIRS ? (
            <>
              <Field label={t('networkRouter.config.pairs')}>{orAuto(config.PAIRS)}</Field>
              <Field label={t('networkRouter.config.lanMap')}>{orAuto(config.LAN_MAP)}</Field>
              <Field label={t('networkRouter.config.systemWan')}>{config.SYSTEM_WAN === SYSTEM_WAN_NONE ? t('networkRouter.config.none') : orAuto(config.SYSTEM_WAN)}</Field>
            </>
          ) : (
            <>
              <Field label={t('networkRouter.config.uplink')}>{orAuto(config.WAN_SELECT)}</Field>
              <Field label={t('networkRouter.config.relayMode')}>
                {config.LAN_MODE === 'one' && t('networkRouter.config.relayOne')}
                {config.LAN_MODE === 'list' && t('networkRouter.config.relayList')}
                {config.LAN_MODE !== 'one' && config.LAN_MODE !== 'list' && t('networkRouter.config.relayAll')}
                {config.LAN_PORTS ? ` (${config.LAN_PORTS})` : ''}
              </Field>
            </>
          )}
          <Field label={t('networkRouter.config.address')}>{config.LAN_ADDRESS}</Field>
          <Field label={t('networkRouter.config.dhcp')}>{config.DHCP_ENABLED === DHCP_OFF ? t('networkRouter.overview.off') : t('networkRouter.overview.on')}</Field>
        </div>
      )}
      <Field label={t('networkRouter.config.file')}><span className="font-mono text-xs">{status.config_file}</span></Field>
    </section>
  );
};

const LinksSection: React.FC<{ status: NetworkRouterStatus }> = ({ status }) => {
  const { t } = useTranslation('pc');
  return (
    <section className="pc-glass p-4 space-y-3">
      <h2 className="text-sm font-semibold">{t('networkRouter.links.title')}</h2>
      {status.links.length === 0 && <p className="text-xs text-slate-500">{t('networkRouter.links.empty')}</p>}
      <ul className="space-y-2">
        {status.links.map((link) => (
          <li key={link.bridge} className="rounded-xl bg-slate-500/5 p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <Field label={link.bridge}>
              <span className={link.state === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                {t(`networkRouter.links.${link.state}`)}
              </span>
            </Field>
            <Field label={t('networkRouter.links.uplink')}><span className="font-mono">{link.uplink || '-'}</span></Field>
            <Field label={t('networkRouter.links.relay')}><span className="font-mono">{link.relay.join(', ') || '-'}</span></Field>
            <Field label={t('networkRouter.links.address')}><span className="font-mono">{link.address}</span></Field>
            <p className="text-[11px] text-slate-500 sm:col-span-2 lg:col-span-4">
              {link.host_uplink ? t('networkRouter.links.hostUplink') : ''}
              {link.host_uplink && link.dhcp_running ? ' · ' : ''}
              {link.dhcp_running ? t('networkRouter.links.dhcpRunning') : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};

const LanScopesSection: React.FC<{ status: NetworkRouterStatus }> = ({ status }) => {
  const { t } = useTranslation('pc');
  const scopes = status.lan_scopes ?? [];
  if (scopes.length === 0) return null;
  const onOff = (value: string) => (value === SETTING_YES ? t('networkRouter.overview.on') : t('networkRouter.overview.off'));
  const rate = (value: string) => (value === UNSET_NUMBER ? t('networkRouter.scopes.unshaped') : t('networkRouter.scopes.mbit', { value }));
  return (
    <section className="pc-glass p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{t('networkRouter.scopes.title')}</h2>
        <p className="text-[11px] text-slate-500">{t('networkRouter.scopes.hint')}</p>
      </div>
      <ul className="space-y-2">
        {scopes.map((scope) => (
          <li key={scope.scope} className="rounded-xl bg-slate-500/5 p-3 space-y-2 text-sm">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Field label={scope.scope}><span className="font-mono">{scope.port}</span></Field>
              <Field label={t('networkRouter.scopes.fairShare')}>{onOff(scope.settings.FAIR_SHARE)}</Field>
              <Field label={t('networkRouter.scopes.bandwidthDown')}>{rate(scope.settings.BANDWIDTH_DOWN)}</Field>
              <Field label={t('networkRouter.scopes.bandwidthUp')}>{rate(scope.settings.BANDWIDTH_UP)}</Field>
              <Field label={t('networkRouter.scopes.connLimit')}>
                {scope.settings.HOST_CONN_LIMIT === UNSET_NUMBER ? t('networkRouter.overview.off') : scope.settings.HOST_CONN_LIMIT}
              </Field>
              <Field label={t('networkRouter.scopes.autoBind')}>{onOff(scope.settings.AUTO_BIND)}</Field>
            </div>
            {scope.bindings.length === 0 && <p className="text-xs text-slate-500">{t('networkRouter.scopes.noBindings')}</p>}
            {scope.bindings.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1 pr-3">{t('networkRouter.leases.ip')}</th>
                      <th className="py-1 pr-3">{t('networkRouter.leases.mac')}</th>
                      <th className="py-1 pr-3">{t('networkRouter.leases.host')}</th>
                      <th className="py-1 pr-3">{t('networkRouter.scopes.source')}</th>
                      <th className="py-1">{t('networkRouter.scopes.boundAt')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-500/10">
                    {scope.bindings.map((binding) => (
                      <tr key={binding.mac}>
                        <td className="py-1.5 pr-3 font-mono">{binding.ip}</td>
                        <td className="py-1.5 pr-3 font-mono">{binding.mac}</td>
                        <td className="py-1.5 pr-3">{binding.host}</td>
                        <td className="py-1.5 pr-3">{t(`networkRouter.scopes.${binding.source}`)}</td>
                        <td className="py-1.5">{formatTimestamp(Number(binding.bound_at) * MS_PER_SECOND)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

const InterfacesSection: React.FC<{ status: NetworkRouterStatus }> = ({ status }) => {
  const { t } = useTranslation('pc');
  if (status.interfaces.length === 0) return null;
  return (
    <section className="pc-glass p-4 space-y-3">
      <h2 className="text-sm font-semibold">{t('networkRouter.interfaces.title')}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1 pr-3">{t('networkRouter.interfaces.name')}</th>
              <th className="py-1 pr-3">{t('networkRouter.interfaces.bus')}</th>
              <th className="py-1 pr-3">{t('networkRouter.interfaces.media')}</th>
              <th className="py-1 pr-3">{t('networkRouter.interfaces.link')}</th>
              <th className="py-1 pr-3">{t('networkRouter.interfaces.ipv4')}</th>
              <th className="py-1">{t('networkRouter.interfaces.role')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-500/10">
            {status.interfaces.map((port) => (
              <tr key={port.name}>
                <td className="py-1.5 pr-3 font-mono">{port.name}</td>
                <td className="py-1.5 pr-3">{t(`networkRouter.interfaces.${port.kind}`)}</td>
                <td className="py-1.5 pr-3">{t(`networkRouter.interfaces.${port.media}`)}</td>
                <td className={`py-1.5 pr-3 ${port.link_up ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                  {port.link_up ? t('networkRouter.interfaces.up') : t('networkRouter.interfaces.down')}
                </td>
                <td className="py-1.5 pr-3 font-mono">{port.ipv4.join(', ') || '-'}</td>
                <td className="py-1.5">
                  {port.role ? t(`networkRouter.interfaces.${port.role}`, { bridge: port.bridge }) : t('networkRouter.interfaces.unused')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const LeasesSection: React.FC<{ status: NetworkRouterStatus }> = ({ status }) => {
  const { t } = useTranslation('pc');
  if (status.platform !== 'linux') return null;
  const boundMacs = new Set((status.lan_scopes ?? []).flatMap((scope) => scope.bindings.map((binding) => binding.mac)));
  return (
    <section className="pc-glass p-4 space-y-3">
      <h2 className="text-sm font-semibold">{t('networkRouter.leases.title')}</h2>
      {status.leases.length === 0 && <p className="text-xs text-slate-500">{t('networkRouter.leases.empty')}</p>}
      {status.leases.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1 pr-3">{t('networkRouter.leases.ip')}</th>
                <th className="py-1 pr-3">{t('networkRouter.leases.mac')}</th>
                <th className="py-1 pr-3">{t('networkRouter.leases.host')}</th>
                <th className="py-1 pr-3">{t('networkRouter.leases.bridge')}</th>
                <th className="py-1 pr-3">{t('networkRouter.leases.bound')}</th>
                <th className="py-1">{t('networkRouter.leases.expires')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-500/10">
              {status.leases.map((lease) => (
                <tr key={`${lease.bridge}-${lease.mac}`}>
                  <td className="py-1.5 pr-3 font-mono">{lease.ip}</td>
                  <td className="py-1.5 pr-3 font-mono">{lease.mac}</td>
                  <td className="py-1.5 pr-3">{lease.host}</td>
                  <td className="py-1.5 pr-3 font-mono">{lease.bridge}</td>
                  <td className="py-1.5 pr-3">{boundMacs.has(lease.mac) ? t('networkRouter.overview.yes') : t('networkRouter.overview.no')}</td>
                  <td className="py-1.5">{formatTimestamp(Number(lease.expires) * MS_PER_SECOND)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

/** A text block loaded only while expanded (the detailed CLI status, the service logs). */
const LazyText: React.FC<{ showKey: string; hideKey: string; loadingKey: string; load: () => Promise<string> }> = ({ showKey, hideKey, loadingKey, load }) => {
  const { t } = useTranslation('pc');
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      setText(await load());
    } catch (caught) {
      setError(pcCaughtErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }, [load]);
  useEffect(() => { if (expanded) void refresh(); }, [expanded, refresh]);
  return (
    <section className="pc-glass p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}
          className="inline-flex items-center gap-1 text-sm font-semibold">
          <ChevronDown size={14} className={`transition ${expanded ? 'rotate-180' : ''}`} />
          {t(expanded ? hideKey : showKey)}
        </button>
        {expanded && (
          <button type="button" onClick={() => void refresh()} disabled={busy}
            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs pc-glass disabled:opacity-40">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {t('networkRouter.refresh')}
          </button>
        )}
      </div>
      {expanded && busy && !text && <p className="text-xs text-slate-500">{t(loadingKey)}</p>}
      {expanded && error && <p className="text-xs text-rose-500">{error}</p>}
      {expanded && text && <pre className="max-h-96 overflow-auto rounded-xl bg-slate-500/10 p-3 text-[11px] font-mono whitespace-pre-wrap break-all">{text}</pre>}
    </section>
  );
};

const PcNetworkRouterPage: React.FC = () => {
  const { t } = useTranslation('pc');
  const [status, setStatus] = useState<NetworkRouterStatus | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busyAction, setBusyAction] = useState<NetworkRouterAction | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmStop, setConfirmStop] = useState(false);
  const busyRef = useRef(false);
  const confirmTimerRef = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    try {
      const next = await pycoreApi.getNetworkRouterStatus();
      if (next.success) {
        setStatus(next);
        setLoadError('');
      } else {
        setLoadError(pcFailureMessage(next));
      }
    } catch (caught) {
      setLoadError(pcCaughtErrorMessage(caught));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(confirmTimerRef.current);
    };
  }, [refresh]);

  const run = useCallback(async (action: NetworkRouterAction) => {
    busyRef.current = true;
    setBusyAction(action);
    setActionNote('');
    setActionError('');
    try {
      const result = await pycoreApi.controlNetworkRouter(action);
      if (result.success) {
        setActionNote(t('networkRouter.actions.done', { action: t(`networkRouter.actions.${action}`) }));
        if (result.state) setStatus(result.state);
      } else {
        setActionError(pcFailureMessage(result));
      }
    } catch (caught) {
      setActionError(pcCaughtErrorMessage(caught));
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  }, [t]);

  const requestStop = useCallback(() => {
    if (!confirmStop) {
      setConfirmStop(true);
      window.clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = window.setTimeout(() => setConfirmStop(false), STOP_CONFIRM_MS);
      return;
    }
    window.clearTimeout(confirmTimerRef.current);
    setConfirmStop(false);
    void run('stop');
  }, [confirmStop, run]);

  const loadReport = useCallback(async () => {
    const result = await pycoreApi.getNetworkRouterStatus(true);
    if (!result.success) throw new PcLocalizedError(pcFailureMessage(result));
    if (result.report_error_code) throw new PcLocalizedError(pcErrorCodeText(result.report_error_code));
    return result.report ?? '';
  }, []);

  const loadLogs = useCallback(async () => {
    const result = await pycoreApi.getNetworkRouterLogs();
    if (!result.success) throw new PcLocalizedError(pcFailureMessage(result));
    return (result.lines ?? []).join('\n') || t('networkRouter.logs.empty');
  }, [t]);

  const controlsBusy = busyAction !== null;
  const running = status?.service.state === RUNNING_STATE;

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('networkRouter.title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{t('networkRouter.subtitle')}</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={controlsBusy}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs pc-glass disabled:opacity-40">
          <RefreshCw size={14} />{t('networkRouter.refresh')}
        </button>
      </div>

      {!status && !loadError && <p className="text-sm text-slate-500">{t('networkRouter.loading')}</p>}
      {loadError && <p className="text-sm text-rose-500">{loadError}</p>}

      {status && !status.supported && (
        <section className="pc-glass p-4 text-sm" role="status">{t(`networkRouter.unsupported.${status.unsupported_code}`)}</section>
      )}

      {status && status.supported && !status.installed && (
        <section className="pc-glass p-4 space-y-3" role="status">
          <h2 className="text-sm font-semibold">{t('networkRouter.notInstalled.title')}</h2>
          <p className="text-xs text-slate-500">{t('networkRouter.notInstalled.hint')}</p>
          <p className="text-xs text-slate-500">{status.install_flag ? t('networkRouter.notInstalled.flagOn') : t('networkRouter.notInstalled.flagOff')}</p>
          <div className="space-y-1">
            <p className="text-[11px] text-slate-500">{t('networkRouter.notInstalled.command')}</p>
            <CopyValue value={status.install_command} />
          </div>
        </section>
      )}

      {status && status.supported && status.installed && (
        <>
          <section className="pc-glass p-4 space-y-3">
            <h2 className="text-sm font-semibold">{t('networkRouter.overview.title')}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t('networkRouter.overview.service')}><ServiceState service={status.service} /></Field>
              {status.diag_service && (
                <Field label={t('networkRouter.overview.diagService')}><ServiceState service={status.diag_service} /></Field>
              )}
              {status.service.enabled !== null && (
                <Field label={t('networkRouter.overview.enabled')}>{status.service.enabled ? t('networkRouter.overview.yes') : t('networkRouter.overview.no')}</Field>
              )}
              {status.forwarding !== null && (
                <Field label={t('networkRouter.overview.forwarding')}>{status.forwarding ? t('networkRouter.overview.on') : t('networkRouter.overview.off')}</Field>
              )}
              {status.dhcp_running !== null && (
                <Field label={t('networkRouter.overview.dhcp')}>{status.dhcp_running ? t('networkRouter.overview.on') : t('networkRouter.overview.off')}</Field>
              )}
              <Field label={t('networkRouter.overview.installFlag')}>{status.install_flag ? t('networkRouter.overview.on') : t('networkRouter.overview.off')}</Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void run('start')} disabled={controlsBusy || running}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs pc-glass disabled:opacity-40">
                {busyAction === 'start' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {t('networkRouter.actions.start')}
              </button>
              <button type="button" onClick={() => void run('restart')} disabled={controlsBusy}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs pc-glass disabled:opacity-40">
                {busyAction === 'restart' ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                {t('networkRouter.actions.restart')}
              </button>
              <button type="button" onClick={requestStop} disabled={controlsBusy || !running}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs disabled:opacity-40 ${confirmStop ? 'bg-rose-600 text-white' : 'pc-glass'}`}>
                {busyAction === 'stop' ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
                {confirmStop ? t('networkRouter.actions.confirmStop') : t('networkRouter.actions.stop')}
              </button>
            </div>
            {controlsBusy && <p className="text-xs text-slate-500">{t('networkRouter.actions.busy')}</p>}
            {actionNote && <p className="text-xs text-emerald-600 dark:text-emerald-400">{actionNote}</p>}
            {actionError && <p className="text-xs text-rose-500">{actionError}</p>}
          </section>

          <ConfigSection status={status} />
          {status.platform === 'linux' && <LinksSection status={status} />}
          <LanScopesSection status={status} />
          <InterfacesSection status={status} />
          <LeasesSection status={status} />
          <LazyText showKey="networkRouter.report.show" hideKey="networkRouter.report.hide" loadingKey="networkRouter.report.loading" load={loadReport} />
          <LazyText showKey="networkRouter.logs.show" hideKey="networkRouter.logs.hide" loadingKey="networkRouter.logs.loading" load={loadLogs} />
        </>
      )}
    </div>
  );
};

export default PcNetworkRouterPage;
