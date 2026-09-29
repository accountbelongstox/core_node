/** Small status chips of a task row: output mode, queue state and video counters. */
import React from 'react';
import type { OrchTaskSummary } from '@/apps/pycore-manager/api';
import { orchOutputModeLabel } from './OrchOutputModeControl';
import { ORCH_L, orchQueueReasonText, orchQueueText } from './orchShared';
import { ORCH_OUTPUT_ICONS, orchTaskOutputMode } from './orchSources';

export const OrchOutputBadge: React.FC<{ task: OrchTaskSummary }> = ({ task }) => {
  const mode = orchTaskOutputMode(task);
  const Icon = ORCH_OUTPUT_ICONS[mode];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
      mode === 'video' ? 'bg-amber-500/15 text-amber-300' : 'bg-teal-500/15 text-teal-300'
    }`}>
      <Icon className="w-3 h-3" /> {orchOutputModeLabel(mode)}
    </span>
  );
};

export const OrchQueueChip: React.FC<{ task: OrchTaskSummary }> = ({ task }) => {
  const text = orchQueueText(task.queue);
  if (!text) return null;
  const state = task.queue?.state;
  return (
    <span
      title={orchQueueReasonText(task.queue)}
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        state === 'waiting' ? 'bg-amber-500/15 text-amber-300' : 'bg-indigo-500/15 text-indigo-300'
      }`}
    >
      {text}{task.queue?.reason === 'retry' ? ` · ${ORCH_L.queueRetryTag}` : ''}
    </span>
  );
};

export const OrchVideoCounters: React.FC<{ task: OrchTaskSummary }> = ({ task }) => {
  const done = task.videos_done || 0;
  const failed = task.videos_failed || 0;
  if (orchTaskOutputMode(task) !== 'video' || (!done && !failed)) return null;
  return (
    <span className="text-[10px] font-mono text-slate-500">
      {done}/{task.segments_total || 0} {ORCH_L.videosLabel}
      {failed > 0 && <span className="text-rose-400"> · {failed} {ORCH_L.videosFailedLabel}</span>}
    </span>
  );
};
