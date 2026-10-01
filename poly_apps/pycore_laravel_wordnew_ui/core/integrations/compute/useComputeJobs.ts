import { useMemo, useSyncExternalStore } from 'react';
import type { ComputeScheduler } from './ComputeScheduler';
import type { ComputeJob } from './ComputeTypes';

/** Reactive jobs of one scheduler, optionally limited to some of them (stable between changes). */
export function useComputeJobs(scheduler: ComputeScheduler, ids?: readonly string[]): ComputeJob[] {
  const all = useSyncExternalStore(scheduler.subscribe, scheduler.getSnapshot, scheduler.getSnapshot);
  const key = ids ? ids.join('|') : '';
  return useMemo(() => (ids ? all.filter((job) => ids.includes(job.id)) : all), [all, key]); // eslint-disable-line react-hooks/exhaustive-deps
}

export interface ComputeJobStatus {
  /** Locale key (`compute.status.*`) and its params. */
  key: string;
  params: Record<string, unknown>;
}

/** The status line of a job: the one mapping of job state to a locale key. */
export function computeJobStatus(job: ComputeJob): ComputeJobStatus {
  switch (job.state) {
    case 'submitted-pycore': return { key: 'compute.status.runningPycore', params: {} };
    case 'submitted-laravel':
      return job.unavailable
        ? { key: 'compute.status.queuedNoPycore', params: { ...job.unavailable } }
        : { key: 'compute.status.queuedLaravel', params: {} };
    case 'done': return { key: 'compute.status.done', params: {} };
    case 'failed': return { key: 'compute.status.failed', params: { code: job.errorCode ?? '' } };
    default:
      if (job.unavailable) return { key: 'compute.status.unavailable', params: { ...job.unavailable } };
      if (job.errorCode) return { key: 'compute.status.retrying', params: { code: job.errorCode, attempts: job.failures } };
      return { key: 'compute.status.waiting', params: {} };
  }
}
