<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;

/**
 * AppQyV1 Cover Maintenance Timer Task (pull-only architecture).
 *
 * Cover/image generation is NO LONGER driven here. pycore is the sole driver:
 * its AssistWorker polls /api/app_qy_v1/assist/claim, generates locally via the
 * unified AI gateway and submits results back (see
 * poly_apps/laravel_main/docs/COVER_PULL_ARCHITECTURE.md). This task is repurposed to
 * MAINTENANCE-ONLY - it recovers stuck rows so pycore can always make progress
 * and never calls any AI client.
 *
 * Every tick (5s) it runs one transactional pass that:
 *   - resets `failed` rows (cover_attempts >= MAX_RETRIES AND cover_finished_at
 *     older than the failed cooldown) back to `pending`, cover_attempts = 0,
 *     clearing the assist lease + cover_error_message so pycore re-claims them;
 *   - resets `processing` rows stuck older than the assist lease (60 min) back
 *     to `pending`;
 *   - clears stale `assist_claimed_at`/`_by` leases older than 60 min.
 *
 * Cover state lives on the cover_* columns of vocabulary_libraries (the
 * vocabulary_covers table was absorbed by the Wave A consolidation). Only
 * libraries whose cover was actually REQUESTED carry cover_filename, so
 * cover_filename IS NULL means "never requested".
 */
class AppQyV1CoverGenerationTask extends OctaneTimerTaskAbstract
{
    // Public: shared with the assist claim/status endpoints so external
    // workers and the dashboard see the exact pending/retry rules.
    public const BATCH_SIZE = 3;
    public const MAX_RETRIES = 3;
    public const RETRY_DELAY_MINUTES = 5;

    // Cooldown before a failed row is recycled back to pending (gives the FE
    // a window to surface the error / offer retry before auto-recovery).
    private const FAILED_COOLDOWN_MINUTES = 10;

    private const INTERVAL_SECONDS = 5;

    /**
     * @inheritDoc
     */
    public function getName(): string
    {
        return 'appqyv1_cover_generation';
    }

    /**
     * @inheritDoc
     */
    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
    }

    /**
     * @inheritDoc
     */
    public function exec(): void
    {
        try {
            $recovered = $this->runMaintenance();

            if ($recovered['total'] > 0) {
                $this->logInfo('Cover maintenance recovered stuck rows', $recovered);
            }
        } catch (\Throwable $e) {
            $this->logError('Cover maintenance task failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        // Warm the assist pending-work snapshot cache on every tick so third
        // parties (pycore) and the dashboard poll /assist/pending cheaply without
        // ever running the aggregate queries themselves. Best-effort: a failure
        // here must never break cover maintenance above.
        try {
            (new \App\Apps\AppQyV1\AppQyV1Services\AppQyV1AssistService())->pendingSnapshot(true);
        } catch (\Throwable $e) {
            $this->logError('Assist pending-snapshot warm failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * @inheritDoc
     *
     * Gated by APPQYV1_COVER_MAINTENANCE_ENABLED (default true). The retired
     * APPQYV1_COVER_GENERATION_ENABLED is honored for backward compatibility:
     * when present it acts as the maintenance gate. Either being false disables
     * the pass; default true.
     */
    public function isEnabled(): bool
    {
        $maintenance = env('APPQYV1_COVER_MAINTENANCE_ENABLED', true);
        $legacy = env('APPQYV1_COVER_GENERATION_ENABLED', true);

        return (bool) $maintenance && (bool) $legacy;
    }

    /**
     * One transactional maintenance pass. Returns per-bucket recovery counts.
     *
     * @return array{failed:int,processing:int,stale_leases:int,total:int}
     */
    private function runMaintenance(): array
    {
        $model = new AppQyV1VocabularyLibraryModel();

        return $model->getConnection()->transaction(function () {
            $leaseBefore = now()->subMinutes(AppQyV1DictionaryTTSCoordinator::ASSIST_LEASE_MINUTES);

            // 1) failed rows past their retry budget AND cooldown -> requeue.
            $failed = AppQyV1VocabularyLibraryModel::query()
                ->whereNotNull('cover_filename')
                ->where('cover_status', 'failed')
                ->where('cover_attempts', '>=', self::MAX_RETRIES)
                ->where('cover_finished_at', '<=', now()->subMinutes(self::FAILED_COOLDOWN_MINUTES))
                ->update([
                    'cover_status' => 'pending',
                    'cover_attempts' => 0,
                    'cover_error_message' => null,
                    'assist_claimed_at' => null,
                    'assist_claimed_by' => null,
                ]);

            // 2) processing rows stuck past the lease window -> back to pending.
            $processing = AppQyV1VocabularyLibraryModel::query()
                ->whereNotNull('cover_filename')
                ->where('cover_status', 'processing')
                ->where('cover_started_at', '<=', $leaseBefore)
                ->update([
                    'cover_status' => 'pending',
                    'assist_claimed_at' => null,
                    'assist_claimed_by' => null,
                ]);

            // 3) stale assist leases (> 60 min) -> cleared so pycore can reclaim.
            $staleLeases = AppQyV1VocabularyLibraryModel::query()
                ->whereNotNull('assist_claimed_at')
                ->where('assist_claimed_at', '<', $leaseBefore)
                ->update([
                    'assist_claimed_at' => null,
                    'assist_claimed_by' => null,
                ]);

            return [
                'failed' => (int) $failed,
                'processing' => (int) $processing,
                'stale_leases' => (int) $staleLeases,
                'total' => (int) $failed + (int) $processing + (int) $staleLeases,
            ];
        }, 1);
    }
}
