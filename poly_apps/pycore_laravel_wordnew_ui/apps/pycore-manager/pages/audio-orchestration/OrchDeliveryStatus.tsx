/**
 * Laravel delivery of orchestration audio (pycore shared delivery outbox):
 * the workspace panel shows the `audio_orch.output` and `audio_orch.resource`
 * kinds; the task row shows the task's own output upload counts.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  pycoreApi,
  type LaravelDeliveryOwnerCounts,
  type LaravelDeliveryStatus,
} from '@/apps/pycore-manager/api';
import { PcDeliveryOutboxStatus } from '../../components/PcDeliveryOutboxStatus';

const ORCH_DELIVERY_KINDS = ['audio_orch.output', 'audio_orch.resource'] as const;

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
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-slate-500">
        {status.laravel_online_at
          ? t('queueCenter.deliveryOutbox.laravelOnlineAt', { time: new Date(status.laravel_online_at * 1000).toLocaleString() })
          : t('queueCenter.deliveryOutbox.laravelOffline')}
      </p>
      {ORCH_DELIVERY_KINDS.map((kind) => (
        <PcDeliveryOutboxStatus key={kind} kind={kind} status={status.kinds[kind]} onChanged={load} />
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
