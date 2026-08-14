import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Pause, Play, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { useTranslation } from '@/apps/laravel-manager/i18n';
import { dataSyncModel } from '@/apps/laravel-manager/models';
import type { DataSyncSession } from '@/apps/laravel-manager/api';
import { commonClasses } from '@/shared/styles/theme';
import { AlertBox, EmptyState, Field, StatusBadge } from '../../common';

const POLL_INTERVAL_MS = 2000;

export const DataSyncTab: React.FC = () => {
  const { t } = useTranslation();
  const [target, setTarget] = useState('');
  const [databases, setDatabases] = useState(true);
  const [resources, setResources] = useState(true);
  const [compression, setCompression] = useState(false);
  const [sessions, setSessions] = useState<DataSyncSession[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [pendingTarget, setPendingTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => sessions.find((session) => session.id === selectedId) ?? sessions[0] ?? null,
    [sessions, selectedId]
  );
  const receiverActive = useMemo(
    () => sessions.find((session) => session.role === 'receiver' && ['queued', 'running', 'paused'].includes(session.status)) ?? null,
    [sessions]
  );
  const manifestDraftActive = useMemo(
    () => sessions.find((session) => session.role === 'source' && !session.target && !session.target_input && ['queued', 'running', 'paused'].includes(session.status)) ?? null,
    [sessions]
  );
  const selectedSource = useMemo(
    () => selected?.role === 'source' && ['queued', 'running', 'paused'].includes(selected.status) ? selected : null,
    [selected]
  );

  useEffect(() => {
    setPendingTarget(selected?.context?.awaiting_target ? selected.target_input ?? '' : '');
  }, [selected?.id, selected?.context?.awaiting_target, selected?.target_input]);

  const loadSessions = useCallback(async () => {
    try {
      const nextSessions = await dataSyncModel.list();
      setSessions(nextSessions);
      setSelectedId((current) => {
        if (current && nextSessions.some((session) => session.id === current)) return current;
        const nextActive = nextSessions.find((session) => ['queued', 'running', 'paused'].includes(session.status));
        return nextActive?.id ?? nextSessions[0]?.id ?? '';
      });
    } catch (loadError) {
      setError(loadError instanceof Error && loadError.message ? loadError.message : t('dbSync.errors.load'));
    }
  }, [t]);

  useEffect(() => {
    void loadSessions();
    const timer = window.setInterval(() => {
      void loadSessions();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadSessions]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await dataSyncModel.start({ target, databases, resources, compression });
      setSessions((current) => [session, ...current]);
      setSelectedId(session.id);
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
        ? await dataSyncModel.resume(selectedSource.id)
        : await dataSyncModel.pause(selectedSource.id);
      setSessions((current) => current.map((item) => (item.id === session.id ? session : item)));
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
      const session = await dataSyncModel.setTarget(selectedSource.id, pendingTarget);
      setSessions((current) => current.map((item) => (item.id === session.id ? session : item)));
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
        <Field label={t('dbSync.target')}>
          <input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder={t('dbSync.targetPlaceholder')}
            disabled={Boolean(receiverActive)}
            className={`${commonClasses.input} w-full`}
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={databases} onChange={(event) => setDatabases(event.target.checked)} disabled={Boolean(receiverActive)} />
            <span><strong>{t('dbSync.databases')}</strong><span className="block text-xs text-slate-500">{t('dbSync.databasesHint')}</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={resources}
              onChange={(event) => {
                setResources(event.target.checked);
                if (!event.target.checked) setCompression(false);
              }}
              disabled={Boolean(receiverActive)}
            />
            <span><strong>{t('dbSync.resources')}</strong><span className="block text-xs text-slate-500">{t('dbSync.resourcesHint')}</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={compression} onChange={(event) => setCompression(event.target.checked)} disabled={Boolean(receiverActive) || !resources} />
            <span><strong>{t('dbSync.compression')}</strong><span className="block text-xs text-slate-500">{t('dbSync.compressionHint')}</span></span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={start}
            disabled={busy || Boolean(receiverActive) || (!databases && !resources) || (target.trim() === '' && Boolean(manifestDraftActive))}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
          >
            <Play className="w-4 h-4" />
            {target.trim() === '' ? t('dbSync.collectManifest') : t('dbSync.start')}
          </button>
          <button
            type="button"
            onClick={() => void loadSessions()}
            disabled={busy}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2 disabled:opacity-50`}
          >
            <RefreshCw className="w-4 h-4" />
            {t('dbSync.refresh')}
          </button>
          {selectedSource && (
            <button
              type="button"
              onClick={togglePause}
              disabled={busy}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2 disabled:opacity-50`}
            >
              {selectedSource.status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {selectedSource.status === 'paused' ? t('dbSync.resume') : t('dbSync.pause')}
            </button>
          )}
        </div>
        {receiverActive && <AlertBox variant="warning">{t('dbSync.receiverBlocked')}</AlertBox>}
        {!receiverActive && target.trim() === '' && manifestDraftActive && <AlertBox variant="warning">{t('dbSync.manifestDraftBlocked')}</AlertBox>}
        {error && <AlertBox variant="error">{error}</AlertBox>}
      </div>

      {sessions.length > 0 && (
        <div className={`${commonClasses.card} p-4`}>
          <Field label={t('dbSync.session')}>
            <select value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)} className={`${commonClasses.select} w-full`}>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.created_at} · {t(`dbSync.roles.${session.role}`)} · {session.target ?? (session.target_input || (session.role === 'source' ? t('dbSync.targetPending') : t('dbSync.incomingPeer')))} · {t(`dbSync.status.${session.status}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {!selected ? (
        <div className={commonClasses.card}><EmptyState icon={Server} message={t('dbSync.empty')} /></div>
      ) : (
        <div className={`${commonClasses.card} p-4 space-y-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-slate-800 dark:text-slate-200">
                {t(`dbSync.roles.${selected.role}`)} · {selected.target ?? (selected.target_input || (selected.role === 'source' ? t('dbSync.targetPending') : t('dbSync.incomingPeer')))}
              </div>
              <div className="text-xs text-slate-500 font-mono">{selected.id}</div>
            </div>
            <StatusBadge status={t(`dbSync.status.${selected.status}`)} tone={selected.status === 'completed' ? 'success' : selected.status === 'failed' ? 'error' : selected.status === 'paused' ? 'warning' : 'info'} />
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1"><span>{t('dbSync.progress')}</span><span>{selected.progress}%</span></div>
            <div className="h-2 rounded bg-slate-200 dark:bg-slate-700 overflow-hidden"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${selected.progress}%` }} /></div>
          </div>
          {selectedSource && selected.context?.awaiting_target && (
            <div className="rounded border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/20 p-3 space-y-3">
              <AlertBox variant="info" icon={false}>{t('dbSync.targetRequired')}</AlertBox>
              <Field label={t('dbSync.target')}>
                <input
                  value={pendingTarget}
                  onChange={(event) => setPendingTarget(event.target.value)}
                  placeholder={t('dbSync.targetPlaceholder')}
                  className={`${commonClasses.input} w-full`}
                />
              </Field>
              <button
                type="button"
                onClick={bindTarget}
                disabled={busy || pendingTarget.trim() === ''}
                className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
              >
                <ArrowRightLeft className="w-4 h-4" />
                {t('dbSync.bindTarget')}
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
                <div>{t('dbSync.manifestResourceBytes')}: {selected.context.local_manifest.resource_bytes ?? 0}</div>
              </div>
            </div>
          )}
          {selected.backup_directory && (
            <div className="flex items-start gap-2 rounded border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 p-3">
              <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-600" />
              <div><div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t('dbSync.backupDirectory')}</div><div className="font-mono text-xs break-all text-slate-700 dark:text-slate-300">{selected.backup_directory}</div></div>
            </div>
          )}
          {selected.error && <AlertBox variant="error">{selected.error}</AlertBox>}
          <div className="space-y-2">
            {selected.steps.map((step) => (
              <div key={step.key} className="flex items-start gap-3 rounded border border-slate-200 dark:border-slate-700 p-2.5">
                <span className="w-7 h-7 flex-shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-500">{step.index}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{t(`dbSync.steps.${step.key}`)}</div>
                  {step.detail && <div className="text-xs text-slate-500 break-all mt-0.5">{step.detail}</div>}
                </div>
                <StatusBadge status={t(`dbSync.stepStatus.${step.status}`)} tone={step.status === 'completed' ? 'success' : step.status === 'failed' ? 'error' : step.status === 'running' ? 'info' : 'idle'} withDot={false} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
