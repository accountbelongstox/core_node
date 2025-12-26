<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyCoverModel;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Services\GeminiClient;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

/**
 * AppQyV1 Cover Generation Timer Task
 *
 * Actively polls database every 5 seconds for pending cover generation tasks.
 * Processes up to 3 covers per tick using Gemini API with automatic rate limiting.
 *
 * Benefits over PassiveQueue:
 * - Predictable execution (every 5 seconds)
 * - Atomic deduplication via database transactions
 * - Batch processing for efficiency
 * - Automatic retry on rate limits
 * - Integrated with OctaneTimerService monitoring
 */
class AppQyV1CoverGenerationTask extends OctaneTimerTaskAbstract
{
    private const BATCH_SIZE = 3;
    private const INTERVAL_SECONDS = 5;
    private const MAX_RETRIES = 3;
    private const RETRY_DELAY_MINUTES = 5;

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
            $pendingCovers = $this->fetchPendingCovers();

            if ($pendingCovers->isEmpty()) {
                return;
            }

            $this->logInfo("Found {$pendingCovers->count()} pending covers to process");

            $processed = 0;
            $succeeded = 0;
            $failed = 0;
            $rateLimited = 0;

            foreach ($pendingCovers as $cover) {
                $result = $this->processCover($cover);

                $processed++;

                if ($result['status'] === 'success') {
                    $succeeded++;
                } elseif ($result['status'] === 'rate_limited') {
                    $rateLimited++;
                    $this->logWarning("Rate limited, will retry later", [
                        'cover_id' => $cover->id,
                        'retry_after' => $result['retry_after'] ?? 60,
                    ]);
                    break;
                } else {
                    $failed++;
                }
            }

            if ($processed > 0) {
                $this->logInfo("Batch completed", [
                    'processed' => $processed,
                    'succeeded' => $succeeded,
                    'failed' => $failed,
                    'rate_limited' => $rateLimited,
                ]);
            }

        } catch (\Throwable $e) {
            $this->logError('Cover generation task failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
    }

    /**
     * @inheritDoc
     */
    public function isEnabled(): bool
    {
        return env('APPQYV1_COVER_GENERATION_ENABLED', true);
    }

    /**
     * Fetch pending covers with priority ordering
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    private function fetchPendingCovers()
    {
        return AppQyV1VocabularyCoverModel::query()
            ->where(function ($query) {
                $query->where('status', 'pending')
                    ->orWhere(function ($retryQuery) {
                        $retryQuery->where('status', 'retry')
                            ->where('finished_at', '<=', now()->subMinutes(self::RETRY_DELAY_MINUTES));
                    });
            })
            ->orderByDesc('priority')
            ->orderBy('last_requested_at')
            ->limit(self::BATCH_SIZE)
            ->get();
    }

    /**
     * Process a single cover with transaction and locking
     *
     * @param AppQyV1VocabularyCoverModel $cover
     * @return array
     */
    private function processCover(AppQyV1VocabularyCoverModel $cover): array
    {
        try {
<<<<<<< HEAD
            return DB::connection('AppQyV1')->transaction(function () use ($cover) {
=======
            return DB::connection('appqyv1')->transaction(function () use ($cover) {
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
                $lockedCover = AppQyV1VocabularyCoverModel::query()
                    ->where('id', $cover->id)
                    ->whereIn('status', ['pending', 'retry'])
                    ->lockForUpdate()
                    ->first();

                if (!$lockedCover) {
                    return [
                        'status' => 'skipped',
                        'reason' => 'Already processed by another worker',
                    ];
                }

                $lockedCover->status = 'processing';
                $lockedCover->started_at = now();
                $lockedCover->attempts = ($lockedCover->attempts ?? 0) + 1;
                $lockedCover->save();

                $result = $this->generateCoverImage($lockedCover);

                if ($result['status'] === 'success') {
                    $lockedCover->status = 'ready';
                    $lockedCover->error_message = null;
                    $lockedCover->last_generated_at = now();
                    $lockedCover->finished_at = now();

                    if (isset($result['width'])) {
                        $lockedCover->width = $result['width'];
                    }
                    if (isset($result['height'])) {
                        $lockedCover->height = $result['height'];
                    }

                    $lockedCover->save();

                    $this->logInfo("Cover generated successfully", [
                        'cover_id' => $lockedCover->id,
                        'library_id' => $lockedCover->library_id,
                        'filename' => $lockedCover->cover_filename,
                    ]);

                    return ['status' => 'success'];

                } elseif ($result['status'] === 'rate_limited') {
                    $lockedCover->status = 'retry';
                    $lockedCover->error_message = 'Rate limited: ' . ($result['error'] ?? 'Unknown');
                    $lockedCover->finished_at = now();
                    $lockedCover->save();

                    return [
                        'status' => 'rate_limited',
                        'retry_after' => $result['retry_after'] ?? 60,
                    ];

                } else {
                    $shouldRetry = $lockedCover->attempts < self::MAX_RETRIES;

                    $lockedCover->status = $shouldRetry ? 'retry' : 'failed';
                    $lockedCover->error_message = $result['error'] ?? 'Unknown error';
                    $lockedCover->finished_at = now();
                    $lockedCover->save();

                    $this->logError("Cover generation failed", [
                        'cover_id' => $lockedCover->id,
                        'attempts' => $lockedCover->attempts,
                        'will_retry' => $shouldRetry,
                        'error' => $result['error'] ?? 'Unknown',
                    ]);

                    return ['status' => 'failed'];
                }
            }, 1);

        } catch (\Throwable $e) {
            $this->logError("Cover processing exception", [
                'cover_id' => $cover->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'status' => 'failed',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Generate cover image using Gemini API
     *
     * @param AppQyV1VocabularyCoverModel $cover
     * @return array
     */
    private function generateCoverImage(AppQyV1VocabularyCoverModel $cover): array
    {
        try {
            $gemini = app(GeminiClient::class);

            if (!$gemini->hasApiKey()) {
                return [
                    'status' => 'failed',
                    'error' => 'Gemini API key not configured',
                ];
            }

            $prompt = $cover->prompt ?: 'Design a modern vocabulary learning cover art';

            $result = $gemini->generateImageFromPrompt($prompt, [
                'model' => 'gemini-2.5-flash-image',
                'size' => ($cover->width ?? 1024) . 'x' . ($cover->height ?? 1024),
            ]);

            if (!($result['success'] ?? false)) {
                if (isset($result['rate_limited']) && $result['rate_limited']) {
                    return [
                        'status' => 'rate_limited',
                        'error' => $result['error'] ?? 'Rate limit exceeded',
                        'retry_after' => $result['retry_after'] ?? 60,
                    ];
                }

                return [
                    'status' => 'failed',
                    'error' => $result['error'] ?? 'Unknown Gemini error',
                ];
            }

            $coverService = app(AppQyV1VocabularyCoverService::class);
            $path = $coverService->getCoverPath($cover->cover_filename);

            File::put($path, $result['binary']);

            return [
                'status' => 'success',
                'width' => $result['width'] ?? $cover->width,
                'height' => $result['height'] ?? $cover->height,
            ];

        } catch (\Throwable $e) {
            return [
                'status' => 'failed',
                'error' => $e->getMessage(),
            ];
        }
    }
}
