<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Models\Book;
use App\Models\GlobalTask;
use App\Models\Subtitle;
use App\Services\MoviePoster\MoviePosterStore;
use App\Services\TimerTasks\AppQyV1CoverGenerationTask;
use Illuminate\Database\Eloquent\Model;
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
    private MoviePosterStore $posterStore;

    public function __construct(
        ?AppQyV1DictionaryTTSCoordinator $coordinator = null,
        ?AppQyV1VocabularyCoverService $coverService = null,
        ?MoviePosterStore $posterStore = null
    ) {
        $this->coordinator = $coordinator ?: new AppQyV1DictionaryTTSCoordinator();
        $this->coverService = $coverService ?: new AppQyV1VocabularyCoverService();
        $this->posterStore = $posterStore ?: new MoviePosterStore();
    }

    /** Resolve the model class for a media type ('book'|'subtitle'). */
    private static function posterModelClass(string $mediaType): ?string
    {
        if ($mediaType === 'book') {
            return Book::class;
        }
        if ($mediaType === 'subtitle') {
            return Subtitle::class;
        }
        return null;
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
                // Always rebuild a FRESH randomized, text-free prompt so each
                // (re)generation varies instead of repeating the stored one.
                // Persist exactly what we hand to pycore for provenance.
                $prompt = $this->coverService->buildPrompt($library);
                $library->cover_prompt = $prompt;

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
    /** Cached check: do the cover provenance columns exist yet? (The migration
     *  ships separately, so the submit code must not assume them.) Schema
     *  introspection is cached per-process so submit stays a single write. */
    private static ?bool $coverProvenanceColumns = null;

    private static function coverProvenanceSupported(AppQyV1VocabularyLibraryModel $library): bool
    {
        if (self::$coverProvenanceColumns === null) {
            try {
                self::$coverProvenanceColumns = $library->getConnection()
                    ->getSchemaBuilder()
                    ->hasColumn($library->getTable(), 'cover_provider');
            } catch (\Throwable $e) {
                self::$coverProvenanceColumns = false;
            }
        }
        return self::$coverProvenanceColumns;
    }

    /** Cached check: have the poster + assist-lease migrations run on the media
     *  tables yet? posterCounts() runs inside the SHARED pendingSnapshot(), so an
     *  unguarded query against a not-yet-created poster_status/assist_claimed_at
     *  column would 500 the whole assist status (cover/tts included). Until the
     *  migrations run, poster work no-ops gracefully (zero counts, claims nothing). */
    private static ?bool $posterColumns = null;

    private static function posterColumnsReady(): bool
    {
        if (self::$posterColumns === null) {
            try {
                $book = new Book();
                $schema = $book->getConnection()->getSchemaBuilder();
                $table = $book->getTable();
                self::$posterColumns = $schema->hasColumn($table, 'poster_status')
                    && $schema->hasColumn($table, 'assist_claimed_at');
            } catch (\Throwable $e) {
                self::$posterColumns = false;
            }
        }
        return self::$posterColumns;
    }

    public function submitCover(
        int $libraryId,
        string $imageBase64,
        ?string $mime,
        ?string $provider = null,
        ?string $model = null,
        ?int $latencyMs = null
    ): array {
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
        // Provenance (detailed processing record): who/how generated this cover.
        // Best-effort + migration-SAFE — the provenance columns ship in a later
        // migration than the submit code, so we only write them once the columns
        // actually exist. This lets the assist worker report provenance before
        // the migration runs without ever throwing an "unknown column" on save.
        if (self::coverProvenanceSupported($library)) {
            if ($provider !== null && $provider !== '') {
                $library->cover_provider = mb_substr($provider, 0, 64);
            }
            if ($model !== null && $model !== '') {
                $library->cover_model = mb_substr($model, 0, 128);
            }
            if ($latencyMs !== null) {
                $library->cover_latency_ms = $latencyMs;
            }
        }
        $library->assist_claimed_at = null;
        $library->assist_claimed_by = null;
        $library->save();

        Log::info('[Assist] Cover submitted by assist worker', [
            'library_id' => $libraryId,
            'filename' => $library->cover_filename,
            'bytes' => strlen($binary),
            'mime' => $mime,
            'provider' => $provider,
            'model' => $model,
            'latency_ms' => $latencyMs,
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

    /**
     * Clear (delete) cover image files and re-queue the rows for regeneration.
     *
     * For each matching requested cover: delete the on-disk file, reset the row
     * to 'pending' (attempts=0, error/lease/timestamps cleared) and DROP the
     * stored cover_prompt so the next claim builds a fresh randomized one. Use
     * to throw away unsatisfactory covers and have pycore regenerate them.
     *
     * Scope: $all=true clears every requested cover; $failedOnly=true narrows to
     * failed/retry rows; otherwise only the given ids.
     *
     * @param int[] $ids
     * @return array{cleared:int,files_deleted:int}
     */
    public function clearCovers(array $ids = [], bool $all = false, bool $failedOnly = false): array
    {
        $query = AppQyV1VocabularyLibraryModel::query()->whereNotNull('cover_filename');
        if ($failedOnly) {
            $query->whereIn('cover_status', ['failed', 'retry']);
        }
        if (!$all) {
            $ids = array_values(array_filter(array_map('intval', $ids), static fn ($id) => $id > 0));
            if (empty($ids)) {
                return ['cleared' => 0, 'files_deleted' => 0];
            }
            $query->whereIn('id', $ids);
        }

        $cleared = 0;
        $filesDeleted = 0;
        // Plain get()+loop (not chunk): the requested-cover set is one row per
        // library, and we mutate cover_status which a chunked filter would skip.
        foreach ($query->get() as $library) {
            if ($this->coverService->deleteCoverFile($library->cover_filename)) {
                $filesDeleted++;
            }
            $library->cover_status = 'pending';
            $library->cover_attempts = 0;
            $library->cover_error_message = null;
            $library->cover_prompt = null;            // -> fresh randomized prompt on next claim
            $library->cover_started_at = null;
            $library->cover_finished_at = null;
            $library->cover_last_generated_at = null;
            $library->assist_claimed_at = null;
            $library->assist_claimed_by = null;
            $library->save();
            $cleared++;
        }

        return ['cleared' => $cleared, 'files_deleted' => $filesDeleted];
    }

    /**
     * Recovery: re-queue covers whose row says 'ready' but whose file is MISSING
     * on disk (deleted externally, lost storage). Resets them to 'pending' so
     * pycore regenerates them — guaranteeing a missing cover is always
     * re-enqueued. Cheap: only the (bounded) 'ready' set is stat-checked.
     *
     * @return array{reset:int,checked:int}
     */
    public function reconcileMissingCovers(): array
    {
        $checked = 0;
        $reset = 0;
        AppQyV1VocabularyLibraryModel::query()
            ->whereNotNull('cover_filename')
            ->where('cover_status', 'ready')
            ->select(['id', 'cover_filename', 'cover_status', 'cover_attempts',
                      'cover_error_message', 'cover_last_generated_at',
                      'assist_claimed_at', 'assist_claimed_by'])
            ->chunkById(200, function ($rows) use (&$checked, &$reset) {
                foreach ($rows as $library) {
                    $checked++;
                    if ($this->coverService->hasCoverFile($library->cover_filename)) {
                        continue;
                    }
                    $library->cover_status = 'pending';
                    $library->cover_attempts = 0;
                    $library->cover_error_message = null;
                    $library->cover_last_generated_at = null;
                    $library->assist_claimed_at = null;
                    $library->assist_claimed_by = null;
                    $library->save();
                    $reset++;
                }
            });

        return ['reset' => $reset, 'checked' => $checked];
    }

    /** Cover queue counters (requested covers only: cover_filename set). */
    public function coverCounts(): array
    {
        $base = fn () => AppQyV1VocabularyLibraryModel::query()->whereNotNull('cover_filename');

        // One grouped query for the per-status counts (same pattern as
        // translationCounts) instead of 5 separate COUNT(*) round-trips on every
        // assist-status poll.
        $grouped = $base()
            ->groupBy('cover_status')
            ->select('cover_status', \Illuminate\Support\Facades\DB::raw('count(*) as total'))
            ->pluck('total', 'cover_status');

        $counts = [
            'pending' => (int) ($grouped->get('pending') ?? 0),
            'retry' => (int) ($grouped->get('retry') ?? 0),
            'processing' => (int) ($grouped->get('processing') ?? 0),
            'ready' => (int) ($grouped->get('ready') ?? 0),
            'failed' => (int) ($grouped->get('failed') ?? 0),
        ];
        $counts['total'] = array_sum($counts);
        $counts['leased'] = (int) $base()
            ->where('assist_claimed_at', '>=', now()->subMinutes(self::LEASE_MINUTES))
            ->count();

        return $counts;
    }

    // ------------------------------------------------------------------
    // Poster claims (media posters across BOTH books and subtitles)
    // ------------------------------------------------------------------

    // Re-queue 'failed' posters older than this backoff (mirrors the cover
    // FAILED_COOLDOWN; shared with AppQyV1PosterCollectionTask).
    public const POSTER_FAILED_BACKOFF_MINUTES = 10;

    /**
     * Atomically claim up to $limit poster jobs spanning BOTH media tables
     * (books + subtitles). Claimable = poster_status pending OR failed-past-
     * backoff, AND no live assist lease. Oldest poster_fetched_at first (NULLs
     * are oldest), so never-attempted rows go out before retried ones. Each
     * item carries media_type so submit/release route to the right table.
     *
     * @return array<int, array{type:string,media_type:string,id:int,payload:array}>
     */
    public function claimPosters(string $claimer, int $limit): array
    {
        if (!self::posterColumnsReady()) {
            return [];
        }
        $limit = max(1, min(10, $limit));
        $claimerId = mb_substr($claimer, 0, 64);

        $items = [];
        $items = array_merge($items, $this->claimPostersFor('book', Book::class, $claimerId, $limit));
        $items = array_merge($items, $this->claimPostersFor('subtitle', Subtitle::class, $claimerId, $limit));

        return $items;
    }

    /**
     * Claim poster jobs from one media table under a transactional lock.
     *
     * @param class-string<Model> $modelClass
     * @return array<int, array{type:string,media_type:string,id:int,payload:array}>
     */
    private function claimPostersFor(string $mediaType, string $modelClass, string $claimerId, int $limit): array
    {
        /** @var Model $probe */
        $probe = new $modelClass();

        return $probe->getConnection()->transaction(function () use ($mediaType, $modelClass, $claimerId, $limit) {
            $leaseFloor = now()->subMinutes(self::LEASE_MINUTES);
            $failedFloor = now()->subMinutes(self::POSTER_FAILED_BACKOFF_MINUTES);

            $rows = $modelClass::query()
                ->where(function ($query) use ($failedFloor) {
                    $query->where('poster_status', 'pending')
                        ->orWhere(function ($retryQuery) use ($failedFloor) {
                            $retryQuery->where('poster_status', 'failed')
                                ->where(function ($q) use ($failedFloor) {
                                    $q->whereNull('poster_fetched_at')
                                        ->orWhere('poster_fetched_at', '<=', $failedFloor);
                                });
                        });
                })
                ->where(function ($query) use ($leaseFloor) {
                    $query->whereNull('assist_claimed_at')
                        ->orWhere('assist_claimed_at', '<', $leaseFloor);
                })
                ->orderByRaw('poster_fetched_at IS NULL DESC')
                ->orderBy('poster_fetched_at')
                ->limit($limit)
                ->lockForUpdate()
                ->get();

            $items = [];
            foreach ($rows as $row) {
                $row->assist_claimed_at = now();
                $row->assist_claimed_by = $claimerId;
                $row->save();

                $items[] = [
                    'type' => 'poster',
                    'media_type' => $mediaType,
                    'id' => (int) $row->id,
                    'payload' => [
                        'title' => $this->posterTitle($row),
                        'year' => $this->posterYear($row),
                        'filename' => (string) $row->source_key,
                    ],
                ];
            }

            return $items;
        }, 1);
    }

    /**
     * Ingest one fetched/generated poster for a media row. Fill-missing: a row
     * already poster_status='ready' with a file present is acknowledged without
     * rewriting. Stores the bytes via MoviePosterStore (which writes the file,
     * sets poster_filename/provider/source_id and poster_status='ready'), then
     * clears the assist lease.
     *
     * @return array{ok:bool,status:string,already_done?:bool,error?:string,image_url?:string,http_status:int}
     */
    public function submitPoster(
        string $mediaType,
        int $id,
        string $imageBase64,
        ?string $mime,
        ?string $provider = null,
        ?string $sourceId = null
    ): array {
        $modelClass = self::posterModelClass($mediaType);
        if ($modelClass === null) {
            return ['ok' => false, 'status' => 'invalid', 'error' => 'media_type must be book or subtitle', 'http_status' => 422];
        }

        /** @var Model|null $model */
        $model = $modelClass::query()->find($id);
        if (!$model) {
            return ['ok' => false, 'status' => 'not_found', 'error' => ucfirst($mediaType) . ' not found', 'http_status' => 404];
        }

        // Fill-missing, never clobber: already ready with a file -> ack only.
        if ($model->getAttribute('poster_status') === 'ready') {
            $existingUrl = $this->posterStore->imageUrlFor($model);
            if ($existingUrl !== null) {
                $this->clearPosterLease($model);
                return ['ok' => true, 'status' => 'ready', 'already_done' => true, 'image_url' => $existingUrl, 'http_status' => 200];
            }
        }

        $binary = base64_decode($imageBase64, true);
        if ($binary === false || $binary === '') {
            return ['ok' => false, 'status' => 'invalid', 'error' => 'image_base64 is not valid base64', 'http_status' => 422];
        }
        if (!self::looksLikeImage($binary)) {
            return ['ok' => false, 'status' => 'invalid', 'error' => 'Payload failed image validation (png/jpeg/webp/gif magic expected)', 'http_status' => 422];
        }

        // MoviePosterStore handles file write + the poster_* columns (status,
        // filename = source_key.ext, provider, source_id, fetched_at).
        $applied = $this->posterStore->applyToModel($model, [
            'provider' => $provider,
            'source_id' => $sourceId,
            'binary' => $binary,
            'mime' => $mime ?: 'image/jpeg',
            'meta' => [],
        ]);

        if (!($applied['ok'] ?? false)) {
            Log::error('[Assist] Failed to persist submitted poster', [
                'media_type' => $mediaType,
                'id' => $id,
                'error' => $applied['error'] ?? null,
            ]);
            return [
                'ok' => false,
                'status' => $applied['status'] ?? 'error',
                'error' => $applied['error'] ?? 'Failed to persist poster file',
                'http_status' => 500,
            ];
        }

        // applyToModel saved the poster_* columns; clear the lease on top.
        $this->clearPosterLease($model->refresh());

        Log::info('[Assist] Poster submitted by assist worker', [
            'media_type' => $mediaType,
            'id' => $id,
            'bytes' => strlen($binary),
            'mime' => $mime,
            'provider' => $provider,
            'source_id' => $sourceId,
        ]);

        return [
            'ok' => true,
            'status' => 'ready',
            'image_url' => $applied['image_url'] ?? $this->posterStore->imageUrlFor($model),
            'http_status' => 200,
        ];
    }

    /**
     * Release poster claims back to the queue for one media table. Non-ready
     * rows are marked poster_status='failed' (+ poster_fetched_at so the
     * collection timer's backoff applies) and lose the lease; ready rows only
     * lose the lease. Only rows actually holding a lease are touched.
     *
     * @param int[] $ids
     * @return int number of leased rows released
     */
    public function releasePosters(string $mediaType, array $ids, ?string $error): int
    {
        $modelClass = self::posterModelClass($mediaType);
        if ($modelClass === null) {
            return 0;
        }

        $ids = array_values(array_filter(array_map('intval', $ids), static fn ($id) => $id > 0));
        if (empty($ids)) {
            return 0;
        }

        $released = $modelClass::query()
            ->whereIn('id', $ids)
            ->whereNotNull('assist_claimed_at')
            ->count();

        // Non-ready leased rows -> failed + backoff timestamp, clear lease.
        $modelClass::query()
            ->whereIn('id', $ids)
            ->whereNotNull('assist_claimed_at')
            ->where('poster_status', '!=', 'ready')
            ->update([
                'poster_status' => 'failed',
                'poster_fetched_at' => now(),
                'assist_claimed_at' => null,
                'assist_claimed_by' => null,
            ]);

        // Ready leased rows -> just drop the lease.
        $modelClass::query()
            ->whereIn('id', $ids)
            ->whereNotNull('assist_claimed_at')
            ->update([
                'assist_claimed_at' => null,
                'assist_claimed_by' => null,
            ]);

        if ($error !== null && $error !== '') {
            Log::info('[Assist] Posters released by assist worker', [
                'media_type' => $mediaType,
                'count' => $released,
                'error' => mb_substr($error, 0, 500),
            ]);
        }

        return $released;
    }

    /**
     * Poster queue counters aggregated across BOTH media tables, in the
     * assist-status shape: {pending,ready,failed,none,total,leased}.
     */
    public function posterCounts(): array
    {
        $counts = [
            'pending' => 0,
            'ready' => 0,
            'failed' => 0,
            'none' => 0,
            'total' => 0,
            'leased' => 0,
        ];

        // Migrations not run yet → no poster columns → report empty (never throw:
        // this runs inside the shared assist snapshot).
        if (!self::posterColumnsReady()) {
            return $counts;
        }

        $leaseFloor = now()->subMinutes(self::LEASE_MINUTES);

        foreach ([Book::class, Subtitle::class] as $modelClass) {
            $grouped = $modelClass::query()
                ->groupBy('poster_status')
                ->select('poster_status', \Illuminate\Support\Facades\DB::raw('count(*) as total'))
                ->pluck('total', 'poster_status');

            $counts['pending'] += (int) ($grouped->get('pending') ?? 0);
            $counts['ready'] += (int) ($grouped->get('ready') ?? 0);
            $counts['failed'] += (int) ($grouped->get('failed') ?? 0);
            $counts['none'] += (int) ($grouped->get('none') ?? 0);

            $counts['leased'] += (int) $modelClass::query()
                ->where('assist_claimed_at', '>=', $leaseFloor)
                ->count();
        }

        $counts['total'] = $counts['pending'] + $counts['ready'] + $counts['failed'] + $counts['none'];

        return $counts;
    }

    /** Derive the search title from a media row (title, then original_name). */
    private function posterTitle(Model $model): string
    {
        $title = trim((string) $model->getAttribute('title'));
        if ($title === '') {
            $title = trim((string) $model->getAttribute('original_name'));
        }
        return $title;
    }

    /** Derive the release year from metadata.year / poster_meta.year (no year column). */
    private function posterYear(Model $model): ?int
    {
        foreach (['metadata', 'poster_meta'] as $attr) {
            $bag = $model->getAttribute($attr);
            if (is_array($bag) && isset($bag['year']) && (int) $bag['year'] > 0) {
                return (int) $bag['year'];
            }
        }
        return null;
    }

    private function clearPosterLease(Model $model): void
    {
        if ($model->getAttribute('assist_claimed_at') !== null || $model->getAttribute('assist_claimed_by') !== null) {
            $model->setAttribute('assist_claimed_at', null);
            $model->setAttribute('assist_claimed_by', null);
            $model->save();
        }
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
    public function submitTts(
        int $taskId,
        string $audioBase64,
        string $claimer,
        ?string $voice,
        ?string $engine = null
    ): array {
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
        // When the worker reports its real engine (edge-tts / sherpa / ...),
        // fold it in so the record shows WHICH engine synthesized the audio.
        $engineTag = ($engine !== null && $engine !== '') ? mb_substr($engine, 0, 32) . ':' : '';
        $provider = mb_substr('assist:' . $engineTag . $claimer . ($voice ? '/' . $voice : ''), 0, 100);
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

    // ------------------------------------------------------------------
    // Queue Center overview aggregators (GET /assist/overview)
    // ------------------------------------------------------------------

    /** Max sample rows returned per overview category (display only). */
    public const OVERVIEW_SAMPLE_LIMIT = 5;

    /**
     * word_translation counts split by language. global_tasks pending/processing
     * (one grouped query) PLUS the dictionary has_translation=false markers per
     * supported language (the actual not-yet-translated rows that feed the queue).
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               by_language:array<string,int>,sample:array<int,array<string,mixed>>}
     */
    public function wordTranslationCounts(): array
    {
        $task = $this->globalTaskStatusCounts('word_translation');
        $byLanguage = $this->dictionaryByLanguage(static function ($query) {
            $query->where('has_translation', false);
        });

        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['processing'], // global tasks: an assigned/processing task IS the lease
            'total' => $task['total'],
            'by_language' => $byLanguage,
            'sample' => $this->wordTaskSample('word_translation'),
        ];
    }

    /**
     * word_image (word_media lane) counts split by language. global_tasks
     * task_type='word_media' pending/processing PLUS dictionary rows whose
     * image is missing (image_status='pending' OR empty image_files) per language.
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               by_language:array<string,int>,sample:array<int,array<string,mixed>>}
     */
    public function wordImageCounts(): array
    {
        $task = $this->globalTaskStatusCounts('word_media');
        $byLanguage = $this->dictionaryByLanguage(static function ($query) {
            // Outstanding = no image stored yet AND not a terminal verdict. A word
            // with image_status='none' (Bing checked, has none) or 'completed' is
            // NOT outstanding even when image_files is empty. Two ANDed nested
            // closures (a top-level orWhere would wrongly re-include 'none' rows).
            $query->where(function ($q) {
                $q->whereNull('image_files')
                    ->orWhere('image_files', '')
                    ->orWhere('image_files', '[]')
                    ->orWhere('image_files', '{}');
            })->where(function ($q) {
                $q->whereNull('image_status')
                    ->orWhereNotIn('image_status', ['completed', 'none']);
            });
        });

        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['processing'],
            'total' => $task['total'],
            'by_language' => $byLanguage,
            'sample' => $this->wordTaskSample('word_media'),
        ];
    }

    /**
     * word_audio (pycore lane) counts split by language. global_tasks
     * task_type='word_audio' pending/processing PLUS dictionary rows missing
     * audio (has_audio=false OR tts_status='pending') per language.
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               by_language:array<string,int>,sample:array<int,array<string,mixed>>}
     */
    public function wordAudioCounts(): array
    {
        $task = $this->globalTaskStatusCounts('word_audio');
        $byLanguage = $this->dictionaryByLanguage(static function ($query) {
            $query->where(function ($q) {
                $q->where('has_audio', false)
                    ->orWhere('tts_status', 'pending');
            });
        });

        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['processing'],
            'total' => $task['total'],
            'by_language' => $byLanguage,
            'sample' => $this->wordTaskSample('word_audio'),
        ];
    }

    /**
     * notebooklm (chrome Task Center lane) global_tasks counts. Pure global-task
     * category: pending/processing from task_type='notebooklm' (no dictionary
     * by-language dimension).
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               sample:array<int,array<string,mixed>>}
     */
    public function notebookLmCounts(): array
    {
        $task = $this->globalTaskStatusCounts('notebooklm');

        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['processing'],
            'total' => $task['total'],
            'sample' => $this->wordTaskSample('notebooklm'),
        ];
    }

    /**
     * gemini_image (chrome Task Center lane) global_tasks counts — the alternative
     * word/cover image generator. Same global-task shape as word_image, split by
     * language where the payload carries one.
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               sample:array<int,array<string,mixed>>}
     */
    public function geminiImageCounts(): array
    {
        $task = $this->globalTaskStatusCounts('gemini_image');

        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['processing'],
            'total' => $task['total'],
            'sample' => $this->wordTaskSample('gemini_image'),
        ];
    }

    /**
     * gemini_chat (chrome Task Center lane, remote_gemini_text) global_tasks
     * counts — text-only Gemini completion, the sibling of gemini_image. Same
     * pure global-task shape as notebooklm (no dictionary by-language dimension).
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               sample:array<int,array<string,mixed>>}
     */
    public function geminiChatCounts(): array
    {
        $task = $this->globalTaskStatusCounts('gemini_chat');

        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['processing'],
            'total' => $task['total'],
            'sample' => $this->wordTaskSample('gemini_chat'),
        ];
    }

    /**
     * Grouped status counts for one AppQyV1 global_tasks task_type. One grouped
     * query; pending/processing/total in the shared assist-status shape.
     *
     * @return array{pending:int,processing:int,total:int}
     */
    private function globalTaskStatusCounts(string $taskType): array
    {
        $grouped = GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', $taskType)
            ->groupBy('status')
            ->select('status', \Illuminate\Support\Facades\DB::raw('count(*) as total'))
            ->pluck('total', 'status');

        $pending = (int) ($grouped->get(GlobalTask::STATUS_PENDING) ?? 0);
        $processing = (int) ($grouped->get(GlobalTask::STATUS_ASSIGNED) ?? 0)
            + (int) ($grouped->get(GlobalTask::STATUS_PROCESSING) ?? 0);

        $total = 0;
        foreach ($grouped as $value) {
            $total += (int) $value;
        }

        return [
            'pending' => $pending,
            'processing' => $processing,
            'total' => $total,
        ];
    }

    /**
     * Up to OVERVIEW_SAMPLE_LIMIT sample rows for a word global-task type, flattened
     * to one display row per word: {word, language}. Best-effort; never throws.
     *
     * @return array<int,array{word:?string,language:?string}>
     */
    private function wordTaskSample(string $taskType): array
    {
        $rows = GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', $taskType)
            ->whereIn('status', [GlobalTask::STATUS_PENDING, GlobalTask::STATUS_ASSIGNED, GlobalTask::STATUS_PROCESSING])
            ->orderByDesc('priority')
            ->limit(self::OVERVIEW_SAMPLE_LIMIT)
            ->get(['payload']);

        $sample = [];
        foreach ($rows as $row) {
            $payload = is_array($row->payload) ? $row->payload : [];
            $language = $payload['language'] ?? null;
            $words = $payload['words'] ?? [];
            $first = is_array($words) ? ($words[0] ?? null) : null;
            $word = is_array($first) ? ($first['word'] ?? null) : (is_string($first) ? $first : null);
            $sample[] = ['word' => $word, 'language' => $language];
            if (count($sample) >= self::OVERVIEW_SAMPLE_LIMIT) {
                break;
            }
        }

        return $sample;
    }

    /**
     * Count dictionary rows matching $filter across EVERY supported per-language
     * table, returning a {lang: count} map (langs with zero matches are omitted).
     * One COUNT query per existing table; missing tables are skipped silently.
     *
     * @param callable(\Illuminate\Database\Eloquent\Builder):void $filter
     * @return array<string,int>
     */
    private function dictionaryByLanguage(callable $filter): array
    {
        $byLanguage = [];
        foreach (\App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            try {
                $model = AppQyV1LangDictionaryModel::forLanguage($lang);
                if (!$model->getConnection()->getSchemaBuilder()->hasTable($model->getTable())) {
                    continue;
                }
                $query = $model->newQuery();
                $filter($query);
                $count = (int) $query->count();
                if ($count > 0) {
                    $byLanguage[$lang] = $count;
                }
            } catch (\Throwable $e) {
                // Missing column / table on a not-yet-migrated language: skip it.
                continue;
            }
        }
        return $byLanguage;
    }

    /**
     * Per-language sentence-audio counts (has_audio=false) plus the live sentence
     * audio lease count, in the overview shape. Delegates the per-language sweep
     * and the lease tally to AppQyV1SentenceAudioService (file-first source of
     * truth), then adds a small sample of pending sentences for display.
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               by_language:array<string,int>,sample:array<int,array<string,mixed>>}
     */
    public function sentenceCounts(): array
    {
        $service = new AppQyV1SentenceAudioService();
        $byLanguage = [];
        $sample = [];

        foreach (\App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            try {
                $model = \App\Models\LangSentence::for($lang);
                if (!$model->getConnection()->getSchemaBuilder()->hasTable($model->getTable())) {
                    continue;
                }
                $count = (int) \App\Models\LangSentence::onLang($lang)->where('has_audio', false)->count();
                if ($count > 0) {
                    $byLanguage[$lang] = $count;
                }
                // Collect a few sample rows until the display limit is reached.
                if (count($sample) < self::OVERVIEW_SAMPLE_LIMIT && $count > 0) {
                    $rows = \App\Models\LangSentence::onLang($lang)
                        ->where('has_audio', false)
                        ->orderByDesc('tts_priority')
                        ->orderByDesc('occurrence_count')
                        ->limit(self::OVERVIEW_SAMPLE_LIMIT - count($sample))
                        ->get(['content_id', 'text']);
                    foreach ($rows as $row) {
                        $sample[] = [
                            'source_key' => (string) $row->content_id,
                            'title' => mb_substr((string) $row->text, 0, 80),
                            'language' => $lang,
                        ];
                    }
                }
            } catch (\Throwable $e) {
                continue;
            }
        }

        $pending = array_sum($byLanguage);
        $leased = $service->leasedCount(null);

        return [
            'pending' => $pending,
            'processing' => $leased,
            'leased' => $leased,
            'total' => $pending,
            'by_language' => $byLanguage,
            'sample' => $sample,
        ];
    }

    /**
     * Group assist_requests by status for one (record_type, request_type), split
     * by language. Used for the subtitle_lang + book_lang overview categories
     * (record_type 'subtitle'/'book', request_type 'add_language').
     *
     * Guarded: when the assist_requests table is absent (migration not run) the
     * method returns an all-zero shape instead of throwing — it runs inside the
     * shared overview snapshot.
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               by_language:array<string,int>,by_status:array<string,int>,
     *               sample:array<int,array<string,mixed>>}
     */
    public function assistRequestGroupCounts(string $recordType, string $requestType): array
    {
        $empty = [
            'pending' => 0,
            'processing' => 0,
            'leased' => 0,
            'total' => 0,
            'by_language' => [],
            'by_status' => [],
            'sample' => [],
        ];

        if (!self::assistRequestsTableReady()) {
            return $empty;
        }

        try {
            $base = fn () => \App\Models\AppQyV1AssistRequest::query()
                ->where('record_type', $recordType)
                ->where('request_type', $requestType);

            // Per-status counts (one grouped query).
            $byStatus = $base()
                ->groupBy('status')
                ->select('status', \Illuminate\Support\Facades\DB::raw('count(*) as total'))
                ->pluck('total', 'status');

            // Per-language counts (one grouped query).
            $byLangRaw = $base()
                ->groupBy('language')
                ->select('language', \Illuminate\Support\Facades\DB::raw('count(*) as total'))
                ->pluck('total', 'language');

            $byLanguage = [];
            foreach ($byLangRaw as $lang => $total) {
                $key = ($lang === null || $lang === '') ? 'unknown' : (string) $lang;
                $byLanguage[$key] = (int) $total;
            }

            $statusMap = [];
            $total = 0;
            foreach ($byStatus as $status => $value) {
                $statusMap[(string) $status] = (int) $value;
                $total += (int) $value;
            }

            $leaseFloor = now()->subMinutes(\App\Models\AppQyV1AssistRequest::LEASE_MINUTES);
            $leased = (int) $base()
                ->whereNotNull('claimed_at')
                ->where('claimed_at', '>=', $leaseFloor)
                ->count();

            $sample = $base()
                ->whereIn('status', [
                    \App\Models\AppQyV1AssistRequest::STATUS_PENDING,
                    \App\Models\AppQyV1AssistRequest::STATUS_CLAIMED,
                    \App\Models\AppQyV1AssistRequest::STATUS_PROCESSING,
                ])
                ->orderByDesc('priority')
                ->orderBy('id')
                ->limit(self::OVERVIEW_SAMPLE_LIMIT)
                ->get(['id', 'source_key', 'language'])
                ->map(static fn ($row) => [
                    'id' => (int) $row->id,
                    'source_key' => (string) $row->source_key,
                    'language' => $row->language !== null ? (string) $row->language : null,
                ])->all();

            return [
                'pending' => (int) ($statusMap[\App\Models\AppQyV1AssistRequest::STATUS_PENDING] ?? 0),
                'processing' => (int) ($statusMap[\App\Models\AppQyV1AssistRequest::STATUS_CLAIMED] ?? 0)
                    + (int) ($statusMap[\App\Models\AppQyV1AssistRequest::STATUS_PROCESSING] ?? 0),
                'leased' => $leased,
                'total' => $total,
                'by_language' => $byLanguage,
                'by_status' => $statusMap,
                'sample' => $sample,
            ];
        } catch (\Throwable $e) {
            return $empty;
        }
    }

    /** Cached check: has the assist_requests table been created yet? */
    private static ?bool $assistRequestsTable = null;

    private static function assistRequestsTableReady(): bool
    {
        if (self::$assistRequestsTable === null) {
            try {
                $model = new \App\Models\AppQyV1AssistRequest();
                self::$assistRequestsTable = $model->getConnection()
                    ->getSchemaBuilder()
                    ->hasTable($model->getTable());
            } catch (\Throwable $e) {
                self::$assistRequestsTable = false;
            }
        }
        return self::$assistRequestsTable;
    }

    /**
     * Online assist/global-task workers from the Worker model: id, kind +
     * processor_types, online (heartbeat within Worker::HEARTBEAT_TIMEOUT),
     * last_seen, and the count of global tasks currently claimed by each.
     *
     * Guarded: a missing workers table (migration not run) returns an empty list.
     *
     * @return array<int,array{id:string,kind:string,processor_types:array<int,string>,
     *               online:bool,last_seen:?string,claimed:int}>
     */
    public function workers(): array
    {
        try {
            $model = new \App\Models\Worker();
            if (!$model->getConnection()->getSchemaBuilder()->hasTable($model->getTable())) {
                return [];
            }
        } catch (\Throwable $e) {
            return [];
        }

        try {
            $rows = \App\Models\Worker::query()
                ->orderByDesc('last_heartbeat_at')
                ->limit(100)
                ->get(['worker_id', 'worker_name', 'processor_types', 'status', 'last_heartbeat_at']);

            // One grouped query for claimed (assigned/processing) global tasks per
            // worker, instead of a COUNT per worker row.
            $claimedByWorker = GlobalTask::query()
                ->whereIn('status', [GlobalTask::STATUS_ASSIGNED, GlobalTask::STATUS_PROCESSING])
                ->whereNotNull('assigned_to')
                ->groupBy('assigned_to')
                ->select('assigned_to', \Illuminate\Support\Facades\DB::raw('count(*) as total'))
                ->pluck('total', 'assigned_to');

            $heartbeatFloor = now()->subSeconds(\App\Models\Worker::HEARTBEAT_TIMEOUT);

            $out = [];
            foreach ($rows as $row) {
                $types = is_array($row->processor_types) ? array_values($row->processor_types) : [];
                $online = $row->last_heartbeat_at !== null && $row->last_heartbeat_at >= $heartbeatFloor;
                // Normalize kind to a canonical token the Queue Center FE matches
                // EXACTLY ('chrome' -> ChromeIcon, 'pycore' -> CpuIcon). Workers
                // register descriptive names (chrome-bing-assist / pycore-translation-*)
                // so we map them down; the full original name stays on 'name'.
                $name = (string) ($row->worker_name ?? '');
                $nameLower = strtolower($name);
                if (str_contains($nameLower, 'chrome')) {
                    $kind = 'chrome';
                } elseif (str_contains($nameLower, 'pycore') || in_array(GlobalTask::EXECUTION_REMOTE_AUDIO, $types, true)) {
                    $kind = 'pycore';
                } else {
                    $kind = $types[0] ?? 'worker';
                }
                $out[] = [
                    'id' => (string) $row->worker_id,
                    'kind' => $kind,
                    'name' => $name,
                    'processor_types' => $types,
                    'online' => $online,
                    'last_seen' => $row->last_heartbeat_at !== null ? $row->last_heartbeat_at->toIso8601String() : null,
                    'claimed' => (int) ($claimedByWorker->get($row->worker_id) ?? 0),
                ];
            }
            return $out;
        } catch (\Throwable $e) {
            return [];
        }
    }

    /**
     * Single rich aggregate snapshot consumed by pycore's Queue Center overview.
     * Returns the SHARED CONTRACT v2 shape: { generated_at, categories[], workers[] }.
     * Cached (OVERVIEW_TTL) like pendingSnapshot; $fresh=true forces a recompute.
     */
    public const OVERVIEW_SNAPSHOT_KEY = 'appqyv1:assist:overview_snapshot';
    public const OVERVIEW_TTL = 30;

    public function overviewSnapshot(bool $fresh = false): array
    {
        $build = function (): array {
            $cover = $this->coverCounts();
            $poster = $this->posterCounts();
            $wordTranslation = $this->wordTranslationCounts();
            $wordImage = $this->wordImageCounts();
            $wordAudio = $this->wordAudioCounts();
            $sentence = $this->sentenceCounts();
            $subtitleLang = $this->assistRequestGroupCounts('subtitle', 'add_language');
            $bookLang = $this->assistRequestGroupCounts('book', 'add_language');
            $notebookLm = $this->notebookLmCounts();
            $geminiImage = $this->geminiImageCounts();
            $geminiChat = $this->geminiChatCounts();

            // Primary-handler lookup keyed by this overview's category keys.
            // Capability-backed keys read from the canonical GlobalTask map;
            // non-capability keys (subtitle_lang/book_lang = AI translations,
            // cover = AssistWorker cover, notebooklm/gemini_* = chrome) keep
            // their historical labels. The Task Center and this overview now
            // share a single source of truth for capability routing.
            $handlerForKey = static function (string $key, string $fallback): string {
                $keyToCap = [
                    'word_translation' => \App\Models\GlobalTask::CAPABILITY_TRANSLATE,
                    'word_image' => \App\Models\GlobalTask::CAPABILITY_IMAGE,
                    'word_audio' => \App\Models\GlobalTask::CAPABILITY_AUDIO,
                    'sentence_audio' => \App\Models\GlobalTask::CAPABILITY_SENTENCE_AUDIO,
                    'poster' => \App\Models\GlobalTask::CAPABILITY_POSTER,
                ];
                $cap = $keyToCap[$key] ?? null;
                if ($cap !== null) {
                    return \App\Models\GlobalTask::CAPABILITY_PRIMARY_HANDLER[$cap] ?? $fallback;
                }
                return $fallback;
            };

            $categories = [
                [
                    'key' => 'word_translation',
                    'label' => 'Word Translation',
                    'handler' => $handlerForKey('word_translation', 'pycore'),
                    'pending' => $wordTranslation['pending'],
                    'processing' => $wordTranslation['processing'],
                    'leased' => $wordTranslation['leased'],
                    'total' => $wordTranslation['total'],
                    'by_language' => $wordTranslation['by_language'],
                    'sample' => $wordTranslation['sample'],
                ],
                [
                    'key' => 'word_image',
                    'label' => 'Word Image',
                    'handler' => $handlerForKey('word_image', 'pycore'),
                    'pending' => $wordImage['pending'],
                    'processing' => $wordImage['processing'],
                    'leased' => $wordImage['leased'],
                    'total' => $wordImage['total'],
                    'by_language' => $wordImage['by_language'],
                    'sample' => $wordImage['sample'],
                ],
                [
                    'key' => 'word_audio',
                    'label' => 'Word Audio',
                    'handler' => $handlerForKey('word_audio', 'pycore'),
                    'pending' => $wordAudio['pending'],
                    'processing' => $wordAudio['processing'],
                    'leased' => $wordAudio['leased'],
                    'total' => $wordAudio['total'],
                    'by_language' => $wordAudio['by_language'],
                    'sample' => $wordAudio['sample'],
                ],
                [
                    'key' => 'sentence_audio',
                    'label' => 'Sentence Audio',
                    'handler' => $handlerForKey('sentence_audio', 'pycore'),
                    'pending' => $sentence['pending'],
                    'processing' => $sentence['processing'],
                    'leased' => $sentence['leased'],
                    'total' => $sentence['total'],
                    'by_language' => $sentence['by_language'],
                    'sample' => $sentence['sample'],
                ],
                [
                    'key' => 'subtitle_lang',
                    'label' => 'Subtitle Add-Language',
                    'handler' => 'ai',
                    'pending' => $subtitleLang['pending'],
                    'processing' => $subtitleLang['processing'],
                    'leased' => $subtitleLang['leased'],
                    'total' => $subtitleLang['total'],
                    'by_language' => $subtitleLang['by_language'],
                    'by_status' => $subtitleLang['by_status'],
                    'sample' => $subtitleLang['sample'],
                ],
                [
                    'key' => 'book_lang',
                    'label' => 'Book Add-Language',
                    'handler' => 'ai',
                    'pending' => $bookLang['pending'],
                    'processing' => $bookLang['processing'],
                    'leased' => $bookLang['leased'],
                    'total' => $bookLang['total'],
                    'by_language' => $bookLang['by_language'],
                    'by_status' => $bookLang['by_status'],
                    'sample' => $bookLang['sample'],
                ],
                [
                    'key' => 'cover',
                    'label' => 'Vocabulary Cover',
                    'handler' => 'pycore',
                    'pending' => (int) ($cover['pending'] ?? 0) + (int) ($cover['retry'] ?? 0),
                    'processing' => (int) ($cover['processing'] ?? 0),
                    'leased' => (int) ($cover['leased'] ?? 0),
                    'total' => (int) ($cover['total'] ?? 0),
                    'sample' => $this->coverSample(),
                ],
                [
                    'key' => 'poster',
                    'label' => 'Media Poster',
                    'handler' => $handlerForKey('poster', 'pycore'),
                    'pending' => (int) ($poster['pending'] ?? 0),
                    'processing' => 0,
                    'leased' => (int) ($poster['leased'] ?? 0),
                    'total' => (int) ($poster['total'] ?? 0),
                    'sample' => $this->posterSample(),
                ],
                [
                    'key' => 'notebooklm',
                    'label' => 'NotebookLM',
                    'handler' => 'chrome',
                    'pending' => $notebookLm['pending'],
                    'processing' => $notebookLm['processing'],
                    'leased' => $notebookLm['leased'],
                    'total' => $notebookLm['total'],
                    'sample' => $notebookLm['sample'],
                ],
                [
                    'key' => 'gemini_image',
                    'label' => 'Gemini Image',
                    'handler' => 'chrome',
                    'pending' => $geminiImage['pending'],
                    'processing' => $geminiImage['processing'],
                    'leased' => $geminiImage['leased'],
                    'total' => $geminiImage['total'],
                    'sample' => $geminiImage['sample'],
                ],
                [
                    'key' => 'gemini_chat',
                    'label' => 'Gemini Chat',
                    'handler' => 'chrome',
                    'pending' => $geminiChat['pending'],
                    'processing' => $geminiChat['processing'],
                    'leased' => $geminiChat['leased'],
                    'total' => $geminiChat['total'],
                    'sample' => $geminiChat['sample'],
                ],
            ];

            return [
                'success' => true,
                'generated_at' => now()->toIso8601String(),
                'categories' => $categories,
                'workers' => $this->workers(),
            ];
        };

        if ($fresh) {
            $snapshot = $build();
            \Illuminate\Support\Facades\Cache::put(self::OVERVIEW_SNAPSHOT_KEY, $snapshot, self::OVERVIEW_TTL);
            return $snapshot;
        }

        return \Illuminate\Support\Facades\Cache::remember(
            self::OVERVIEW_SNAPSHOT_KEY,
            self::OVERVIEW_TTL,
            $build
        );
    }

    /**
     * Up to OVERVIEW_SAMPLE_LIMIT pending/retry cover rows for display.
     *
     * @return array<int,array{id:int,title:?string}>
     */
    private function coverSample(): array
    {
        try {
            return AppQyV1VocabularyLibraryModel::query()
                ->whereNotNull('cover_filename')
                ->whereIn('cover_status', ['pending', 'retry', 'processing'])
                ->orderByDesc('cover_priority')
                ->limit(self::OVERVIEW_SAMPLE_LIMIT)
                ->get(['id', 'name'])
                ->map(static fn ($row) => ['id' => (int) $row->id, 'title' => $row->name !== null ? (string) $row->name : null])
                ->all();
        } catch (\Throwable $e) {
            return [];
        }
    }

    /**
     * Up to OVERVIEW_SAMPLE_LIMIT pending/failed poster rows across both media
     * tables for display.
     *
     * @return array<int,array{id:int,title:?string}>
     */
    private function posterSample(): array
    {
        if (!self::posterColumnsReady()) {
            return [];
        }
        $sample = [];
        foreach ([Book::class, Subtitle::class] as $modelClass) {
            if (count($sample) >= self::OVERVIEW_SAMPLE_LIMIT) {
                break;
            }
            try {
                $rows = $modelClass::query()
                    ->whereIn('poster_status', ['pending', 'failed'])
                    ->limit(self::OVERVIEW_SAMPLE_LIMIT - count($sample))
                    ->get(['id', 'title', 'original_name']);
                foreach ($rows as $row) {
                    $title = trim((string) $row->getAttribute('title'));
                    if ($title === '') {
                        $title = trim((string) $row->getAttribute('original_name'));
                    }
                    $sample[] = ['id' => (int) $row->id, 'title' => $title !== '' ? $title : null];
                }
            } catch (\Throwable $e) {
                continue;
            }
        }
        return $sample;
    }

    /**
     * Unified pending-work snapshot for ALL three assist tracks (cover / tts /
     * translation), cached so third-party workers and the dashboard can poll it
     * cheaply (the raw counts otherwise run several aggregate queries per call).
     *
     * The Octane cover timer (AppQyV1CoverGenerationTask) TOUCHES this every
     * tick with $fresh=false, so the cache stays warm but the (expensive) tts
     * statistics()/cover counts only recompute once per TTL — NOT on every 5s
     * tick. A poller hitting /assist/pending reads the same warm cache. Pass
     * $fresh=true (the ?fresh=1 query) to force an immediate recompute.
     */
    public const PENDING_SNAPSHOT_KEY = 'appqyv1:assist:pending_snapshot';
    // 30s: a pending-work snapshot does not need second-level freshness, and the
    // TTS statistics() aggregate scans large per-language tables — bounding it to
    // ~once / 30s keeps the warm cheap.
    public const PENDING_SNAPSHOT_TTL = 30;

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
                'poster' => $this->posterCounts(),
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
