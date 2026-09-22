import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { ArrowRightLeft, LogIn, LogOut, Pause, Play, Radar, RefreshCw, Server, ShieldCheck, XCircle } from 'lucide-react';
import { useTranslation } from '@/apps/laravel-manager/i18n';
import { dataSyncModel } from '@/apps/laravel-manager/models';
import {
  DATA_SYNC_MAX_MANAGED_ENDPOINTS,
  DATA_SYNC_PEER_UNREACHABLE_ERROR,
  DATA_SYNC_PROTOCOL_MISMATCH_ERROR,
  DATA_SYNC_SAME_NODE_ERROR,
  type DataSyncDirectionProbe,
  type DataSyncManagedEndpoint,
  type ManagedDataSyncSession,
} from '@/apps/laravel-manager/models/DataSyncModel';
import { DataSyncApiError, type DataSyncSessionSnapshot } from '@/apps/laravel-manager/api';
import { formatBytes } from '@/core/utils/formatBytes';
import { commonClasses } from '@/shared/styles/theme';
import { AlertBox, EmptyState, Field, StatusBadge } from '../../common';
import LoginModal from '../../../auth/LmLoginModal';

const POLL_INTERVAL_MS = 2000;
const ACTIVE_STATUSES = ['queued', 'running', 'paused'];
const DRIVER_ROLES = ['source', 'fetcher'];
const WRITER_ROLES = ['receiver', 'fetcher'];

type Translate = TFunction;

/** Counterpart role for a sync pair: source↔receiver (push), fetcher↔exporter (pull). */
function counterpartRoleOf(session: ManagedDataSyncSession): string {
  if (session.counterpart?.session?.role) return session.counterpart.session.role;
  switch (session.role) {
    case 'source': return 'receiver';
    case 'fetcher': return 'exporter';
    case 'receiver': return 'source';
    default: return 'fetcher';
  }
}

interface EndpointStatusPanelProps {
  title: string;
  endpoint: string;
  session: DataSyncSessionSnapshot | null;
  reachable?: boolean;
  error?: string;
  t: Translate;
}

const EndpointStatusPanel: React.FC<EndpointStatusPanelProps> = ({
  title,
  endpoint,
  session,
  reachable,
  error,
  t,
}) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3 min-w-0">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
        <div className="text-xs font-mono break-all text-slate-700 dark:text-slate-300">{endpoint}</div>
        {session && <div className="text-[10px] font-mono text-slate-400 break-all">{session.id}</div>}
      </div>
      {session && (
        <StatusBadge
          status={t(`dbSync.status.${session.status}`)}
          tone={session.status === 'completed' ? 'success' : session.status === 'failed' ? 'error' : session.status === 'paused' ? 'warning' : 'info'}
        />
      )}
    </div>
    {!session ? (
      <AlertBox variant={reachable === false ? 'warning' : 'info'} icon={false}>
        {error || t(reachable === false ? 'dbSync.counterpartOffline' : 'dbSync.counterpartPending')}
      </AlertBox>
    ) : (
      <>
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{t('dbSync.progress')}</span><span>{session.progress}%</span>
          </div>
          <div className="h-2 rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${session.progress}%` }} />
          </div>
        </div>
        {session.error && <AlertBox variant="error">{session.error}</AlertBox>}
        <div className="space-y-1.5 max-h-[32rem] overflow-y-auto pr-1">
          {session.steps.map((step) => (
            <div key={step.key} className="flex items-start gap-2 rounded border border-slate-200 dark:border-slate-700 p-2">
              <span className="w-6 h-6 flex-shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] text-slate-500">{step.index}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{t(`dbSync.steps.${step.key}`)}</div>
                {step.detail && <div className="text-[10px] text-slate-500 break-all mt-0.5">{step.detail}</div>}
              </div>
              <StatusBadge
                status={t(`dbSync.stepStatus.${step.status}`)}
                tone={step.status === 'completed' ? 'success' : step.status === 'failed' ? 'error' : step.status === 'running' ? 'info' : 'idle'}
                withDot={false}
              />
            </div>
          ))}
        </div>
      </>
    )}
  </div>
);

