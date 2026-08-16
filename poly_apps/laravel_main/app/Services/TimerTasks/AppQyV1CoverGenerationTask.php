<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Services\UserConfig\UserConfigService;

/**
 * AppQyV1 Cover Maintenance Timer Task (pull-only architecture).
 *
 * Cover/image generation is not driven here. apps/mcp-chrome owns search,
 * download and submission through the shared assist endpoints. This task is
 * maintenance-only: it recovers stuck rows and never calls an image provider.
 *
 * Every tick (5s) it runs one transactional pass that:
 *   - resets `failed` rows (cover_attempts >= MAX_RETRIES AND cover_finished_at
 *     older than the failed cooldown) back to `pending`, cover_attempts = 0,
 *     clearing the assist lease + cover_error_message for mcp-chrome to reclaim;
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
    // Failed cover claims are immediately eligible for another pull.
    public const RETRY_DELAY_MINUTES = 0;

    // Failed rows at the retry limit are recycled immediately so the queue
    // never leaves work stranded in a terminal failed bucket.
    private const FAILED_COOLDOWN_MINUTES = 0;

    private const INTERVAL_SECONDS = 5;

    // Reconcile ready-but-missing cover files every Nth tick (~60s at 5s/tick)
    // rather than every tick: stat-checking files is cheap but pointless to do
    // every 5s. Static so it survives however the timer reuses the task.
    private const RECONCILE_EVERY_TICKS = 12;
    private static int $tick = 0;

    // Proactively seed cover-missing PUBLIC libraries into the claim pool this
    // many rows per pass. Bounded so each tick stays cheap even on a fresh
    // catalogue with thousands of never-rendered libraries.
    private const SEED_BATCH = 50;

    // Only seed once every Nth tick (~30s at 5s/tick): a cover-missing library
    // does not need sub-minute latency to enter the queue, and this keeps the
    // extra query off most ticks.
    private const SEED_EVERY_TICKS = 6;

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

        // Proactively enrol cover-missing PUBLIC libraries into the claim pool
        // so the mcp-chrome media image worker can search for a cover
        // WITHOUT the library first being rendered on the home page (rendering is
        // what otherwise lazily initialises the cover_* columns via
        // AppQyV1VocabularyCoverService::getCoverData). Throttled + bounded;
        // idempotent (only cover_filename-NULL rows are touched).
        self::$tick++;
        if (self::$tick % self::SEED_EVERY_TICKS === 0) {
            try {
                $seeded = $this->seedMissingCovers();
                if ($seeded > 0) {
                    $this->logInfo('Cover seeding enrolled cover-missing libraries', ['seeded' => $seeded]);
                }
            } catch (\Throwable $e) {
                $this->logError('Cover seeding failed', ['error' => $e->getMessage()]);
            }
        }

        // Dynamic recovery: periodically re-queue covers marked 'ready' whose
        // file vanished on disk (so a missing cover is always regenerated),
        // throttled to ~once/minute since it stat-checks files.
        if (self::$tick % self::RECONCILE_EVERY_TICKS === 0) {
            try {
                $r = (new \App\Apps\AppQyV1\AppQyV1Services\AppQyV1AssistService())
                    ->reconcileMissingCovers();
                if (($r['reset'] ?? 0) > 0) {
                    $this->logInfo('Cover reconcile re-queued missing-file covers', $r);
                }
            } catch (\Throwable $e) {
                $this->logError('Cover reconcile failed', ['error' => $e->getMessage()]);
            }
        }

        // The assist pending-work snapshot (/assist/pending, /assist/status)
        // is published by AppQyV1OverviewWarmTask every 20s; this task must
        // not warm it (its flexible-based warm was a silent no-op inside an
        // Octane tick anyway).
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
        $settings = app(UserConfigService::class);
        $maintenance = $settings->get(UserConfigService::APPQYV1_COVER_MAINTENANCE_ENABLED, true);
        $legacy = $settings->get(UserConfigService::APPQYV1_COVER_GENERATION_ENABLED, true);

        return (bool) $maintenance && (bool) $legacy;
    }

    /**
     * One transactional maintenance pass. Returns per-bucket recovery counts.
     *
     * @return array{failed:int,processing:int,stale_leases:int,total:int}
     */
    private function runMaintenance(): array
    {
        $leaseBefore = now()->subMinutes(AppQyV1DictionaryTTSCoordinator::ASSIST_LEASE_MINUTES);
        $failedBefore = now()->subMinutes(self::FAILED_COOLDOWN_MINUTES);

        return AppQyV1VocabularyLibraryModel::recoverCoverMaintenance(
            self::MAX_RETRIES,
            $failedBefore,
            $leaseBefore
        );
    }

    /**
     * Enrol cover-missing PUBLIC libraries into the assist claim pool.
     *
     * A library is only claimable once its cover_* columns are initialised
     * (cover_filename set + cover_status 'pending'); until then claimCovers'
     * whereNotNull('cover_filename') skips it. That initialisation normally
     * happens lazily inside AppQyV1VocabularyCoverService::getCoverData when the
     * library is rendered on a home/libraries page — so a never-browsed library
     * never enters the queue and the media_image worker never scrapes it.
     *
     * This pass performs the SAME initialisation proactively for a bounded batch
     * of public libraries whose cover_filename is still NULL/empty, mirroring the
     * getCoverData init block exactly (deterministic filename, pending status,
     * default priority). Idempotent + fill-missing: a
     * library that already carries a cover_filename is never touched, so an
     * existing (scraped or generated) cover is never clobbered.
     *
     * @return int number of libraries enrolled this pass
     */
    private function seedMissingCovers(): int
    {
        $rows = AppQyV1VocabularyLibraryModel::missingPublicCovers(self::SEED_BATCH);

        if ($rows->isEmpty()) {
            return 0;
        }

        $coverService = new AppQyV1VocabularyCoverService();
        $seeded = 0;

        foreach ($rows as $library) {
            // Deterministic filename (md5 of id+slug) matches getCoverData, so a
            // later render resolves to the same on-disk path — no divergence.
            $library->cover_filename = $coverService->buildFilename($library);
            $library->cover_status = 'pending';
            if (!$library->cover_priority) {
                $library->cover_priority = 5;
            }
            $library->cover_last_requested_at = now();
            $library->saveRecord();
            $seeded++;
        }

        return $seeded;
    }
}
