<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Services\TimerTasks\AppQyV1CoverGenerationTask;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

/**
 * Third-party assist protocol - claim/submit/release/status semantics.
 *
 * External workers (pycore) claim units of work, generate them with their own
 * providers and report results back. Every claim carries a 60-minute lease:
 *
 *   - cover: lease lives on vocabulary_libraries.assist_claimed_at/_by.
 *     The local cover timer (AppQyV1CoverGenerationTask) skips live leases
 *     and reclaims expired ones (clearing the stale lease on takeover).
 *   - tts (words): reuses the canonical tts_locked_at/_by claim columns via
 *     AppQyV1DictionaryTTSCoordinator with worker ids prefixed 'assist:' -
 *     such locks expire after 60 minutes instead of the local 10.
 *   - word translations are NOT routed through this service: pycore already
 *     pulls them via the global task system (/api/worker/tasks/pull +
 *     /api/worker/tasks/result); GlobalTaskMaintenanceTask releases timed-out
 *     claims there (word_translation timeout_seconds caps at 600s).
 *
 * Submits are fill-missing: an already-completed unit is acknowledged with
 * already_done=true and the existing artifact is never clobbered.
 */
class AppQyV1AssistService
{
    public const LEASE_MINUTES = AppQyV1DictionaryTTSCoordinator::ASSIST_LEASE_MINUTES;

    private AppQyV1DictionaryTTSCoordinator $coordinator;
    private AppQyV1VocabularyCoverService $coverService;

    public function __construct(
        ?AppQyV1DictionaryTTSCoordinator $coordinator = null,
        ?AppQyV1VocabularyCoverService $coverService = null
    ) {
        $this->coordinator = $coordinator ?: new AppQyV1DictionaryTTSCoordinator();
        $this->coverService = $coverService ?: new AppQyV1VocabularyCoverService();
    }

    /** tts_locked_by identity for an assist claimer. */
    public static function assistWorkerId(string $claimer): string
    {
        return AppQyV1DictionaryTTSCoordinator::ASSIST_WORKER_PREFIX . $claimer;
    }

    /**
     * Whether the assist (pull-mode) surface is enabled. Gated by env
     * APPQYV1_ASSIST_ENABLED, default true (pull mode is the primary path).
     * When false the claim/submit/release/retry endpoints back off cleanly.
     */
    public static function isAssistEnabled(): bool
    {
        return (bool) env('APPQYV1_ASSIST_ENABLED', true);
    }

    // ------------------------------------------------------------------
    // Cover claims
    // ------------------------------------------------------------------

    /**
     * Atomically claim up to $limit cover jobs. Claimable = the timer's own
     * pending/retry rules AND no live assist lease. Rows keep their
     * pending/retry status; the lease alone makes the timer skip them.
     *
     * @return array<int, array{type:string,id:int,payload:array}>
     */
    public function claimCovers(string $claimer, int $limit): array
    {
        $limit = max(1, min(10, $limit));

        $model = new AppQyV1VocabularyLibraryModel();

        return $model->getConnection()->transaction(function () use ($claimer, $limit) {
            $rows = AppQyV1VocabularyLibraryModel::query()
                ->whereNotNull('cover_filename')
                ->where(function ($query) {
                    $query->where('cover_status', 'pending')
                        ->orWhere(function ($retryQuery) {
                            $retryQuery->where('cover_status', 'retry')
                                ->where('cover_finished_at', '<=', now()->subMinutes(AppQyV1CoverGenerationTask::RETRY_DELAY_MINUTES));
                        });
                })
                ->where(function ($query) {
                    $query->whereNull('assist_claimed_at')
                        ->orWhere('assist_claimed_at', '<', now()->subMinutes(self::LEASE_MINUTES));
                })
                ->orderByDesc('cover_priority')
                ->orderBy('cover_last_requested_at')
                ->limit($limit)
                ->lockForUpdate()
                ->get();

            $items = [];
            foreach ($rows as $library) {
                $prompt = $library->cover_prompt;
                if ($prompt === null || $prompt === '') {
                    $prompt = $this->coverService->buildPrompt($library);
                    $library->cover_prompt = $prompt;
                }

                $library->assist_claimed_at = now();
                $library->assist_claimed_by = mb_substr($claimer, 0, 64);
                $library->save();

                $items[] = [
                    'type' => 'cover',
                    'id' => (int) $library->id,
                    'payload' => [
                        'name' => $library->name,
                        'prompt' => $prompt,
                        'size' => ($library->cover_width ?? 1024) . 'x' . ($library->cover_height ?? 1024),
                        'filename' => $library->cover_filename,
                    ],
                ];
            }

            return $items;
        }, 1);
    }

