import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { ArrowRightLeft, Pause, Play, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { useTranslation } from '@/apps/laravel-manager/i18n';
import { dataSyncModel } from '@/apps/laravel-manager/models';
import {
  DATA_SYNC_PROTOCOL_MISMATCH_ERROR,
  type DataSyncManagedEndpoint,
  type ManagedDataSyncSession,
} from '@/apps/laravel-manager/models/DataSyncModel';
import type { DataSyncSessionSnapshot } from '@/apps/laravel-manager/api';
import { formatBytes } from '@/core/utils/formatBytes';
import { commonClasses } from '@/shared/styles/theme';
import { AlertBox, EmptyState, Field, StatusBadge } from '../../common';

const POLL_INTERVAL_MS = 2000;
const ACTIVE_STATUSES = ['queued', 'running', 'paused'];

type Translate = TFunction;

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
  const { t } = useTranslation();
  const [endpoints, setEndpoints] = useState<DataSyncManagedEndpoint[]>(() => dataSyncModel.endpoints());
  const [sourceEndpointId, setSourceEndpointId] = useState(() => dataSyncModel.endpoints().find((endpoint) => endpoint.current)?.id ?? '');
  const [target, setTarget] = useState('');
  const [databases, setDatabases] = useState(true);
  const [resources, setResources] = useState(true);
  const [compression, setCompression] = useState(false);
  const [sessions, setSessions] = useState<ManagedDataSyncSession[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [pendingTarget, setPendingTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const managedEndpoints = useMemo(() => endpoints.filter((endpoint) => endpoint.managed), [endpoints]);
  const selected = useMemo(
    () => sessions.find((session) => session.manager_key === selectedKey) ?? sessions[0] ?? null,
    [sessions, selectedKey],
  );
  const receiverActive = useMemo(
    () => sessions.find((session) => session.manager_endpoint.id === sourceEndpointId && session.role === 'receiver' && ACTIVE_STATUSES.includes(session.status)) ?? null,
    [sessions, sourceEndpointId],
  );
  const manifestDraftActive = useMemo(
    () => sessions.find((session) => session.manager_endpoint.id === sourceEndpointId && session.role === 'source' && !session.target && !session.target_input && ACTIVE_STATUSES.includes(session.status)) ?? null,
    [sessions, sourceEndpointId],
  );
  const selectedSource = useMemo(
    () => selected?.role === 'source' && ACTIVE_STATUSES.includes(selected.status) ? selected : null,
    [selected],
  );
  const displayedSessions = useMemo(() => {
    const linkedReceivers = new Set(sessions
      .filter((session) => session.role === 'source' && session.counterpart?.session_id)
      .map((session) => `${session.counterpart?.endpoint}:${session.counterpart?.session_id}`));

    return sessions.filter((session) => session.role === 'source'
      || !linkedReceivers.has(`${session.manager_endpoint.syncTarget}:${session.id}`));
  }, [sessions]);

  useEffect(() => {
    setPendingTarget(selected?.context?.awaiting_target ? selected.target_input ?? '' : '');
  }, [selected?.id, selected?.context?.awaiting_target, selected?.target_input]);

  useEffect(() => {
    if (managedEndpoints.some((endpoint) => endpoint.id === sourceEndpointId)) return;
    setSourceEndpointId(managedEndpoints[0]?.id ?? '');
  }, [managedEndpoints, sourceEndpointId]);

  const loadWorkspace = useCallback(async () => {
    const workspace = await dataSyncModel.workspace();
    setEndpoints(workspace.endpoints);
    setSessions(workspace.sessions);
    setSelectedKey((current) => {
      if (current && workspace.sessions.some((session) => session.manager_key === current)) return current;
      const active = workspace.sessions.find((session) => ACTIVE_STATUSES.includes(session.status));
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
  }, [t]);

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

  const start = async () => {
    if (!sourceEndpointId) return;
    setBusy(true);
    setError(null);
    try {
      const session = await dataSyncModel.start(sourceEndpointId, { target, databases, resources, compression });
      setSessions((current) => [session, ...current]);
      setSelectedKey(session.manager_key);
      setTarget('');
    } catch (startError) {
      setError(startError instanceof Error && startError.message ? startError.message : t('dbSync.errors.start'));
    } finally {
      setBusy(false);
    }
  };

  const togglePause = async () => {
    if (!selectedSource) return;
    setBusy(true);
    setError(null);
    try {
      const session = selectedSource.status === 'paused'
        ? await dataSyncModel.resume(selectedSource)
        : await dataSyncModel.pause(selectedSource);
      replaceSession(session);
    } catch (toggleError) {
      setError(toggleError instanceof Error && toggleError.message ? toggleError.message : t('dbSync.errors.control'));
    } finally {
      setBusy(false);
    }
  };

  const bindTarget = async () => {
    if (!selectedSource || pendingTarget.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      replaceSession(await dataSyncModel.setTarget(selectedSource, pendingTarget));
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
                  disabled={endpoint.current}
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
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t('dbSync.sourceNode')}>
            <select value={sourceEndpointId} onChange={(event) => setSourceEndpointId(event.target.value)} className={`${commonClasses.select} w-full`}>
              {managedEndpoints.map((endpoint) => <option key={endpoint.id} value={endpoint.id}>{endpoint.description} · {endpoint.baseUrl}</option>)}
            </select>
          </Field>
          <Field label={t('dbSync.target')}>
            <input
              list="data-sync-targets"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder={t('dbSync.targetPlaceholder')}
              disabled={Boolean(receiverActive)}
              className={`${commonClasses.input} w-full`}
            />
            <datalist id="data-sync-targets">
              {endpoints.filter((endpoint) => endpoint.id !== sourceEndpointId).map((endpoint) => (
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
          <button type="button" onClick={start} disabled={busy || !sourceEndpointId || Boolean(receiverActive) || (!databases && !resources) || (target.trim() === '' && Boolean(manifestDraftActive))} className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}>
            <Play className="w-4 h-4" />
            {target.trim() === '' ? t('dbSync.collectManifest') : t('dbSync.start')}
          </button>
          <button type="button" onClick={() => void loadWorkspace()} disabled={busy} className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2 disabled:opacity-50`}>
            <RefreshCw className="w-4 h-4" />{t('dbSync.refresh')}
          </button>
          {selectedSource && (
            <button type="button" onClick={togglePause} disabled={busy} className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2 disabled:opacity-50`}>
              {selectedSource.status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {selectedSource.status === 'paused' ? t('dbSync.resume') : t('dbSync.pause')}
            </button>
          )}
        </div>
        {receiverActive && <AlertBox variant="warning">{t('dbSync.receiverBlocked')}</AlertBox>}
        {!receiverActive && target.trim() === '' && manifestDraftActive && <AlertBox variant="warning">{t('dbSync.manifestDraftBlocked')}</AlertBox>}
        {error && <AlertBox variant="error">{error}</AlertBox>}
      </div>

      {displayedSessions.length > 0 && (
        <div className={`${commonClasses.card} p-4 space-y-3`}>
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('dbSync.allSessions')}</div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {displayedSessions.map((session) => (
              <button key={session.manager_key} type="button" onClick={() => setSelectedKey(session.manager_key)} className={`rounded-lg border p-3 text-left transition ${selected?.manager_key === session.manager_key ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{session.manager_endpoint.description} → {session.counterpart?.endpoint ?? t('dbSync.targetPending')}</div>
                    <div className="text-[10px] font-mono text-slate-500 truncate">{session.id}</div>
                  </div>
                  <StatusBadge status={t(`dbSync.status.${session.status}`)} tone={session.status === 'completed' ? 'success' : session.status === 'failed' ? 'error' : session.status === 'paused' ? 'warning' : 'info'} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-slate-500">
                  <div>{t('dbSync.source')}: {session.progress}%</div>
                  <div>{t('dbSync.receiver')}: {session.counterpart?.session?.progress ?? 0}%</div>
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
          {selectedSource && selected.context?.awaiting_target && (
            <div className="rounded border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/20 p-3 space-y-3">
              <AlertBox variant="info" icon={false}>{t('dbSync.targetRequired')}</AlertBox>
              <Field label={t('dbSync.target')}>
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
              title={t(selected.role === 'source' ? 'dbSync.sourceEndpoint' : 'dbSync.receiverEndpoint')}
              endpoint={selected.manager_endpoint.baseUrl}
              session={selected}
              t={t}
            />
            <EndpointStatusPanel
              title={t(selected.role === 'source' ? 'dbSync.receiverEndpoint' : 'dbSync.sourceEndpoint')}
              endpoint={selected.counterpart?.endpoint ?? t('dbSync.targetPending')}
              session={selected.counterpart?.session ?? null}
              reachable={selected.counterpart?.reachable}
              error={selected.counterpart?.error}
              t={t}
            />
          </div>
        </div>
      )}
    </div>
  );
};
