/** Wiring of one scheduler: shared pycore availability, an app-supplied Laravel source, a durable job journal. */
import { createIdbKeyValueStore } from '../../persistence/IdbKeyValueStore';
import { ComputeAvailability, type AvailabilitySource, type ComputeAvailabilityOptions } from './ComputeAvailability';
import { ComputeScheduler, type ComputeSchedulerOptions } from './ComputeScheduler';
import { createPycoreAvailabilitySource, createPycoreChannelInputs } from './PycoreComputeSource';
import type { ComputeJob } from './ComputeTypes';

const JOURNAL_STORE = 'jobs';

export interface ComputeServiceOptions {
  /** Journal database name (one per app). */
  journalName: string;
  laravel: AvailabilitySource;
  /** App rule added to the pycore availability. */
  pycoreGate?: () => boolean;
  availability?: ComputeAvailabilityOptions;
  scheduler?: Partial<Pick<ComputeSchedulerOptions, 'parallel' | 'failoverAfterMs' | 'pollMs' | 'retentionMs'>>;
}

export function createComputeScheduler(options: ComputeServiceOptions): ComputeScheduler {
  const availability = new ComputeAvailability(
    { pycore: createPycoreAvailabilitySource(options.pycoreGate), laravel: options.laravel },
    { channels: createPycoreChannelInputs(), ...options.availability },
  );
  // Routers read the availability before the scheduler's journal has loaded: it starts now.
  availability.start();
  return new ComputeScheduler({
    availability,
    journal: createIdbKeyValueStore<ComputeJob>(options.journalName, JOURNAL_STORE),
    ...options.scheduler,
  });
}