export const DataSyncTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [endpoints, setEndpoints] = useState<DataSyncManagedEndpoint[]>(() => dataSyncModel.endpoints());
  const [oldEndpointId, setOldEndpointId] = useState(() => dataSyncModel.endpoints().find((endpoint) => endpoint.current)?.id ?? '');
  const [newServerInput, setNewServerInput] = useState('');
  const [databases, setDatabases] = useState(true);
  const [resources, setResources] = useState(true);
  const [compression, setCompression] = useState(false);
  const [sessions, setSessions] = useState<ManagedDataSyncSession[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [pendingTarget, setPendingTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [probe, setProbe] = useState<DataSyncDirectionProbe | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [authEndpoint, setAuthEndpoint] = useState<DataSyncManagedEndpoint | null>(null);
  const [dismissedAuthIds, setDismissedAuthIds] = useState<string[]>([]);
  const [peerAuthVersion, setPeerAuthVersion] = useState(0);

  const managedEndpoints = useMemo(() => endpoints.filter((endpoint) => endpoint.managed), [endpoints]);
  const managedCount = managedEndpoints.length;
  const oldEndpoint = useMemo(
    () => endpoints.find((endpoint) => endpoint.id === oldEndpointId) ?? null,
    [endpoints, oldEndpointId],
  );
  const newServerNode = useMemo(
    () => (newServerInput.trim() === '' ? null : dataSyncModel.resolveNewServer(newServerInput)),
    [newServerInput, peerAuthVersion],
  );
  // The pair must span two machines: probing or syncing a node onto itself is rejected.
  const sameNodeSelected = Boolean(oldEndpoint && newServerNode && dataSyncModel.sameNode(oldEndpoint, newServerNode));
  // Last-seen snapshot per session key: a slow or temporarily failing endpoint
  // poll must not flip the detail panel to another session.
  const lastSeenRef = useRef(new Map<string, ManagedDataSyncSession>());
  useEffect(() => {
    sessions.forEach((session) => lastSeenRef.current.set(session.manager_key, session));
  }, [sessions]);
  const selected = useMemo(
    () => sessions.find((session) => session.manager_key === selectedKey)
      ?? (selectedKey !== '' ? lastSeenRef.current.get(selectedKey) : undefined)
      // The backend that owns a session is authoritative: prefer the active
      // session on THIS node, then any active peer session, then the newest.
      ?? sessions.find((session) => session.manager_endpoint.current && ACTIVE_STATUSES.includes(session.status))
      ?? sessions.find((session) => ACTIVE_STATUSES.includes(session.status))
      ?? sessions[0]
      ?? null,
    [sessions, selectedKey],
  );
  const writerActiveOn = useCallback(
    (endpointId: string) => sessions.find((session) => session.manager_endpoint.id === endpointId
      && WRITER_ROLES.includes(session.role)
      && ACTIVE_STATUSES.includes(session.status)) ?? null,
    [sessions],
  );
  const receiverActive = useMemo(() => writerActiveOn(oldEndpointId), [writerActiveOn, oldEndpointId]);
  const newServerWriterActive = useMemo(
    () => (newServerNode ? writerActiveOn(newServerNode.id) : null),
    [writerActiveOn, newServerNode],
  );
  const manifestDraftActive = useMemo(
    () => sessions.find((session) => session.manager_endpoint.id === oldEndpointId && session.role === 'source' && !session.target && !session.target_input && ACTIVE_STATUSES.includes(session.status)) ?? null,
    [sessions, oldEndpointId],
  );
  const selectedDriver = useMemo(
    () => selected && DRIVER_ROLES.includes(selected.role) && ACTIVE_STATUSES.includes(selected.status) ? selected : null,
    [selected],
  );
  const displayedSessions = useMemo(() => {
    const linkedPassive = new Set(sessions
      .filter((session) => DRIVER_ROLES.includes(session.role) && session.counterpart?.session_id)
      .map((session) => `${session.counterpart?.endpoint}:${session.counterpart?.session_id}`));

    const visible = sessions.filter((session) => DRIVER_ROLES.includes(session.role)
      || !linkedPassive.has(`${session.manager_endpoint.syncTarget}:${session.id}`));
    // Single-active-session contract: list only live sessions; when nothing
    // is running, keep the most recent finished one for reference.
    const active = visible.filter((session) => ACTIVE_STATUSES.includes(session.status));
    return active.length > 0 ? active : visible.slice(0, 1);
  }, [sessions]);

  useEffect(() => {
    setPendingTarget(selected?.context?.awaiting_target ? selected.target_input ?? '' : '');
  }, [selected?.id, selected?.context?.awaiting_target, selected?.target_input]);

  useEffect(() => {
    // The old server may be any known node, managed or not.
    if (endpoints.some((endpoint) => endpoint.id === oldEndpointId)) return;
    setOldEndpointId(endpoints.find((endpoint) => endpoint.current)?.id ?? endpoints[0]?.id ?? '');
  }, [endpoints, oldEndpointId]);

  // A changed pair invalidates the negotiated direction.
  useEffect(() => {
    setProbe(null);
    setProbeError(null);
  }, [newServerInput, oldEndpointId]);

  const loadWorkspace = useCallback(async () => {
    const workspace = await dataSyncModel.workspace();
    setEndpoints(workspace.endpoints);
    setSessions(workspace.sessions);
    setSelectedKey((current) => {
      // An explicit selection sticks: transient endpoint failures must not
      // steal it. Auto-pick only when nothing is selected yet, preferring
      // the session owned by THIS node's backend.
      if (current) return current;
      const active = workspace.sessions.find((session) => session.manager_endpoint.current && ACTIVE_STATUSES.includes(session.status))
        ?? workspace.sessions.find((session) => ACTIVE_STATUSES.includes(session.status));
      return active?.manager_key ?? workspace.sessions[0]?.manager_key ?? '';
    });
    setError(workspace.errors.length > 0
      ? `${t('dbSync.errors.nodes')}: ${workspace.errors.map((item) => {
        const reason = item.message === DATA_SYNC_PROTOCOL_MISMATCH_ERROR
          ? t('dbSync.errors.protocol')
          : item.message || t('dbSync.errors.load');
        return `${item.endpointId} (${reason})`;
      }).join(', ')}`
      : null);

    // A remote node answering 401 owns a separate login state: offer the
    // endpoint-scoped peer login instead of the shared login modal.
    const unauthorized = workspace.errors.find((item) => item.status === 401
      && item.endpointId !== workspace.endpoints.find((endpoint) => endpoint.current)?.id);
    if (unauthorized && !dismissedAuthIds.includes(unauthorized.endpointId)) {
      const node = workspace.endpoints.find((endpoint) => endpoint.id === unauthorized.endpointId)
        ?? dataSyncModel.resolveNewServer(unauthorized.endpointId);
      if (node) setAuthEndpoint((current) => current ?? node);
    }
  }, [t, dismissedAuthIds]);

  useEffect(() => {
    void loadWorkspace();
    const timer = window.setInterval(() => void loadWorkspace(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadWorkspace]);

  const replaceSession = (session: ManagedDataSyncSession) => {
    setSessions((current) => current.map((item) => item.manager_key === session.manager_key ? session : item));
  };

  const toggleManagedEndpoint = (endpointId: string) => {
    const selectedIds = endpoints
      .filter((endpoint) => endpoint.managed !== (endpoint.id === endpointId))
      .map((endpoint) => endpoint.id);
    setEndpoints(dataSyncModel.setManagedEndpoints(selectedIds));
    void loadWorkspace();
  };

  const runProbe = useCallback(async () => {
    if (!oldEndpointId || newServerInput.trim() === '' || sameNodeSelected) return;
    setProbing(true);
    setProbeError(null);
    try {
      setProbe(await dataSyncModel.probeDirection(oldEndpointId, newServerInput));
    } catch (probeFailure) {
      setProbe(null);
      if (probeFailure instanceof DataSyncApiError && probeFailure.status === 401 && newServerNode) {
        setAuthEndpoint((current) => current ?? newServerNode);
      }
      setProbeError(
        probeFailure instanceof Error && probeFailure.message === DATA_SYNC_SAME_NODE_ERROR
          ? t('dbSync.sameNode')
          : probeFailure instanceof Error && probeFailure.message === DATA_SYNC_PEER_UNREACHABLE_ERROR
          ? t('dbSync.directionNone')
          : (probeFailure instanceof Error && probeFailure.message ? probeFailure.message : t('dbSync.errors.probe')),
      );
    } finally {
      setProbing(false);
    }
  }, [oldEndpointId, newServerInput, sameNodeSelected, newServerNode, t]);

  const afterPeerLogin = useCallback(async () => {
    setPeerAuthVersion((version) => version + 1);
    await loadWorkspace();
    // Authorization is fresh: retry immediately and negotiate which node is
    // the externally reachable server.
    if (newServerInput.trim() !== '') {
      void runProbe();
    }
  }, [loadWorkspace, newServerInput, runProbe]);

  const start = async () => {
    if (!oldEndpointId || sameNodeSelected) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      // No manual probe yet: negotiate the direction first so Start follows
      // the same reachability rules as Detect direction. This is what lets a
      // "Current URL" new server fall back to pull mode instead of pushing
      // to a loopback address the old server reads as itself.
      let direction = probe;
      if (!direction && newServerInput.trim() !== '') {
        direction = await dataSyncModel.probeDirection(oldEndpointId, newServerInput);
        setProbe(direction);
      }
      if (direction?.direction === 'pull') {
        // The fetcher drives the pull: keep its sessions visible by managing
        // the node when it is a registry endpoint outside the managed pair.
        if (!direction.newServer.managed && !direction.newServer.adhoc) {
          setEndpoints(dataSyncModel.setManagedEndpoints([direction.newServer.id]));
        }
        const session = await dataSyncModel.startFetch(direction.newServer.id, {
          target: direction.oldServer.syncTarget,
          databases,
          resources,
          compression,
        });
        setSessions((current) => [session, ...current]);
        setSelectedKey(session.manager_key);
        if (session.cancelled_sessions?.length) {
          setNotice(t('dbSync.autoCancelled', { count: session.cancelled_sessions.length }));
        }
      } else {
        if (oldEndpoint && !oldEndpoint.managed && !oldEndpoint.adhoc) {
          setEndpoints(dataSyncModel.setManagedEndpoints([oldEndpoint.id]));
        }
        const session = await dataSyncModel.start(oldEndpointId, {
          target: direction ? direction.newServer.syncTarget : newServerInput,
          databases,
          resources,
          compression,
        });
        setSessions((current) => [session, ...current]);
        setSelectedKey(session.manager_key);
        setNewServerInput('');
        if (session.cancelled_sessions?.length) {
          setNotice(t('dbSync.autoCancelled', { count: session.cancelled_sessions.length }));
        }
      }
    } catch (startError) {
      if (startError instanceof DataSyncApiError && startError.status === 401 && newServerNode) {
        setAuthEndpoint((current) => current ?? newServerNode);
      }
      setError(
        startError instanceof Error && startError.message === DATA_SYNC_PEER_UNREACHABLE_ERROR
          ? t('dbSync.directionNone')
          : startError instanceof Error && startError.message === DATA_SYNC_SAME_NODE_ERROR
          ? t('dbSync.sameNode')
          : (startError instanceof Error && startError.message ? startError.message : t('dbSync.errors.start')),
      );
    } finally {
      setBusy(false);
    }
  };

  const togglePause = async () => {
    if (!selectedDriver) return;
    setBusy(true);
    setError(null);
    try {
      const session = selectedDriver.status === 'paused'
        ? await dataSyncModel.resume(selectedDriver)
        : await dataSyncModel.pause(selectedDriver);
      replaceSession(session);
    } catch (toggleError) {
      setError(toggleError instanceof Error && toggleError.message ? toggleError.message : t('dbSync.errors.control'));
    } finally {
      setBusy(false);
    }
  };

  const cancelSelected = async () => {
    if (!selectedDriver) return;
    setBusy(true);
    setError(null);
    try {
      replaceSession(await dataSyncModel.cancel(selectedDriver));
    } catch (cancelError) {
      setError(cancelError instanceof Error && cancelError.message ? cancelError.message : t('dbSync.errors.control'));
    } finally {
      setBusy(false);
    }
  };

  const bindTarget = async () => {
    if (!selectedDriver || pendingTarget.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      replaceSession(await dataSyncModel.setTarget(selectedDriver, pendingTarget));
    } catch (targetError) {
      setError(targetError instanceof Error && targetError.message ? targetError.message : t('dbSync.errors.target'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`${commonClasses.card} p-4 space-y-4`}>
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('dbSync.title')}</h3>
        </div>
        <AlertBox variant="info" icon={false}>{t('dbSync.description')}</AlertBox>

        <Field label={t('dbSync.managedNodes')}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {endpoints.map((endpoint) => (
              <label key={endpoint.id} className="flex items-center gap-2 rounded border border-slate-200 dark:border-slate-700 p-2 text-xs">
                <input
                  type="checkbox"
                  checked={endpoint.managed}
                  disabled={endpoint.current || (!endpoint.managed && managedCount >= DATA_SYNC_MAX_MANAGED_ENDPOINTS)}
                  onChange={() => toggleManagedEndpoint(endpoint.id)}
                />
                <span className={`w-2 h-2 rounded-full ${endpoint.healthy === true ? 'bg-emerald-500' : endpoint.healthy === false ? 'bg-red-500' : 'bg-slate-400'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium truncate">{endpoint.description}</span>
                  <span className="block font-mono text-[10px] text-slate-500 truncate">{endpoint.baseUrl}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">{t('dbSync.maxTwoEndpoints')}</div>
          {managedEndpoints.filter((endpoint) => !endpoint.current).map((endpoint) => {
            const auth = peerAuthVersion >= 0 ? dataSyncModel.peerAuth(endpoint.id) : null;
            return (
              <div key={`auth-${endpoint.id}`} className="mt-1 flex items-center gap-2 text-xs">
                {auth ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-slate-600 dark:text-slate-400 truncate">
                      {endpoint.description} — {t('dbSync.peerLoggedInAs', { name: auth.username })}
                    </span>
                    <button
                      type="button"
                      onClick={() => { dataSyncModel.logoutPeer(endpoint.id); setPeerAuthVersion((version) => version + 1); void loadWorkspace(); }}
                      className="flex items-center gap-1 text-slate-500 hover:text-red-500"
                    >
                      <LogOut className="w-3 h-3" />{t('dbSync.peerLogout')}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-amber-600 dark:text-amber-400 truncate">{endpoint.description} — {t('dbSync.peerAuthRequired')}</span>
                    <button
                      type="button"
                      onClick={() => { setDismissedAuthIds((ids) => ids.filter((id) => id !== endpoint.id)); setAuthEndpoint(endpoint); }}
                      className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                    >
                      <LogIn className="w-3 h-3" />{t('dbSync.peerLogin')}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t('dbSync.oldServer')}>
            <select value={oldEndpointId} onChange={(event) => setOldEndpointId(event.target.value)} className={`${commonClasses.select} w-full`}>
              {endpoints.map((endpoint) => <option key={endpoint.id} value={endpoint.id}>{endpoint.description} · {endpoint.baseUrl}</option>)}
            </select>
          </Field>
          <Field label={t('dbSync.newServer')}>
            <input
              list="data-sync-targets"
              value={newServerInput}
              onChange={(event) => setNewServerInput(event.target.value)}
              placeholder={t('dbSync.targetPlaceholder')}
              disabled={Boolean(receiverActive)}
              className={`${commonClasses.input} w-full`}
            />
            <datalist id="data-sync-targets">
              {endpoints.filter((endpoint) => endpoint.id !== oldEndpointId).map((endpoint) => (
                <option key={endpoint.id} value={endpoint.syncTarget}>{endpoint.description}</option>
              ))}
            </datalist>
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={databases} onChange={(event) => setDatabases(event.target.checked)} disabled={Boolean(receiverActive)} />
            <span><strong>{t('dbSync.databases')}</strong><span className="block text-xs text-slate-500">{t('dbSync.databasesHint')}</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={resources} onChange={(event) => { setResources(event.target.checked); if (!event.target.checked) setCompression(false); }} disabled={Boolean(receiverActive)} />
            <span><strong>{t('dbSync.resources')}</strong><span className="block text-xs text-slate-500">{t('dbSync.resourcesHint')}</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={compression} onChange={(event) => setCompression(event.target.checked)} disabled={Boolean(receiverActive) || !resources} />
            <span><strong>{t('dbSync.compression')}</strong><span className="block text-xs text-slate-500">{t('dbSync.compressionHint')}</span></span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={start} disabled={busy || !oldEndpointId || sameNodeSelected || Boolean(receiverActive) || (!databases && !resources) || (probe?.direction === 'pull' ? Boolean(newServerWriterActive) : (newServerInput.trim() === '' && Boolean(manifestDraftActive)))} className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}>
            <Play className="w-4 h-4" />
            {probe?.direction === 'pull' ? t('dbSync.startFetch') : newServerInput.trim() === '' ? t('dbSync.collectManifest') : t('dbSync.start')}
          </button>
          <button
            type="button"
            onClick={() => void runProbe()}
            disabled={probing || !oldEndpointId || newServerInput.trim() === '' || sameNodeSelected}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2 disabled:opacity-50`}
          >
            <Radar className="w-4 h-4" />{probing ? t('dbSync.probing') : t('dbSync.probeDirection')}
          </button>
          <button type="button" onClick={() => void loadWorkspace()} disabled={busy} className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2 disabled:opacity-50`}>
            <RefreshCw className="w-4 h-4" />{t('dbSync.refresh')}
          </button>
          {selectedDriver && (
            <button type="button" onClick={togglePause} disabled={busy} className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2 disabled:opacity-50`}>
              {selectedDriver.status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {selectedDriver.status === 'paused' ? t('dbSync.resume') : t('dbSync.pause')}
            </button>
          )}
          {selectedDriver && (
            <button type="button" onClick={cancelSelected} disabled={busy} className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2 disabled:opacity-50`}>
              <XCircle className="w-4 h-4" />{t('dbSync.cancel')}
            </button>
          )}
        </div>
        {sameNodeSelected && <AlertBox variant="warning">{t('dbSync.sameNode')}</AlertBox>}
        {probe && (
          <AlertBox variant="info" icon={false}>
            {t(probe.direction === 'push' ? 'dbSync.directionPush' : 'dbSync.directionPull', {
              old: probe.oldServer.description,
              new: probe.newServer.description,
            })}
          </AlertBox>
        )}
        {probeError && <AlertBox variant="warning">{probeError}</AlertBox>}
        {receiverActive && <AlertBox variant="warning">{t('dbSync.receiverBlocked')}</AlertBox>}
        {!receiverActive && probe?.direction === 'pull' && newServerWriterActive && <AlertBox variant="warning">{t('dbSync.fetcherBlocked')}</AlertBox>}
        {!receiverActive && newServerInput.trim() === '' && manifestDraftActive && <AlertBox variant="warning">{t('dbSync.manifestDraftBlocked')}</AlertBox>}
        {error && <AlertBox variant="error">{error}</AlertBox>}
        {notice && <AlertBox variant="info">{notice}</AlertBox>}
      </div>

      {displayedSessions.length > 0 && (
        <div className={`${commonClasses.card} p-4 space-y-3`}>
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('dbSync.currentSession')}</div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {displayedSessions.map((session) => (
              <button key={session.manager_key} type="button" onClick={() => setSelectedKey(session.manager_key)} className={`rounded-lg border p-3 text-left transition ${selected?.manager_key === session.manager_key ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{t(`dbSync.roles.${session.role}`)} · {session.manager_endpoint.description} → {session.counterpart?.endpoint ?? t('dbSync.targetPending')}</div>
                    <div className="text-[10px] font-mono text-slate-500 truncate">{session.id}</div>
                  </div>
                  <StatusBadge status={t(`dbSync.status.${session.status}`)} tone={session.status === 'completed' ? 'success' : session.status === 'failed' ? 'error' : session.status === 'paused' ? 'warning' : 'info'} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-slate-500">
                  <div>{t(`dbSync.roles.${session.role}`)}: {session.progress}%</div>
                  <div>{t(`dbSync.roles.${counterpartRoleOf(session)}`)}: {session.counterpart?.session?.progress ?? 0}%</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!selected ? (
        <div className={commonClasses.card}><EmptyState icon={Server} message={t('dbSync.empty')} /></div>
      ) : (
        <div className={`${commonClasses.card} p-4 space-y-4`}>
          {selectedDriver && selected.context?.awaiting_target && (
            <div className="rounded border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/20 p-3 space-y-3">
              <AlertBox variant="info" icon={false}>{t('dbSync.targetRequired')}</AlertBox>
              <Field label={t('dbSync.newServer')}>
                <input list="data-sync-targets" value={pendingTarget} onChange={(event) => setPendingTarget(event.target.value)} placeholder={t('dbSync.targetPlaceholder')} className={`${commonClasses.input} w-full`} />
              </Field>
              <button type="button" onClick={bindTarget} disabled={busy || pendingTarget.trim() === ''} className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}>
                <ArrowRightLeft className="w-4 h-4" />{t('dbSync.bindTarget')}
              </button>
            </div>
          )}

          {selected.context?.local_manifest && (
            <div className="rounded border border-slate-200 dark:border-slate-700 p-3 space-y-2">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('dbSync.manifestTitle')}</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-400">
                <div>{t('dbSync.manifestDatabases')}: {selected.context.local_manifest.databases ?? 0}</div>
                <div>{t('dbSync.manifestTables')}: {selected.context.local_manifest.tables ?? 0}</div>
                <div>{t('dbSync.manifestRows')}: {selected.context.local_manifest.rows ?? 0}</div>
                <div>{t('dbSync.manifestResourceRoots')}: {selected.context.local_manifest.resource_roots ?? 0}</div>
                <div>{t('dbSync.manifestResourceFiles')}: {selected.context.local_manifest.resource_files ?? 0}</div>
                <div>{t('dbSync.manifestResourceBytes')}: {formatBytes(selected.context.local_manifest.resource_bytes ?? 0)}</div>
              </div>
            </div>
          )}

          {selected.backup_directory && (
            <div className="flex items-start gap-2 rounded border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 p-3">
              <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-600" />
              <div><div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t('dbSync.backupDirectory')}</div><div className="font-mono text-xs break-all text-slate-700 dark:text-slate-300">{selected.backup_directory}</div></div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <EndpointStatusPanel
              title={t(`dbSync.roles.${selected.role}`)}
              endpoint={selected.manager_endpoint.baseUrl}
              session={selected}
              t={t}
            />
            <EndpointStatusPanel
              title={t(`dbSync.roles.${counterpartRoleOf(selected)}`)}
              endpoint={selected.counterpart?.endpoint ?? t('dbSync.targetPending')}
              session={selected.counterpart?.session ?? null}
              reachable={selected.counterpart?.reachable}
              error={selected.counterpart?.error}
              t={t}
            />
          </div>
        </div>
      )}

      <LoginModal
        isOpen={authEndpoint !== null}
        onClose={() => {
          if (authEndpoint) {
            setDismissedAuthIds((ids) => (ids.includes(authEndpoint.id) ? ids : [...ids, authEndpoint.id]));
          }
          setAuthEndpoint(null);
        }}
        onSuccess={() => {
          setAuthEndpoint(null);
          void afterPeerLogin();
        }}
        lang={i18n.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'}
        titleOverride={t('dbSync.peerLoginTitle')}
        subtitleOverride={t('dbSync.peerLoginSubtitle', { endpoint: authEndpoint?.baseUrl ?? '' })}
        authenticate={async (username, password) => {
          if (!authEndpoint) return;
          await dataSyncModel.loginPeer(authEndpoint.id, username, password);
        }}
      />
    </div>
  );
};