    /**
     * Ingest one generated cover. Idempotent: a library whose cover is
     * already ready (file on disk) is acknowledged without rewriting.
     *
     * @return array{ok:bool,status:string,already_done?:bool,error?:string,http_status:int}
     */
    public function submitCover(int $libraryId, string $imageBase64, ?string $mime): array
    {
        $library = AppQyV1VocabularyLibraryModel::query()->find($libraryId);
        if (!$library) {
            return ['ok' => false, 'status' => 'not_found', 'error' => 'Library not found', 'http_status' => 404];
        }

        if ($library->cover_filename === null || $library->cover_filename === '') {
            // Defensive: claims only hand out requested covers, but a stray
            // submit must not write to an empty path.
            return ['ok' => false, 'status' => 'invalid', 'error' => 'Library cover was never requested', 'http_status' => 422];
        }

        // Fill-missing, never clobber: already ready with a file -> ack only.
        if ($library->cover_status === 'ready' && $this->coverService->hasCoverFile($library->cover_filename)) {
            $this->clearCoverLease($library);
            return ['ok' => true, 'status' => 'ready', 'already_done' => true, 'http_status' => 200];
        }

        $binary = base64_decode($imageBase64, true);
        if ($binary === false || $binary === '') {
            return ['ok' => false, 'status' => 'invalid', 'error' => 'image_base64 is not valid base64', 'http_status' => 422];
        }
        if (!self::looksLikeImage($binary)) {
            return ['ok' => false, 'status' => 'invalid', 'error' => 'Payload failed image validation (png/jpeg/webp/gif magic expected)', 'http_status' => 422];
        }

        $path = $this->coverService->getCoverPath($library->cover_filename);
        try {
            $written = File::put($path, $binary);
        } catch (\Throwable $e) {
            $written = false;
        }
        if ($written === false || $written !== strlen($binary)) {
            Log::error('[Assist] Failed to persist submitted cover', [
                'library_id' => $libraryId,
                'path' => $path,
            ]);
            return ['ok' => false, 'status' => 'error', 'error' => 'Failed to persist cover file', 'http_status' => 500];
        }

        $library->cover_status = 'ready';
        $library->cover_error_message = null;
        $library->cover_last_generated_at = now();
        $library->cover_finished_at = now();
        $library->assist_claimed_at = null;
        $library->assist_claimed_by = null;
        $library->save();

        Log::info('[Assist] Cover submitted by assist worker', [
            'library_id' => $libraryId,
            'filename' => $library->cover_filename,
            'bytes' => strlen($binary),
            'mime' => $mime,
        ]);

        return ['ok' => true, 'status' => 'ready', 'http_status' => 200];
    }

    /**
     * Release cover claims back to the queue. Non-ready rows get retry
     * semantics (cover_status='retry' + error message + finished_at so the
     * normal retry delay applies); ready rows only lose the lease.
     */
    public function releaseCovers(array $ids, ?string $error): int
    {
        $ids = array_values(array_filter(array_map('intval', $ids), static fn ($id) => $id > 0));
        if (empty($ids)) {
            return 0;
        }

        $released = AppQyV1VocabularyLibraryModel::query()
            ->whereIn('id', $ids)
            ->whereNotNull('assist_claimed_at')
            ->count();

        // Only rows actually holding a lease are touched: a stray release for
        // an id the local timer owns must not disturb its processing state.
        AppQyV1VocabularyLibraryModel::query()
            ->whereIn('id', $ids)
            ->whereNotNull('assist_claimed_at')
            ->where('cover_status', '!=', 'ready')
            ->update([
                'cover_status' => 'retry',
                'cover_error_message' => mb_substr($error ?: 'Released by assist worker', 0, 2000),
                'cover_finished_at' => now(),
                'assist_claimed_at' => null,
                'assist_claimed_by' => null,
            ]);

        AppQyV1VocabularyLibraryModel::query()
            ->whereIn('id', $ids)
            ->whereNotNull('assist_claimed_at')
            ->update([
                'assist_claimed_at' => null,
                'assist_claimed_by' => null,
            ]);

        return $released;
    }

    /**
     * Explicit retry of failed/stuck covers. Resets matching rows to pending,
     * cover_attempts = 0, clearing the assist lease + cover_error_message so
     * the maintenance pass / assist claim re-queues them for pycore.
     *
     * Scope: rows in 'failed' or 'retry' status (requested covers only). With
     * $all=true every such row is reset; otherwise only the given ids.
     *
     * @param int[] $ids
     * @return int number of rows reset
     */
    public function retryFailedCovers(array $ids = [], bool $all = false): int
    {
        $query = AppQyV1VocabularyLibraryModel::query()
            ->whereNotNull('cover_filename')
            ->whereIn('cover_status', ['failed', 'retry']);

        if (!$all) {
            $ids = array_values(array_filter(array_map('intval', $ids), static fn ($id) => $id > 0));
            if (empty($ids)) {
                return 0;
            }
            $query->whereIn('id', $ids);
        }

        return (int) $query->update([
            'cover_status' => 'pending',
            'cover_attempts' => 0,
            'cover_error_message' => null,
            'assist_claimed_at' => null,
            'assist_claimed_by' => null,
        ]);
    }

