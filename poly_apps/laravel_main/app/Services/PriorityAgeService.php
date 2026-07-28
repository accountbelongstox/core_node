<?php

namespace App\Services;

use App\Models\GlobalTask;
use Illuminate\Support\Facades\DB;

/**
 * Priority aging — anti-starvation for the queue.
 *
 * Introducing a deliberate FAST tier (interactive remote_fast tasks at
 * priority 100) risks indefinitely starving background work (scan tasks at
 * priority 0) on a busy queue. This service nudges long-waiting PENDING tasks up
 * a little each maintenance tick so they eventually climb and complete, WITHOUT
 * ever reaching the interactive fast tier (capped at PRIORITY_FAST - 1). Bounded
 * per tick so it never holds a long lock. Idempotent and side-effect-light.
 */
class PriorityAgeService
{
    /**
     * Age long-waiting pending tasks upward.
     *
     * @param int $maxCount           Max rows touched per tick (lock-bound).
     * @param int $ageThresholdMinutes Only tasks pending at least this long age.
     * @param int $incrementValue      Priority increment per tick.
     * @return int Number of tasks aged.
     */
    public function ageTasksPriority(int $maxCount = 100, int $ageThresholdMinutes = 5, int $incrementValue = 1): int
    {
        // Never let an aged background task reach the interactive fast tier.
        $cap = GlobalTask::priority('fast') - 1;
        $increment = max(1, $incrementValue);
        $cutoff = now()->subMinutes(max(1, $ageThresholdMinutes));

        $ids = GlobalTask::pending()
            ->where('priority', '<=', $cap - $increment)
            ->where('created_at', '<', $cutoff)
            ->orderBy('created_at', 'asc')
            ->limit(max(1, $maxCount))
            ->pluck('id');

        if ($ids->isEmpty()) {
            return 0;
        }

        // priority <= cap - increment guarantees priority + increment <= cap for
        // ANY increment, so the raw arithmetic bump can never reach PRIORITY_FAST
        // and stays cross-DB safe (no LEAST/MIN needed).
        return (int) GlobalTask::whereIn('id', $ids)
            ->update(['priority' => DB::raw('priority + ' . $increment)]);
    }
}
