/**
 * Full-pull status + manual action of ONE audio lane (word or sentence).
 *
 * Status comes from the pushed lane state (pycore-owned); the action only
 * sends the intent — progress and results arrive through the next push.
 */
import { useCallback, useState } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { AudioLaneKey, QueueCenterWordAudioFullSyncStatus } from '@/apps/pycore-manager/api';
import { pcErrorCodeMessage } from '../utils/pcErrorCodes';

export function PcAudioLaneFullSyncRow({
  lane,
  status,
  enabled,
}: {
  lane: AudioLaneKey;
  status: QueueCenterWordAudioFullSyncStatus | null;
  enabled: boolean;
}): ReactElement {
  const { t } = useTranslation('pc');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const failed = status?.last_result?.success === false;
  const resultError = failed
    ? pcErrorCodeMessage(status?.last_result?.error_code, status?.last_result?.detail)
      || pcErrorCodeMessage(status?.last_result?.error)
      || t('queueCenter.audioLane.fullSync.failed')
    : null;
  const word = lane === 'word_audio';

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const response = await pycoreApi.audioLaneFullSync(lane);
      if (!response.success) {
        throw new Error(pcErrorCodeMessage(response.error) || t('queueCenter.audioLane.fullSync.failed'));
      }
    } catch (error: unknown) {
      setActionError(error instanceof Error && error.message ? error.message : t('queueCenter.audioLane.fullSync.failed'));
    } finally {
      setBusy(false);
    }
  }, [busy, lane, t]);

  return (
    <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1 text-[10px] text-slate-500 flex items-center gap-2 flex-wrap">
      <span className="uppercase tracking-wider text-slate-400">{t('queueCenter.audioLane.fullSync.title')}</span>
      {status ? (
        <>
          <span className={status.running ? 'text-amber-400' : 'text-slate-400'}>
            {status.running
              ? t('queueCenter.audioLane.fullSync.running')
              : status.last_sync_at
                ? t('queueCenter.audioLane.fullSync.lastSync', { time: new Date(status.last_sync_at * 1000).toLocaleString() })
                : t('queueCenter.audioLane.fullSync.never')}
          </span>
          {status.last_result?.pulled != null && status.last_result.pulled > 0 && (
            <span className="font-mono">
              {t('queueCenter.audioLane.fullSync.pulled', {
                pulled: status.last_result.pulled,
                inserted: status.last_result.inserted ?? 0,
              })}
            </span>
          )}
          <span className="font-mono">{t('queueCenter.audioLane.fullSync.queued', { count: status.queue_count })}</span>
          {resultError && (
            <span className="text-rose-400" title={status.last_result?.detail || ''}>{resultError}</span>
          )}
        </>
      ) : (
        <span>{t('queueCenter.audioLane.fullSync.unavailable')}</span>
      )}
      {actionError && <span className="text-rose-400">{actionError}</span>}
      <button
        type="button"
        onClick={() => void run()}
        disabled={!enabled || busy || Boolean(status?.running)}
        title={word ? t('queueCenter.audioLane.fullSync.wordActionTitle') : t('queueCenter.audioLane.fullSync.sentenceActionTitle')}
        className="ml-auto rounded bg-indigo-600/80 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {word ? t('queueCenter.audioLane.fullSync.wordAction') : t('queueCenter.audioLane.fullSync.sentenceAction')}
      </button>
    </div>
  );
}