    /** Cover queue counters (requested covers only: cover_filename set). */
    public function coverCounts(): array
    {
        $base = fn () => AppQyV1VocabularyLibraryModel::query()->whereNotNull('cover_filename');

        $counts = [
            'pending' => (int) $base()->where('cover_status', 'pending')->count(),
            'retry' => (int) $base()->where('cover_status', 'retry')->count(),
            'processing' => (int) $base()->where('cover_status', 'processing')->count(),
            'ready' => (int) $base()->where('cover_status', 'ready')->count(),
            'failed' => (int) $base()->where('cover_status', 'failed')->count(),
        ];
        $counts['total'] = array_sum($counts);
        $counts['leased'] = (int) $base()
            ->where('assist_claimed_at', '>=', now()->subMinutes(self::LEASE_MINUTES))
            ->count();

        return $counts;
    }

    // ------------------------------------------------------------------
    // TTS claims (canonical dictionary word rows via the coordinator)
    // ------------------------------------------------------------------

    /**
     * Claim up to $limit pending TTS word jobs under a 60-minute assist
     * lease (coordinator claim with the 'assist:' worker prefix).
     *
     * @return array<int, array{type:string,id:int,payload:array}>
     */
    public function claimTts(string $claimer, int $limit): array
    {
        $limit = max(1, min(10, $limit));
        $claimed = $this->coordinator->claimWords(self::assistWorkerId($claimer), null, $limit);

        $items = [];
        foreach ($claimed as $task) {
            $items[] = [
                'type' => 'tts',
                'id' => (int) $task['task_id'],
                'payload' => [
                    'text' => $task['content'],
                    'language' => $task['language'],
                    // The deterministic storage formula uses the default Edge
                    // voice at normal rate; workers must match it for the
                    // report path to be byte-identical with local generation.
                    'voice_type' => 'default',
                    'speed' => '+0%',
                    'audio_relative_path' => $task['audio_relative_path'],
                ],
            ];
        }

        return $items;
    }

    /**
     * Ingest one generated TTS audio (MP3). Fill-missing: a row that already
     * has audio is acknowledged with already_done and the file is untouched.
     * Otherwise delegates to the coordinator's validated report path (MP3
     * magic + on-disk verification + canonical state transition).
     *
     * @return array{ok:bool,status:string,already_done?:bool,error?:string,http_status:int}
     */
    public function submitTts(int $taskId, string $audioBase64, string $claimer, ?string $voice): array
    {
        $decoded = AppQyV1DictionaryTTSCoordinator::decodeTaskId($taskId);
        if (!$decoded || $decoded['type'] !== AppQyV1DictionaryTTSCoordinator::TYPE_WORD) {
            return ['ok' => false, 'status' => 'invalid', 'error' => 'Invalid tts task id', 'http_status' => 422];
        }

        $entry = AppQyV1LangDictionaryModel::forLanguage($decoded['language'])->find($decoded['row_id']);
        if (!$entry) {
            return ['ok' => false, 'status' => 'not_found', 'error' => 'Task row not found', 'http_status' => 404];
        }

        if (!empty($entry->has_audio)) {
            return ['ok' => true, 'status' => 'completed', 'already_done' => true, 'http_status' => 200];
        }

        $binary = base64_decode($audioBase64, true);
        if ($binary === false || $binary === '') {
            return ['ok' => false, 'status' => 'invalid', 'error' => 'audio_base64 is not valid base64', 'http_status' => 422];
        }

        // tts_provider column is string(100) - keep the identity within it.
        $provider = mb_substr('assist:' . $claimer . ($voice ? '/' . $voice : ''), 0, 100);
        $result = $this->coordinator->reportWordResult(
            $taskId,
            self::assistWorkerId($claimer),
            true,
            $binary,
            $provider,
            null
        );

        $httpStatus = $result['http_status'] ?? (($result['success'] ?? false) ? 200 : 500);

        return [
            'ok' => (bool) ($result['success'] ?? false),
            'status' => $result['status'] ?? (($result['success'] ?? false) ? 'completed' : 'error'),
            'error' => $result['error'] ?? null,
            'http_status' => $httpStatus,
        ];
    }

