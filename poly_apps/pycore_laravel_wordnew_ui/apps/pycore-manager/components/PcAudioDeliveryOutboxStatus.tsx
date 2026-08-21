import { useState } from 'react';
import type { ReactElement } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { pycoreApi } from '@/apps/pycore-manager/api';
import type { AudioDeliveryOutboxStatus } from '@/apps/pycore-manager/api';


interface PcAudioDeliveryOutboxStatusProps {
  lane: 'word' | 'sentence';
  running?: boolean;
  status?: AudioDeliveryOutboxStatus;
  onChanged: () => Promise<unknown>;
}

export function PcAudioDeliveryOutboxStatus({
  lane,
  running = false,
  status,
  onChanged,
}: PcAudioDeliveryOutboxStatusProps): ReactElement | null {
  const { t } = useTranslation('pc');
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');
  const total = Number(status?.total || 0);
  const pending = Number(status?.pending || 0);
  const deadLetter = Number(status?.dead_letter || 0);

  if (!status && total === 0) return null;

  const retry = async (): Promise<void> => {
    setRetrying(true);
    setError('');
    try {
      await pycoreApi.retryAudioDelivery(lane);
      await onChanged();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : t('queueCenter.deliveryOutbox.retryFailed'));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="rounded border border-cyan-700/40 bg-cyan-950/20 px-2 py-1 text-[10px] text-cyan-200">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold">{t('queueCenter.deliveryOutbox.title')}</span>
        <span>{t('queueCenter.deliveryOutbox.pending', { count: pending })}</span>
        <span>{t('queueCenter.deliveryOutbox.domain', { count: status?.pending_domain_upload ?? 0 })}</span>
        <span>{t('queueCenter.deliveryOutbox.result', { count: status?.pending_result ?? 0 })}</span>
        <span>{t('queueCenter.deliveryOutbox.history', { count: status?.pending_history ?? 0 })}</span>
        <span className={deadLetter > 0 ? 'text-rose-400' : 'text-cyan-300'}>
          {t('queueCenter.deliveryOutbox.deadLetter', { count: deadLetter })}
        </span>
        <span className={running ? 'text-emerald-400' : 'text-slate-400'}>
          {running ? t('queueCenter.deliveryOutbox.running') : t('queueCenter.deliveryOutbox.idle')}
        </span>
        {deadLetter > 0 && (
          <button
            type="button"
            disabled={retrying}
            onClick={() => void retry()}
            className="ml-auto inline-flex items-center gap-1 rounded border border-cyan-600/50 px-1.5 py-0.5 text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
            {t('queueCenter.deliveryOutbox.retry')}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-rose-400">{error}</p>}
    </div>
  );
}
