import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, MemoryStick } from 'lucide-react';
import { queueProgressPercent, readQueueProgress, type QueueAssistState, type QueueLaneReport, type QueueProgressCounts } from '../../../core/contracts/QueueProgress';
import { pcErrorCodeText } from '../utils/pcErrorCodes';
import { useAudioLaneState } from '../api/AudioLaneStateStore';

const nf = (value: number): string => value.toLocaleString();

function Bar({ counts }: { counts: QueueProgressCounts }): ReactElement {
  const total = Math.max(1, counts.total);
  return (
    <div className="flex h-1.5 overflow-hidden rounded bg-slate-800" aria-hidden="true">
      <div className="bg-emerald-500" style={{ width: `${(counts.done / total) * 100}%` }} />
      <div className="bg-rose-500" style={{ width: `${(counts.failed / total) * 100}%` }} />
    </div>
  );
}

/** Why this node's lane is blocked (assist `reason_code`), shown wherever the lane is summarized, also collapsed. */
export function PcLaneBlockedBadge({ assist }: { assist: QueueAssistState | null | undefined }): ReactElement | null {
  if (assist?.state !== 'blocked' || !assist.reason_code) return null;
  return (
    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300" title={pcErrorCodeText(assist.reason_code)}>
      {assist.reason_code}
    </span>
  );
}

/** The one progress view of a queue or lane: contract template counts, assist device and skipped reasons. */
export function PcQueueProgress({ titleKey, report }: { titleKey: string; report: QueueLaneReport | null | undefined }): ReactElement | null {
  const { t } = useTranslation('pc');
  const progress = readQueueProgress(report?.progress);
  const assist = report?.assist ?? null;
  const skipped = (report?.skipped ?? []).filter((group) => group.count > 0);
  if (!progress && !assist && skipped.length === 0) return null;
  const DeviceIcon = assist?.device === 'gpu' ? MemoryStick : Cpu;
  return (
    <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap text-[10px]">
        <span className="uppercase tracking-wider text-slate-400">{t(titleKey)}</span>
        {progress && (
          <>
            <span className="text-emerald-300">{t('queueCenter.progress.done')} <b className="font-mono">{nf(progress.done)}</b></span>
            <span className="text-amber-300">{t('queueCenter.progress.pending')} <b className="font-mono">{nf(progress.pending)}</b></span>
            {progress.failed > 0 && (
              <span className="text-rose-300">{t('queueCenter.progress.failed')} <b className="font-mono">{nf(progress.failed)}</b></span>
            )}
            <span className="text-slate-500 font-mono">{queueProgressPercent(progress)}% / {nf(progress.total)}</span>
          </>
        )}
        {assist && (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-slate-300"
            title={assist.reason_code ? pcErrorCodeText(assist.reason_code) : assist.engine}
          >
            <DeviceIcon className="h-3 w-3" />
            {t(`queueCenter.progress.device.${assist.device ?? 'none'}`)}
            <span className="text-slate-500">{t(`queueCenter.progress.assistState.${assist.state}`)}</span>
          </span>
        )}
      </div>
      {assist?.state === 'blocked' && assist.reason_code && (
        <p className="text-[10px] text-amber-400">{pcErrorCodeText(assist.reason_code)}</p>
      )}
      {progress && <Bar counts={progress} />}
      {progress?.languages && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
          {Object.entries(progress.languages).map(([language, counts]) => (
            <span key={language} className="font-mono">
              {language} {nf(counts.done)}/{nf(counts.total)}{counts.failed > 0 ? ` (${nf(counts.failed)}!)` : ''}
            </span>
          ))}
        </div>
      )}
      {skipped.length > 0 && (
        <ul className="space-y-0.5 text-[10px] text-slate-400">
          {skipped.map((group) => (
            <li key={group.reason_code} className="flex gap-1.5">
              <span className="font-mono text-slate-300">{nf(group.count)}</span>
              <span>{t('queueCenter.progress.skipped')}</span>
              <span className="text-slate-500">{pcErrorCodeText(group.reason_code)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Missing-translation progress of the translation assist queue. */
export function PcTranslationProgress(): ReactElement | null {
  const lanes = useAudioLaneState();
  return <PcQueueProgress titleKey="queueCenter.progress.translation" report={lanes.payload?.lanes?.translation} />;
}
