/**
 * Phrase Audio panel (lane phrase_audio). Same shape as the other audio lanes:
 * the Queue Center section switch is the only worker control; this panel shows
 * the lane's state (Part1 / Part2 / Queue, progress, work leases, assist) and
 * its delivery outbox. Everything renders from the pycore-owned lane state.
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useAudioLaneState } from '@/apps/pycore-manager/api';
import type { LaravelDeliveryKindStatus } from '@/apps/pycore-manager/api';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';
import { PcAudioLaneQueueView } from './PcAudioLaneQueueView';
import { PcDeliveryOutboxStatus } from './PcDeliveryOutboxStatus';
import { PcLaneBlockedBadge } from './PcQueueProgress';
import { readQueueProgress } from '../../../core/contracts/QueueProgress';

const LANE = 'phrase_audio';
const OUTBOX_KIND = 'audio_lane.phrase';

export function PcPhraseAudioPanel(): ReactElement {
  const { t } = useTranslation('pc');
  const hub = useQueueCenterHub();
  const lanes = useAudioLaneState();
  const lane = lanes.payload?.lanes?.[LANE];
  const section = hub.sectionContracts[LANE];
  const workerOn = section.toggle.enabled;
  const workerStopping = section.lifecycle === 'stopping';
  const workerRunning = section.lifecycle === 'on';
  const stateKey = workerStopping
    ? 'stopping'
    : workerOn
      ? (section.lifecycle === 'starting' ? 'starting' : workerRunning ? 'running' : 'configured')
      : 'off';
  const progress = readQueueProgress(lane?.progress);
  const engine = lane?.assist?.engine || lane?.worker?.planned_engine || '';
  const device = lane?.assist?.device ?? null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-lime-400">{t('queueCenter.phraseQueue.title')}</span>
        {engine && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/20 text-violet-400">{engine}</span>
        )}
        {device && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-700/70 text-slate-300 uppercase">
            {t(`queueCenter.progress.device.${device}`)}
          </span>
        )}
        <span className={`text-[10px] font-bold ${workerStopping ? 'text-amber-400' : workerOn ? 'text-emerald-400' : 'text-slate-500'}`}>
          {t('queueCenter.phraseQueue.workerState', { state: t(`queueCenter.phraseQueue.lifecycle.${stateKey}`) })}
        </span>
        <PcLaneBlockedBadge assist={lane?.assist} />
        <span className="text-[10px] text-slate-500 truncate flex-1 min-w-0">
          {t('queueCenter.phraseQueue.queueSummary', { pending: section.queue.pending, leased: section.queue.leased })}
          {progress?.total != null ? ` · ${progress.done}/${progress.total}` : ''}
        </span>
      </div>

      <PcAudioLaneQueueView
        lane={LANE}
        view={lane?.queue}
        report={lane}
        leases={lane?.leases}
        loading={lanes.loading}
        error={lanes.error}
      />

      <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1 text-[10px] text-slate-500 flex gap-2 flex-wrap">
        <span>{t('queueCenter.phraseQueue.pycoreWorker')}</span>
        <span className={section.worker.online ? 'text-emerald-400' : 'text-slate-500'}>
          {section.worker.online ? t('queueCenter.phraseQueue.workerOnline') : t('queueCenter.phraseQueue.workerOffline')}
        </span>
        <span className="font-mono">
          {t('queueCenter.phraseQueue.workerTotals', {
            claimed: section.worker.claimed ?? 0,
            ok: section.worker.ok ?? 0,
            fail: section.worker.fail ?? 0,
          })}
        </span>
      </div>

      <PcDeliveryOutboxStatus
        kind={OUTBOX_KIND}
        status={lane?.worker?.delivery_outbox as unknown as LaravelDeliveryKindStatus | undefined}
        onChanged={hub.refreshHub}
      />

      <p className="rounded border border-lime-700/40 bg-lime-950/20 px-2 py-1 text-[10px] text-lime-300/90">
        {t('queueCenter.phraseQueue.help')}
      </p>
    </div>
  );
}