    /**
     * Release TTS claims. With an error the attempt is consumed (retry
     * budget, like a failed worker report); without one the rows simply go
     * back to pending.
     */
    public function releaseTts(array $ids, ?string $error, string $claimer): int
    {
        $released = 0;
        foreach ($ids as $id) {
            $id = (int) $id;
            if ($id <= 0) {
                continue;
            }
            if ($this->coordinator->releaseWordClaim($id, $error, self::assistWorkerId($claimer))) {
                $released++;
            }
        }

        return $released;
    }

    /** TTS counters in the assist-status shape. */
    public function ttsCounts(): array
    {
        $stats = $this->coordinator->statistics();
        $byStatus = $stats['by_status'] ?? [];

        return [
            'pending' => (int) ($byStatus['pending'] ?? 0),
            'processing' => (int) ($byStatus['processing'] ?? 0),
            'completed' => (int) ($byStatus['completed'] ?? 0),
            'failed' => (int) ($byStatus['failed'] ?? 0),
            'leased' => $this->coordinator->assistLeasedCount(),
        ];
    }

    /** Pending/terminal counts for word_translation global tasks (one grouped
     *  query, never per-status counts). */
    public function translationCounts(): array
    {
        $grouped = \App\Models\GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', 'word_translation')
            ->groupBy('status')
            ->select('status', \Illuminate\Support\Facades\DB::raw('count(*) as total'))
            ->pluck('total', 'status');

        $sumOf = static function (array $statuses) use ($grouped): int {
            $sum = 0;
            foreach ($statuses as $status) {
                if ($grouped->has($status)) {
                    $sum += (int) $grouped->get($status);
                }
            }
            return $sum;
        };

        $total = 0;
        foreach ($grouped as $value) {
            $total += (int) $value;
        }

        return [
            'pending' => $sumOf([\App\Models\GlobalTask::STATUS_PENDING]),
            'processing' => $sumOf([\App\Models\GlobalTask::STATUS_ASSIGNED, \App\Models\GlobalTask::STATUS_PROCESSING]),
            'completed' => $sumOf([\App\Models\GlobalTask::STATUS_COMPLETED, \App\Models\GlobalTask::STATUS_COMPLETED_DEMO]),
            'failed' => $sumOf([\App\Models\GlobalTask::STATUS_FAILED]),
            'total' => $total,
        ];
    }

    /**
     * Unified pending-work snapshot for ALL three assist tracks (cover / tts /
     * translation), cached so third-party workers and the dashboard can poll it
     * cheaply (the raw counts otherwise run several aggregate queries per call).
     *
     * The Octane cover timer (AppQyV1CoverGenerationTask) warms this every tick
     * via fresh=true, so a poller almost always reads a warm cache. A direct
     * caller with $fresh=false reuses the last snapshot for up to the TTL.
     */
    public const PENDING_SNAPSHOT_KEY = 'appqyv1:assist:pending_snapshot';
    public const PENDING_SNAPSHOT_TTL = 12;

    public function pendingSnapshot(bool $fresh = false): array
    {
        $build = function (): array {
            return [
                'generated_at' => now()->toIso8601String(),
                'enabled' => self::isAssistEnabled(),
                'lease_minutes' => self::LEASE_MINUTES,
                'cover' => $this->coverCounts(),
                'tts' => $this->ttsCounts(),
                'translation' => $this->translationCounts(),
            ];
        };

        if ($fresh) {
            $snapshot = $build();
            \Illuminate\Support\Facades\Cache::put(self::PENDING_SNAPSHOT_KEY, $snapshot, self::PENDING_SNAPSHOT_TTL);
            return $snapshot;
        }

        return \Illuminate\Support\Facades\Cache::remember(
            self::PENDING_SNAPSHOT_KEY,
            self::PENDING_SNAPSHOT_TTL,
            $build
        );
    }

    /** Image sniffing: PNG / JPEG / WebP (RIFF) / GIF magic bytes. */
    public static function looksLikeImage(string $bytes): bool
    {
        if (strlen($bytes) < 12) {
            return false;
        }

        return str_starts_with($bytes, "\x89PNG\r\n\x1a\n")
            || str_starts_with($bytes, "\xFF\xD8\xFF")
            || (str_starts_with($bytes, 'RIFF') && substr($bytes, 8, 4) === 'WEBP')
            || str_starts_with($bytes, 'GIF87a')
            || str_starts_with($bytes, 'GIF89a');
    }

    private function clearCoverLease(AppQyV1VocabularyLibraryModel $library): void
    {
        if ($library->assist_claimed_at !== null || $library->assist_claimed_by !== null) {
            $library->assist_claimed_at = null;
            $library->assist_claimed_by = null;
            $library->save();
        }
    }
}
