<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AssistService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SubtitleModel as Subtitle;

/**
 * AppQyV1 Poster Collection / Maintenance Timer Task (pull-only architecture).
 *
 * Poster fetching is NOT done here. mcp-chrome claims poster work through the
 * assist API, searches for a suitable source, and submits the bytes under a
 * 60-minute lease. This task only keeps claimable rows flowing and never calls
 * a search, image, or movie-database provider.
 *
 * Posters live on the poster_* columns of BOTH media tables (books + subtitles).
 * A row's claimable state is poster_status (pending|ready|failed|none); the
 * stored file is named <source_key>.<ext> by MoviePosterStore at submit time, so
 * pending rows need no separate filename slot — they are claimable as-is.
 *
 * Every tick (5s) one pass per media table:
 *   - (re)queues 'failed' posters older than the FAILED backoff back to
 *     'pending' (clearing the lease + poster_fetched_at) so mcp-chrome reclaims
 *     them — a transient fetch failure is retried, not stuck forever;
 *   - clears stale assist leases (> 60 min) so a dead worker's claims free up.
 *
 * Rows marked 'none' (no poster exists in any provider) and 'ready' are left
 * alone. Idempotent + index-backed: zero-row UPDATEs once nothing is stale.
 */
class AppQyV1PosterCollectionTask extends OctaneTimerTaskAbstract
{
    // Cooldown before a failed poster is recycled back to pending (shared with
    // the assist claim's failed-backoff so the two agree on retry timing).
    public const FAILED_BACKOFF_MINUTES = AppQyV1AssistService::POSTER_FAILED_BACKOFF_MINUTES;

    private const INTERVAL_SECONDS = 5;

    public function getName(): string
    {
        return 'appqyv1_poster_collection';
    }

    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
    }

    /**
     * Gated by APPQYV1_POSTER_COLLECTION_ENABLED (default true).
     */
    public function isEnabled(): bool
    {
        return (bool) env('APPQYV1_POSTER_COLLECTION_ENABLED', true);
    }

    public function exec(): void
    {
        try {
            $recovered = $this->runMaintenance();
            if ($recovered['total'] > 0) {
                $this->logInfo('Poster maintenance recovered stuck rows', $recovered);
            }
        } catch (\Throwable $e) {
            $this->logError('Poster maintenance task failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * One maintenance pass across BOTH media tables.
     *
     * @return array{requeued:int,stale_leases:int,total:int}
     */
    private function runMaintenance(): array
    {
        $leaseBefore = now()->subMinutes(AppQyV1DictionaryTTSCoordinator::ASSIST_LEASE_MINUTES);
        $failedBefore = now()->subMinutes(self::FAILED_BACKOFF_MINUTES);

        $requeued = 0;
        $staleLeases = 0;

        foreach ([Book::class, Subtitle::class] as $modelClass) {
            $recovered = $modelClass::recoverPosterMaintenance($failedBefore, $leaseBefore);
            $requeued += $recovered['requeued'];
            $staleLeases += $recovered['stale_leases'];
        }

        return [
            'requeued' => $requeued,
            'stale_leases' => $staleLeases,
            'total' => $requeued + $staleLeases,
        ];
    }
}
