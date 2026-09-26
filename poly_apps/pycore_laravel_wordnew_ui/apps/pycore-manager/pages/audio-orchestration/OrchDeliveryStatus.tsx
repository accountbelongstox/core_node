/**
 * Laravel delivery of orchestration audio (pycore shared delivery outbox):
 * the workspace panel shows every configured Laravel server (identity,
 * reachability, running diff) and the `audio_orch.output` /
 * `audio_cache.resource` (every local word/sentence clip) kinds per server; the task row shows the task's own
 * output upload counts on the active server.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  pycoreApi,
  type LaravelDeliveryOwnerCounts,
  type LaravelDeliveryStatus,
} from '@/apps/pycore-manager/api';
import { PcDeliveryOutboxStatus } from '../../components/PcDeliveryOutboxStatus';

const ORCH_DELIVERY_KINDS = ['audio_orch.output', 'audio_cache.resource'] as const;

export const OrchDeliveryPanel: React.FC<{ revision: number }> = ({ revision }) => {
  const { t } = useTranslation('pc');
  const [status, setStatus] = useState<LaravelDeliveryStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await pycoreApi.laravelDeliveryStatus();
      if (result.success && result.data) setStatus(result.data);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, revision]);

  if (!status) return null;
  const servers = status.servers || [];
  const reconciling = new Set(status.reconciling || []);
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-slate-500">
        {status.laravel_online_at
          ? t('queueCenter.deliveryOutbox.laravelOnlineAt', { time: new Date(status.laravel_online_at * 1000).toLocaleString() })
          : t('queueCenter.deliveryOutbox.laravelOffline')}
      </p>
      {servers.length > 0 && (
        <ul className="text-[10px] font-mono space-y-0.5">
          {servers.map((server) => (
            <li key={server.url} className="flex items-center gap-2 flex-wrap">
              <span className={server.namespace === status.active_namespace ? 'text-emerald-300' : 'text-slate-400'}>
                {server.url}
                {server.namespace === status.active_namespace ? ` (${t('queueCenter.deliveryOutbox.activeServer')})` : ''}
              </span>
              <span className={server.reachable ? 'text-emerald-400' : server.reachable === false ? 'text-rose-400' : 'text-slate-500'}>
                {server.reachable
                  ? t('queueCenter.deliveryOutbox.serverOnline')
                  : server.reachable === false
                    ? t('queueCenter.deliveryOutbox.serverOffline')
                    : t('queueCenter.deliveryOutbox.serverUnknown')}
              </span>
              <span className="text-slate-500">
                {server.server_id
                  ? t('queueCenter.deliveryOutbox.serverId', { id: server.server_id.slice(0, 12) })
                  : server.identified
                    ? t('queueCenter.deliveryOutbox.legacyServer')
                    : ''}
              </span>
              {reconciling.has(server.namespace) && (
                <span className="text-sky-300">{t('queueCenter.deliveryOutbox.reconciling')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {ORCH_DELIVERY_KINDS.map((kind) => (
        <PcDeliveryOutboxStatus
          key={kind}
          kind={kind}
          status={status.kinds[kind]}
          servers={servers}
          activeNamespace={status.active_namespace}
          onChanged={load}
        />
      ))}
    </div>
  );
};

export const OrchTaskOutputDelivery: React.FC<{ counts?: LaravelDeliveryOwnerCounts }> = ({ counts }) => {
  const { t } = useTranslation('pc');
  if (!counts || counts.pending + counts.delivered + counts.dead_letter === 0) return null;
  return (
    <p className={`text-[10px] font-mono ${counts.dead_letter ? 'text-rose-400' : counts.pending ? 'text-amber-400' : 'text-emerald-400'}`}>
      {t('queueCenter.deliveryOutbox.taskOutput', {
        delivered: counts.delivered,
        pending: counts.pending,
        dead: counts.dead_letter,
      })}
    </p>
  );
};
