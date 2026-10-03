import type { OrchComposeSession } from '../../../../shared/orchestration/orchComposer';
import type { OrchResolveCounts } from '../../../../shared/orchestration/orchTypes';
import { floorOrchCounts } from '../../services/orchestration/WordNewOrchCountsFloor';

export interface OrchRunProgress {
  /** The run's counters, never going down across runs of the same plan. */
  counts: OrchResolveCounts | undefined;
  total: number;
  /** Clips with a final answer this run (on the device or reported missing). */
  settled: number;
  /** Share of clips that are on the device: missing ones (waiting for generation) do not count. */
  percent: number;
  /** Clips being transferred right now. */
  loading: number;
}

/** Whole-number share of `done` in `total` (0 when the total is unknown). */
export function orchShare(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/** The one derivation of a run's totals and percent, used by every widget that shows them. */
export function orchRunProgress(session: OrchComposeSession | null): OrchRunProgress {
  const counts = session ? floorOrchCounts(session.planHash, session.counts) : undefined;
  const total = counts?.total ?? 0;
  const settled = total - (counts?.pending ?? 0);
  const resolved = settled - (counts?.missing ?? 0);
  return { counts, total, settled, percent: orchShare(resolved, total), loading: session?.table?.loading.size ?? 0 };
}
