/**
 * The resolve counters a task shows never go down across runs of the same plan: a run restarts from a
 * fresh table (every clip pending until its stages answer), which made "device", "missing" and the percent
 * jump backwards between runs. The floor keeps the highest settled / device / pycore / Laravel figures seen
 * per plan hash; missing and generating are derived from them, so the parts always add up to the total.
 */
import type { OrchResolveCounts } from '../../../../shared/orchestration/orchTypes';

interface Floor {
  total: number;
  settled: number;
  device: number;
  pycore: number;
  laravel: number;
}

const floors = new Map<string, Floor>();

/** The counters to show for a plan hash: the run's own figures, raised to the highest seen so far. */
export function floorOrchCounts(planHash: string, counts: OrchResolveCounts): OrchResolveCounts {
  if (counts.total <= 0) return counts;
  const settled = counts.total - counts.pending;
  const kept = floors.get(planHash);
  const floor: Floor = kept && kept.total === counts.total ? kept : { total: counts.total, settled: 0, device: 0, pycore: 0, laravel: 0 };
  floor.settled = Math.max(floor.settled, settled);
  floor.device = Math.max(floor.device, counts.device);
  floor.pycore = Math.max(floor.pycore, counts.pycore);
  floor.laravel = Math.max(floor.laravel, counts.laravel);
  floors.set(planHash, floor);
  const have = Math.min(floor.settled, floor.device + floor.pycore + floor.laravel);
  const missing = Math.max(0, floor.settled - have);
  return {
    ...counts,
    device: floor.device,
    pycore: floor.pycore,
    laravel: floor.laravel,
    missing,
    generating: Math.min(counts.generating, missing),
    pending: counts.total - floor.settled,
  };
}

/** Local caches were cleared: nothing seen before is valid. */
export function resetOrchCountsFloor(): void {
  floors.clear();
}
