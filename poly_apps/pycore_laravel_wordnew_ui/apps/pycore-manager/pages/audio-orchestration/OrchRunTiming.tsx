/**
 * Generation timing of one orchestration run: start / finish / duration of
 * the run, per-phase durations (progress.phase_times) and per-segment
 * assembly times. Pure render of pycore-persisted timestamps (unix seconds);
 * an open end counts to now while the run is live.
 */
import React from 'react';
import type { OrchGenerationPhase, OrchSegment, OrchTaskSummary } from '@/apps/pycore-manager/api';
import { absoluteTime, formatElapsed, spanSeconds } from '../../utils/pcFormat';
import { ORCH_L, ORCH_PHASE_LABELS } from './orchShared';

const PHASES: OrchGenerationPhase[] = ['sync', 'manifest', 'resources', 'assemble'];

const OrchRunTiming: React.FC<{ task: OrchTaskSummary }> = ({ task }) => {
  const started = task.generation_started_at;
  if (!started) return null;
  const finished = task.generation_finished_at;
  const live = Boolean(task.running);
  const total = live || finished ? spanSeconds(started, finished) : null;
  const phaseTimes = task.progress?.phase_times || {};
  const phases = PHASES.filter((phase) => phaseTimes[phase]?.started_at);
  return (
    <div className="space-y-0.5 text-[10px] font-mono text-slate-500">
      <p>
        {ORCH_L.runStarted} {absoluteTime(started)}
        {finished ? ` · ${ORCH_L.runFinished} ${absoluteTime(finished)}` : ''}
        {total != null ? ` · ${live ? ORCH_L.runElapsed : ORCH_L.runDuration} ${formatElapsed(total)}` : ''}
      </p>
      {phases.length > 0 && (
        <p>
          {phases.map((phase) => {
            const timing = phaseTimes[phase] || {};
            const open = !timing.finished_at;
            if (open && !live) return `${ORCH_PHASE_LABELS[phase]} —`;
            return `${ORCH_PHASE_LABELS[phase]} ${formatElapsed(spanSeconds(timing.started_at, timing.finished_at))}`;
          }).join(' · ')}
        </p>
      )}
    </div>
  );
};

export const OrchSegmentTiming: React.FC<{ segments: OrchSegment[] }> = ({ segments }) => {
  const timed = segments.filter((segment) => segment.started_at);
  if (timed.length === 0) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold text-slate-400">{ORCH_L.segmentTiming}</p>
      <div className="max-h-32 overflow-y-auto">
        {timed.map((segment) => (
          <p key={segment.index} className="text-[10px] font-mono text-slate-500">
            segment_{String(segment.index).padStart(3, '0')} · {absoluteTime(segment.started_at)}
            {segment.finished_at ? ` · ${formatElapsed(spanSeconds(segment.started_at, segment.finished_at))}` : ''}
          </p>
        ))}
      </div>
    </div>
  );
};

export default OrchRunTiming;
