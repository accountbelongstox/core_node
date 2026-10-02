import { useState } from 'react';
import type { ReactElement } from 'react';
import { GitCompare, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { pycoreApi } from '@/apps/pycore-manager/api';
import { pcCaughtErrorMessage, pcFailureMessage } from '../utils/pcErrorCodes';
import { useServerSchemaGate } from '../../../core/integrations/laravel';
import type {
  LaravelDeliveryKindStatus,
  LaravelDeliveryNamespaceStatus,
  LaravelServerIdentity,
} from '@/apps/pycore-manager/api';


interface PcDeliveryOutboxStatusProps {
  /** Delivery kind id of pycore's shared Laravel delivery outbox. */
  kind: string;
  status?: LaravelDeliveryKindStatus;
  /** Configured Laravel endpoints (labels the per-server rows). */
  servers?: LaravelServerIdentity[];
  activeNamespace?: string;
  onChanged: () => Promise<unknown>;
}

const SERVER_PREFIX = 'server:';
const URL_PREFIX = 'url:';

/** Short label of one server namespace: its endpoint URLs, else the id. */
function serverLabel(namespace: string, servers: LaravelServerIdentity[]): string {
  const urls = servers.filter((server) => server.namespace === namespace).map((server) => server.url);
  if (urls.length) return urls.join(' · ');
  if (namespace.startsWith(URL_PREFIX)) return namespace.slice(URL_PREFIX.length);
  if (namespace.startsWith(SERVER_PREFIX)) return namespace.slice(SERVER_PREFIX.length, SERVER_PREFIX.length + 12);
  return namespace;
}

/** Status, per-server diff progress and retry of one delivery outbox kind. */
export function PcDeliveryOutboxStatus({
  kind,
  status,
  servers = [],
  activeNamespace = '',
  onChanged,
}: PcDeliveryOutboxStatusProps): ReactElement | null {
  const { t } = useTranslation('pc');
  const schemaGate = useServerSchemaGate();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  if (!status) return null;

  const parked = Number(status.parked || 0);
  const pending = Math.max(0, Number(status.pending || 0) - parked);
  const deadLetter = Number(status.dead_letter || 0);
  const stages = Object.entries(status.by_stage || {}).filter(([, count]) => Number(count) > 0);
  const lastFailure = status.last_error || '';
  const namespaces = Object.entries(status.by_namespace || {});

  const run = async (action: string, reconcile: boolean, namespace = ''): Promise<void> => {
    setBusy(action);
    setError('');
    try {
      const result = await pycoreApi.retryLaravelDelivery(kind, reconcile, namespace);
      if (!result.success) {
        setError(pcFailureMessage(result, t('queueCenter.deliveryOutbox.retryFailed')));
        return;
      }
      await onChanged();
    } catch (caught: unknown) {
      setError(pcCaughtErrorMessage(caught, t('queueCenter.deliveryOutbox.retryFailed')));
    } finally {
      setBusy('');
    }
  };

  const diffLine = (entry: LaravelDeliveryNamespaceStatus): ReactElement | null => {
    const diff = entry.diff;
    if (!diff?.state) return null;
    const mode = t(`queueCenter.deliveryOutbox.diff.modes.${diff.mode || 'remote'}`);
    if (diff.state === 'running') {
      return (
        <span className="text-sky-300">
          {mode}: {t('queueCenter.deliveryOutbox.diff.running', {
            processed: Number(diff.processed || 0),
            total: Number(diff.total || 0),
          })}
        </span>
      );
    }
    if (diff.state === 'failed') {
      return (
        <span className="truncate text-rose-400" title={diff.error || ''}>
          {mode}: {t('queueCenter.deliveryOutbox.diff.failed', { error: diff.error || '' })}
        </span>
      );
    }
    return (
      <span className="text-slate-300">
        {mode}: {t('queueCenter.deliveryOutbox.diff.done', {
          total: Number(diff.total || 0),
          missing: Number(diff.missing || 0),
          stale: Number(diff.stale || 0),
          enqueued: Number(diff.enqueued || 0),
        })}
      </span>
    );
  };

  return (
    <div className="rounded border border-cyan-700/40 bg-cyan-950/20 px-2 py-1 text-[10px] text-cyan-200">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold">
          {t('queueCenter.deliveryOutbox.title')} · {t(`queueCenter.deliveryOutbox.kinds.${kind}`, { defaultValue: kind })}
        </span>
        <span>{t('queueCenter.deliveryOutbox.pending', { count: pending })}</span>
        {parked > 0 && (
          <span className="text-slate-400">{t('queueCenter.deliveryOutbox.parked', { count: parked })}</span>
        )}
        {stages.map(([stage, count]) => (
          <span key={stage}>
            {t(`queueCenter.deliveryOutbox.stages.${stage}`, { count: Number(count), defaultValue: `${stage}: ${count}` })}
          </span>
        ))}
        <span className={deadLetter > 0 ? 'text-rose-400' : 'text-cyan-300'}>
          {t('queueCenter.deliveryOutbox.deadLetter', { count: deadLetter })}
        </span>
        <span className="text-emerald-300">
          {t('queueCenter.deliveryOutbox.delivered', { count: Number(status.delivered || 0) })}
        </span>
        <span className={status.running ? 'text-emerald-400' : 'text-slate-400'}>
          {status.running ? t('queueCenter.deliveryOutbox.running') : t('queueCenter.deliveryOutbox.idle')}
        </span>
        <span className="ml-auto inline-flex items-center gap-1">
          {status.inventory && (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void run('reconcile', true)}
              title={t('queueCenter.deliveryOutbox.reconcileTitle')}
              className="inline-flex items-center gap-1 rounded border border-cyan-600/50 px-1.5 py-0.5 text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-50"
            >
              <GitCompare className={`h-3 w-3 ${busy === 'reconcile' ? 'animate-pulse' : ''}`} />
              {t('queueCenter.deliveryOutbox.reconcile')}
            </button>
          )}
          {deadLetter > 0 && (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void run('retry', false)}
              className="inline-flex items-center gap-1 rounded border border-cyan-600/50 px-1.5 py-0.5 text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${busy === 'retry' ? 'animate-spin' : ''}`} />
              {t('queueCenter.deliveryOutbox.retry')}
            </button>
          )}
        </span>
      </div>
      {namespaces.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {namespaces.map(([namespace, entry]) => {
            const selected = entry.selected ?? namespace === activeNamespace;
            const entryParked = Number(entry.parked || 0);
            return (
            <li key={namespace} className="flex items-center gap-2 flex-wrap font-mono">
              <span className={selected ? 'text-emerald-300' : 'text-slate-400'} title={namespace}>
                {t('queueCenter.deliveryOutbox.server', { name: serverLabel(namespace, servers) || t('queueCenter.deliveryOutbox.unassigned') })}
                {selected ? ` (${t('queueCenter.deliveryOutbox.activeServer')})` : ''}
              </span>
              {entry.offline && (
                <span className="rounded border border-rose-500/50 px-1 text-rose-400">
                  {t('queueCenter.deliveryOutbox.serverOffline')}
                </span>
              )}
              <span>{t('queueCenter.deliveryOutbox.pending', { count: Math.max(0, Number(entry.pending || 0) - entryParked) })}</span>
              {entryParked > 0 && (
                <span className="text-slate-400">{t('queueCenter.deliveryOutbox.parked', { count: entryParked })}</span>
              )}
              {Number(entry.dead_letter || 0) > 0 && (
                <span className="text-rose-400">{t('queueCenter.deliveryOutbox.deadLetter', { count: Number(entry.dead_letter) })}</span>
              )}
              <span className="text-emerald-300">
                {t('queueCenter.deliveryOutbox.delivered', { count: Number(entry.delivered || 0) })}
              </span>
              {diffLine(entry)}
              {status.inventory && (
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void run(`reconcile:${namespace}`, true, namespace)}
                  title={t('queueCenter.deliveryOutbox.reconcileTitle')}
                  className="rounded px-1 text-cyan-400 hover:bg-cyan-900/40 disabled:opacity-50"
                >
                  <GitCompare className={`h-3 w-3 ${busy === `reconcile:${namespace}` ? 'animate-pulse' : ''}`} />
                </button>
              )}
            </li>
            );
          })}
        </ul>
      )}
      {pending > 0 && schemaGate.schema === 'pending' && (
        <p className="mt-1 text-amber-300">{t('queueCenter.deliveryOutbox.heldBySchema')}</p>
      )}
      {pending > 0 && lastFailure && schemaGate.schema !== 'pending' && (
        <p className="mt-1 truncate text-amber-300" title={lastFailure}>
          {t('queueCenter.deliveryOutbox.lastError', { error: lastFailure })}
        </p>
      )}
      {error && <p className="mt-1 text-rose-400">{error}</p>}
    </div>
  );
}
